const BackgroundLogic = {

  init() {
    BackgroundLogic.initializeListeners();
    BackgroundLogic.initializeContextMenu();
  },

  initializeListeners() {
    browser.windows.onRemoved.addListener(BackgroundLogic.tearDownWindow);

    browser.windows.onFocusChanged.addListener(windowId => {
      if (windowId != browser.windows.WINDOW_ID_NONE) {
        BackgroundLogic.updateContextMenu();
      }
    });

    // browser.tabs.onCreated.addListener(BackgroundLogic.updateContextMenu);
    // browser.tabs.onRemoved.addListener(BackgroundLogic.updateContextMenu);
    browser.tabs.onCreated.addListener(BackgroundLogic.handleTabsCreated);
    browser.tabs.onRemoved.addListener(BackgroundLogic.handleTabsRemoved);

    browser.omnibox.onInputChanged.addListener(BackgroundLogic.handleAwesomebarSearch);
    browser.omnibox.onInputEntered.addListener(BackgroundLogic.handleAwesomebarSelection);

    browser.commands.onCommand.addListener(BackgroundLogic.handleCommands);
  },

  async getWorkspacesForCurrentWindow() {
    return await BackgroundLogic.getWorkspacesForWindow(await BackgroundLogic.getCurrentWindowId());
  },

  async getWorkspacesForWindow(windowId) {
    const workspaces = await WorkspaceStorage.fetchWorkspacesForWindow(windowId);

    console.log("getWorkspacesForWindow");

    if (workspaces.length > 0) {
      console.log("workspaces.length > 0");
      console.log({ workspaces });
      return workspaces;
    } else {
      console.log("workspaces.length = 0");
      console.log("createNewWorkspace");
      const defaultWorkspace = await BackgroundLogic.createNewWorkspace(true);

      return [defaultWorkspace];
    }
  },

  async getView(type) {
    const view = await browser.extension.getViews({ type });
    return view[0];
  },

  async getCurrentWorkspaceForWindow(windowId) {
    const workspaces = await BackgroundLogic.getWorkspacesForWindow(windowId);

    return workspaces.find(workspace => workspace.active);
  },

  async updateTabsCount() {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    const activeWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);

    const tabCount = await activeWorkspace.getTabs();
    const tabCountLength = tabCount.length;
    const sidebar = await BackgroundLogic.getView("sidebar");
    if (sidebar.document.querySelector(".workspace-list-entry.active")) {
      sidebar.document.querySelector(".workspace-list-entry.active .tabs-qty").textContent = tabCountLength;
    }
  },

  async createNewWorkspace(active) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    const nextNumber = (await WorkspaceStorage.fetchWorkspacesCountForWindow(windowId)) + 1;

    // const workspace = await Workspace.create(windowId, `Workspace ${nextNumber}`, active || false);
    const workspace = await Workspace.create(windowId, `Workspace ${nextNumber}`, active || false);

    // Re-render context menu
    BackgroundLogic.updateContextMenu();

    return workspace;
  },

  async createNewWorkspaceAndSwitch(active) {
    console.log({ active });
    const workspace = await BackgroundLogic.createNewWorkspace(active);
    await BackgroundLogic.switchToWorkspace(workspace.id);

    console.log(workspace);
    // workspace.active = true;

    return await workspace.toObject();
  },

  async switchToWorkspace(workspaceId, args = {}) {

    console.log({ args });
    console.log({ workspaceId });
    args.commandBased = args.hasOwnProperty("commandBased") ? args.commandBased : false;

    const windowId = await BackgroundLogic.getCurrentWindowId();

    const oldWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
    const newWorkspace = await Workspace.find(workspaceId);

    console.log("switchToWorkSpace: ");
    console.log({ newWorkspace, workspaceId });

    if (oldWorkspace.id == newWorkspace.id && args.commandBased === true) {
      // Nothing to do here
      return;
    }

    // Since we're gonna be closing all open tabs, we need to show the new ones first.
    // However, we first need to prepare the old one, so it can tell which tabs were the original ones and which were opened by the new workspace.
    await oldWorkspace.prepareToHide();
    await newWorkspace.show();
    await oldWorkspace.hide();
  },

  async renameWorkspace(workspaceId, workspaceName) {
    const workspace = await Workspace.find(workspaceId);

    await workspace.rename(workspaceName);

    // Re-render context menu
    BackgroundLogic.updateContextMenu();
  },

  async deleteWorkspace(workspaceId) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    const currentWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
    const workspaceToDelete = await Workspace.find(workspaceId);

    if (currentWorkspace.id == workspaceId) {
      const nextWorkspaceId = await WorkspaceStorage.fetchNextWorkspaceId(windowId, workspaceId);
      await BackgroundLogic.switchToWorkspace(nextWorkspaceId);
    }

    await workspaceToDelete.delete();

    // Re-render context menu
    BackgroundLogic.updateContextMenu();
  },

  async moveTabToWorkspace(tabs, clickedTab, destinationWorkspace) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    let currentWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);

    console.log({ clickedTab });

    let newActiveTab = await currentWorkspace.getTabs();
    // newActiveTab = newActiveTab.filter(tab => tab.highlighted === false && tab.id !== clickedTab.id).pop();
    newActiveTab = newActiveTab.filter(tab => tab.highlighted === false && tab.id !== clickedTab.id);
    newActiveTab = clickedTab.active === true ? newActiveTab.filter(tab => tab.active === false).pop() : newActiveTab.pop();
    console.log({ newActiveTab });
    // newActiveTab.active = true;
    // console.log(currentTabs[]);

    // Attach tab to destination workspace
    // tabs.forEach(tab => await destinationWorkspace.attachTab(tab));
    // await Promise.all();
    // tabs.forEach(tab => await destinationWorkspace.attachTab(tab));
    await Promise.all(tabs.map(tab => destinationWorkspace.attachTab(tab)));

    if (newActiveTab !== undefined) {
      browser.tabs.update(newActiveTab.id, { active: true });
    } else {
      browser.tabs.create({ url: null, active: true });
    }

    // If this is the last tab of the window, we need to switch workspaces
    const tabsInCurrentWindow = await browser.tabs.query({
      windowId: windowId,
      pinned: false
    });

    if (tabsInCurrentWindow.length == 1) {
      await BackgroundLogic.switchToWorkspace(destinationWorkspace.id);
    }

    // Finally, detach tab from source workspace
    // await currentWorkspace.detachTab(tab);
    // tabs.forEach(tab => await currentWorkspace.detachTab(tab));
    await Promise.all(tabs.map(tab => currentWorkspace.detachTab(tab)));

    const sidebar = await BackgroundLogic.getView("sidebar");

    currentWorkspace = await currentWorkspace.toObject();
    destinationWorkspace = await destinationWorkspace.toObject();

    sidebar.document.querySelector(`#ws-${currentWorkspace.id}`).querySelector(".tabs-qty").textContent = currentWorkspace.tabCount;
    sidebar.document.querySelector(`#ws-${destinationWorkspace.id}`).querySelector(".tabs-qty").textContent = destinationWorkspace.tabCount;
  },

  tearDownWindow(windowId) {
    // Don't tear down if the user is closing the browser
    setTimeout(() => {
      WorkspaceStorage.tearDownWindow(windowId);
    }, 5000);
  },

  async getCurrentWindowId() {
    const currentWindow = await browser.windows.getCurrent();

    return currentWindow.id;
  },

  async initializeContextMenu() {
    const menuId = Util.generateUUID();

    browser.menus.create({
      id: menuId,
      title: "Send Tab to Workspace",
      contexts: ["tab"]
    });

    const workspaces = await BackgroundLogic.getWorkspacesForCurrentWindow();
    const workspaceObjects = await Promise.all(workspaces.map(workspace => workspace.toObject()));
    workspaceObjects.forEach(async (workspace, index) => {

      browser.menus.create({
        title: `${workspace.name} (${workspace.tabCount} tabs)`,
        parentId: menuId,
        id: workspace.id,
        enabled: !workspace.active,
        onclick: BackgroundLogic.handleContextMenuClick
      });
    });

    browser.menus.create({
      parentId: menuId,
      type: "separator"
    });

    browser.menus.create({
      title: "Create new workspace",
      parentId: menuId,
      id: "new-" + menuId,
      onclick: BackgroundLogic.handleContextMenuClick
    });
  },

  async handleTabsCreated() {
    let workspace = await BackgroundLogic.getCurrentWorkspaceForWindow(await BackgroundLogic.getCurrentWindowId());

    workspace.lastTabGetsClosedNext = false;
    console.log("lastTabGetsClosedNext: " + workspace.lastTabGetsClosedNext);
    // this.name = state.name;
    //   this.active = state.active;
    //   this.hiddenTabs = state.hiddenTabs;
    //   this.windowId = state.windowId;
    //   this.lastTabGetsClosedNext = state.lastTabGetsClosedNext;
    const state = { name: workspace.name, active: workspace.active, hiddenTabs: workspace.hiddenTabs, windowId: workspace.windowId, lastTabGetsClosedNext: workspace.lastTabGetsClosedNext };

    console.log({ state });

    WorkspaceStorage.storeWorkspaceState(workspace.id, state);

    BackgroundLogic.updateContextMenu();
  },

  async handleTabsRemoved(tabId, removeInfo) {
    // await Util.timeout(250);
    let tabCount = (await browser.tabs.query({ hidden: false, active: false })).length;
    let workspace = await BackgroundLogic.getCurrentWorkspaceForWindow(await BackgroundLogic.getCurrentWindowId());

    console.log({ workspace });

    console.log("handleTabsRemoved()");

    console.log("lastTabGetsClosedNext: " + workspace.lastTabGetsClosedNext);

    if (workspace.lastTabGetsClosedNext) {
      console.log("hide tab again, haha :D");
      let newActiveTab = (await browser.tabs.query({ hidden: false, active: true }))[0];

      console.log(newActiveTab);

      await browser.tabs.create({ url: null, active: true });
      await browser.tabs.hide(newActiveTab.id);
      console.log("step 1 finished");
      console.log("step 2 finished");
    }

    console.log({ tabCount });
    if (tabCount <= 1) {
      // console.log("new Tab created");
      console.log("lastTabGetsClosedNext set to true");
      // console.log({ workspace });
      workspace.lastTabGetsClosedNext = true;

      const state = { name: workspace.name, active: workspace.active, hiddenTabs: workspace.hiddenTabs, windowId: workspace.windowId, lastTabGetsClosedNext: workspace.lastTabGetsClosedNext };
      WorkspaceStorage.storeWorkspaceState(workspace.id, state);
    }



    // browser.tabs.update(newTab.id);
    BackgroundLogic.updateContextMenu();
  },

  // async waitAndGetTabs() {
  //   await Util.timeout(250);
  //   let tabCount;
  //   let tabs = await browser.tabs.query({ hidden: false });
  //   tabCount = tabs.length;

  //   return tabCount;
  // },

  updateContextMenu: Util.debounce(async () => {
    await browser.menus.removeAll();
    await BackgroundLogic.initializeContextMenu();
    await BackgroundLogic.updateTabsCount();
  }, 250),

  async handleContextMenuClick(menu, clickedTab) {
    var destinationWorkspace, tabs;

    console.log({ menu });
    console.log(menu.menuItemId);

    if (menu.menuItemId.substring(0, 3) == "new") {
      destinationWorkspace = await BackgroundLogic.createNewWorkspace(false);
      const sidebar = await BackgroundLogic.getView("sidebar");
      await BackgroundLogic.addToWorkspacesList(sidebar, destinationWorkspace, { "switch": false });
    } else {
      destinationWorkspace = await Workspace.find(menu.menuItemId);
    }

    tabs = await destinationWorkspace.getHighlightedTabs();

    console.log({ tabs, destinationWorkspace });

    // await BackgroundLogic.moveTabToWorkspace(tab, destinationWorkspace);
    await BackgroundLogic.moveTabToWorkspace(tabs, clickedTab, destinationWorkspace);
  },

  async handleCommands(command) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    const workspaces = await WorkspaceStorage.fetchWorkspacesForWindow(windowId);
    const activeWorkspace = workspaces.find(ws => ws.active === true);
    let nextWorkspace;
    let create = false;
    switch (command) {
      case "next-workspace":
        nextWorkspace = workspaces[Util.crawlArray(workspaces, 0, workspaces.indexOf(activeWorkspace) + 1)];
        break;
      case "previous-workspace":
        nextWorkspace = workspaces[Util.crawlArray(workspaces, 0, workspaces.indexOf(activeWorkspace) - 1)];
        break;
      case "create-workspace":
        // nextWorkspace = workspaces[Util.crawlArray(workspaces, 0, workspaces.indexOf(activeWorkspace) - 1)];
        nextWorkspace = await BackgroundLogic.createNewWorkspaceAndSwitch();
        create = true;
        break;
      default:
        break;
    }


    const sidebar = await BackgroundLogic.getView("sidebar");

    if (!create) {
      BackgroundLogic.switchToWorkspace(nextWorkspace.id, { commandsBased: true });
      BackgroundLogic.updateContextMenu();
      sidebar.document.querySelector(`#ws-${activeWorkspace.id}`).classList.remove("active");
      sidebar.document.querySelector(`#ws-${nextWorkspace.id}`).classList.add("active");
    } else {
      BackgroundLogic.addToWorkspacesList(sidebar, nextWorkspace);
    }

  },

  async addToWorkspacesList(view, workspace, args = { "switch": true }) {
    const list = view.document.querySelector("#workspace-list");
    const listItem = BackgroundLogic.createListItem(workspace);
    list.appendChild(listItem);
    if (args.switch === true) {
      view.document.querySelector(`.workspace-list-entry.active`).classList.remove("active");
      view.document.querySelector(`#ws-${workspace.id}`).classList.add("active");
    }
  },

  createListItem(workspace) {

    console.log("createListItem");
    console.log({ workspace });
    console.log(workspace.active);

    const li = document.createElement("li");
    li.id = `ws-${workspace.id}`;
    li.classList.add("workspace-list-entry", "js-switch-workspace");
    if (workspace.active) {
      li.classList.add("active");
    }
    const name = document.createElement("span");
    name.classList.add("workspace-name");
    li.appendChild(name);

    name.textContent = workspace.name;
    li.dataset.workspaceId = workspace.id;

    const input = document.createElement("input");
    input.classList.add("js-edit-workspace-input");
    input.type = "text";
    input.value = workspace.name;
    input.minLength = 1;
    input.maxLength = 20;
    input.disabled = true;
    li.appendChild(input);

    const renameBtn = document.createElement("a");
    renameBtn.classList.add("edit-button", "edit-button-rename", "js-edit-workspace");
    renameBtn.href = "#";
    const editIcon = `<svg id="rename-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
    renameBtn.insertAdjacentHTML('beforeend', editIcon);
    li.appendChild(renameBtn);

    const deleteBtn = document.createElement("a");
    deleteBtn.classList.add("edit-button", "edit-button-delete", "js-delete-workspace");
    deleteBtn.href = "#";
    const deleteIcon = `<svg id="delete-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
    deleteBtn.insertAdjacentHTML('beforeend', deleteIcon);
    li.appendChild(deleteBtn);

    const span = document.createElement("span");
    span.classList.add("tabs-qty");
    span.textContent = workspace.tabCount;
    li.appendChild(span);

    return li;
  },

  async handleAwesomebarSearch(text, suggest) {
    suggest(await BackgroundLogic.searchTabs(text));
  },

  async handleAwesomebarSelection(content, disposition) {
    let windowId, workspaceId, tabIndex;
    [windowId, workspaceId, tabIndex] = content.split(':');

    await browser.windows.update(parseInt(windowId), { focused: true });

    const workspace = await Workspace.find(workspaceId);
    await BackgroundLogic.switchToWorkspace(workspace.id);

    const matchedTabs = await browser.tabs.query({
      windowId: parseInt(windowId),
      index: parseInt(tabIndex)
    });

    if (matchedTabs.length > 0) {
      await browser.tabs.update(matchedTabs[0].id, { active: true });
    }
  },

  async searchTabs(text) {
    if (text.length < 3) {
      return [];
    }

    const windows = await browser.windows.getAll({ windowTypes: ['normal'] })
    const promises = windows.map(windowInfo => BackgroundLogic.searchTabsInWindow(text, windowInfo.id));

    return Util.flattenArray(await Promise.all(promises));
  },

  async searchTabsInWindow(text, windowId) {
    const suggestions = [];

    const workspaces = await BackgroundLogic.getWorkspacesForWindow(windowId);
    const promises = workspaces.map(async workspace => {
      const tabs = await workspace.getTabs();
      tabs.forEach(tab => {
        if (Util.matchesQuery(tab.title, text)) {
          suggestions.push({
            content: `${windowId}:${workspace.id}:${tab.index}`,
            description: tab.title
          });
        }
      });
    });

    await Promise.all(promises);
    return suggestions;
  }

};

BackgroundLogic.init();
