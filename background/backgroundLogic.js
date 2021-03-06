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

    browser.tabs.onCreated.addListener(BackgroundLogic.handleTabsCreated);
    browser.tabs.onRemoved.addListener(BackgroundLogic.handleTabsRemoved);

    browser.omnibox.onInputChanged.addListener(BackgroundLogic.handleAwesomebarSearch);
    browser.omnibox.onInputEntered.addListener(BackgroundLogic.handleAwesomebarSelection);

    browser.commands.onCommand.addListener(BackgroundLogic.handleCommands);
  },

  workspaceDeleted: false,

  async getWorkspacesForCurrentWindow() {
    return await BackgroundLogic.getWorkspacesForWindow(await BackgroundLogic.getCurrentWindowId());
  },

  async getWorkspacesForWindow(windowId) {
    const workspaces = await WorkspaceStorage.fetchWorkspacesForWindow(windowId);

    if (workspaces.length > 0) {
      return workspaces;
    } else {
      const defaultWorkspace = await BackgroundLogic.createNewWorkspace(true, true);
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
    let activeWorkspace = undefined;

    while (activeWorkspace === undefined) {
      activeWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
    }

    let tabCount = await activeWorkspace.getTabs();
    tabCount = tabCount.length;
    if (await browser.sidebarAction.isOpen({})) {
      const sidebar = await BackgroundLogic.getView("sidebar");
      if (sidebar.document.querySelector(".workspace-list-entry.active")) {
        sidebar.document.querySelector(".workspace-list-entry.active .tabs-qty").textContent = tabCount;
      }
    }
  },

  async createNewWorkspace(active = false, defaultWorkspace = false) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    const nextNumber = (await WorkspaceStorage.fetchWorkspacesCountForWindow(windowId)) + 1;

    let lastTabGetsClosedNext = true;

    if (defaultWorkspace) {
      let tabs = await browser.tabs.query({ windowId, hidden: false });
      if (tabs.length > 1) {
        lastTabGetsClosedNext = false;
      }
    }

    const workspace = await Workspace.create(windowId, `Workspace ${nextNumber}`, active, lastTabGetsClosedNext);

    // Re-render context menu
    BackgroundLogic.updateContextMenu();

    return workspace;
  },

  async createNewWorkspaceAndSwitch(active) {

    const workspace = await BackgroundLogic.createNewWorkspace(active);
    let newWorkspace = await BackgroundLogic.switchToWorkspace(workspace.id);

    await BackgroundLogic.addToWorkspacesList(newWorkspace);

    return await newWorkspace.toObject();
  },

  async switchToWorkspace(workspaceId, args = { commandBased: false }) {

    const windowId = await BackgroundLogic.getCurrentWindowId();

    const oldWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
    const newWorkspace = await Workspace.find(workspaceId);

    if (oldWorkspace.id == newWorkspace.id && args.commandBased === true) {
      // Nothing to do here
      return;
    }

    // Since we're gonna be closing all open tabs, we need to show the new ones first.
    // However, we first need to prepare the old one, so it can tell which tabs were the original ones and which were opened by the new workspace.
    await oldWorkspace.saveLastActiveTab();
    await oldWorkspace.prepareToHide();
    await newWorkspace.show();
    await oldWorkspace.hide();
    await newWorkspace.showLastActiveTab();

    const currentWorkspace = {
      name: newWorkspace.name
    }

    browser.storage.local.set({ currentWorkspace });

    let showNotifications = await browser.storage.local.get("showNotifications");

    if (Object.keys(showNotifications).length === 0 && showNotifications.constructor === Object) {
      console.log("showNotifications ist leer!");
      showNotifications = {
        show: true
      }
      await browser.storage.local.set({ showNotifications });
      showNotifications = await browser.storage.local.get("showNotifications");
    }

    showNotifications = showNotifications.showNotifications;

    if (showNotifications.show) {
      browser.tabs.insertCSS({ file: "/contentScripts/switched-workspace.css" });
      browser.tabs.executeScript({ file: "/contentScripts/switched-workspace.js" });
    }

    return newWorkspace;
  },

  async renameWorkspace(workspaceId, workspaceName) {
    const workspace = await Workspace.find(workspaceId);

    await workspace.rename(workspaceName);

    // Re-render context menu
    BackgroundLogic.updateContextMenu();
  },

  deleteTimeout: false,

  tabsToRemove: [],

  async deleteWorkspace(workspaceId) {

    if (!BackgroundLogic.deleteTimeout) {
      BackgroundLogic.deleteTimeout = true;
      BackgroundLogic.workspaceDeleted = true;

      let workspaces = await BackgroundLogic.getWorkspacesForCurrentWindow();
      let activeWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(await BackgroundLogic.getCurrentWindowId());
      let currentWorkspaceIndex = workspaces.findIndex(ws => ws.id === workspaceId);
      if (currentWorkspaceIndex < 0) {
        return;
      }
      let newWorkspaceIndex = (workspaces[Util.crawlArray(workspaces, 0, currentWorkspaceIndex - 1)]).id;
      console.log({ workspaces, activeWorkspace, currentWorkspaceIndex, newWorkspaceIndex });
      if (newWorkspaceIndex !== activeWorkspace.id) {
        await BackgroundLogic.switchToWorkspace(newWorkspaceIndex);
        console.log("switched");
      }

      let views = await BackgroundLogic.getViewsArray();
      views.map(function (view) {
        let workspaceList = view.document.getElementById("workspace-list");
        let index = Array.from(workspaceList.querySelectorAll(".workspace-list-entry")).findIndex(ws => ws.id === `ws-${workspaceId}`);

        if (index !== -1) {
          let toBeDeletedWorkspace = workspaceList.querySelector(`#ws-${workspaceId}`);
          let wasActive = toBeDeletedWorkspace.classList.contains("active");
          toBeDeletedWorkspace.remove();
          if (wasActive) {
            Array.from(workspaceList.querySelectorAll(".workspace-list-entry"))[Math.max(index - 1, 0)].classList.add("active");
          }
        }
      });

      const windowId = await BackgroundLogic.getCurrentWindowId();
      const currentWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
      const workspaceToRemove = await Workspace.find(workspaceId);
      BackgroundLogic.tabsToRemove = await workspaceToRemove.getTabs();
      BackgroundLogic.tabsToRemove = BackgroundLogic.tabsToRemove.map(tab => tab.id);

      if (currentWorkspace.id == workspaceId) {
        const nextWorkspaceId = await WorkspaceStorage.fetchNextWorkspaceId(windowId, workspaceId);
        await BackgroundLogic.switchToWorkspace(nextWorkspaceId);
      }

      while (BackgroundLogic.tabsToRemove.length > 0) {
        BackgroundLogic.tabsToRemove = await BackgroundLogic.removeTabs(BackgroundLogic.tabsToRemove);
      }

      await workspaceToRemove.delete();

      // Re-render context menu
      await BackgroundLogic.updateContextMenu();

      BackgroundLogic.workspaceDeleted = false;
      allTabsDeleted = true;
      BackgroundLogic.deleteTimeout = false;

      // let allTabsDeleted = false;
      // while (!allTabsDeleted) {
      //   let allTabIds = await browser.tabs.query({ windowId });
      //   allTabIds = allTabIds.map(tab => tab.id);
      //   let foundSome = BackgroundLogic.tabsToRemove.some(id => allTabIds.includes(id));
      //   if (!foundSome) {
      //     BackgroundLogic.workspaceDeleted = false;
      //     allTabsDeleted = true;
      //     BackgroundLogic.deleteTimeout = false;
      //   }
      // }
    }
  },

  async removeTabs(tabs) {
    await browser.tabs.remove(tabs[0]);
    await BackgroundLogic.updateContextMenu();
    tabs.splice(tabs.indexOf(tabs[0]), 1);

    return tabs;
  },

  async moveTabToWorkspace(tabs, clickedTab, destinationWorkspace) {
    const windowId = await BackgroundLogic.getCurrentWindowId();
    let currentWorkspace = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);

    let newActiveTab = await currentWorkspace.getTabs();
    newActiveTab = newActiveTab.filter(tab => tab.highlighted === false && tab.id !== clickedTab.id);
    newActiveTab = clickedTab.active === true ? newActiveTab.filter(tab => tab.active === false).pop() : newActiveTab.pop();

    // Attach tab to destination workspace
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
    await Promise.all(tabs.map(tab => currentWorkspace.detachTab(tab)));

    const sidebar = await BackgroundLogic.getView("sidebar");

    currentWorkspace = await currentWorkspace.toObject();
    destinationWorkspace = await destinationWorkspace.toObject();

    sidebar.document.querySelector(`#ws-${currentWorkspace.id}`).querySelector(".tabs-qty").textContent = currentWorkspace.tabCount;
    sidebar.document.querySelector(`#ws-${destinationWorkspace.id}`).querySelector(".tabs-qty").textContent = destinationWorkspace.tabCount;
  },

  async renderWorkspacesList(workspaces) {
    const views = await BackgroundLogic.getViewsArray();

    views.map(view => {
      const fragment = document.createDocumentFragment();

      workspaces.forEach(workspace => {
        const li = BackgroundLogic.createListItem(workspace);
        fragment.appendChild(li);
      });

      const list = view.document.querySelector("#workspace-list");
      list.innerHTML = '';
      list.appendChild(fragment);
    });
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

  async getViewsArray() {

    let views = [];
    const sidebar = await BackgroundLogic.getView("sidebar");
    const popup = await BackgroundLogic.getView("popup");

    views.push(sidebar);
    views.push(popup);
    views = views.filter(Boolean);

    return views;
  },

  async initializeContextMenu() {
    const menuId = Util.generateUUID();

    browser.menus.create({
      id: menuId,
      title: "Send Tab(s) to Workspace",
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

  lastTabClosed: false,

  async handleTabsCreated(tab) {
    let workspace = await BackgroundLogic.getCurrentWorkspaceForWindow(await BackgroundLogic.getCurrentWindowId());
    let getting = await browser.tabs.get(tab.id).catch(err => console.log(err));
    let tabCount = (await browser.tabs.query({ hidden: false, active: false })).length;

    tabCount += getting === undefined ? 0 : 1;

    if (BackgroundLogic.lastTabClosed) {
      workspace.lastTabGetsClosedNext = true;
    } else {
      if (tabCount > 1) {
        workspace.lastTabGetsClosedNext = false;
      }
    }

    workspace.lastActiveTab = await workspace.getActiveTab();

    const state = { name: workspace.name, active: workspace.active, hiddenTabs: workspace.hiddenTabs, windowId: workspace.windowId, lastTabGetsClosedNext: workspace.lastTabGetsClosedNext, lastActiveTab: workspace.lastActiveTab };
    WorkspaceStorage.storeWorkspaceState(workspace.id, state);

    BackgroundLogic.updateContextMenu();
    BackgroundLogic.lastTabClosed = false;
  },

  async handleTabsRemoved() {

    if (!BackgroundLogic.workspaceDeleted) {

      if (BackgroundLogic.workspaceDeleted === false) {
        let tabCount = (await browser.tabs.query({ hidden: false, active: false })).length;
        let workspace = await BackgroundLogic.getCurrentWorkspaceForWindow(await BackgroundLogic.getCurrentWindowId());

        if (workspace.lastTabGetsClosedNext) {
          let newActiveTab = (await browser.tabs.query({ hidden: false, active: true }))[0];
          await browser.tabs.create({ url: null, active: true });
          await browser.tabs.hide(newActiveTab.id);
          BackgroundLogic.lastTabClosed = true;
        }

        if (tabCount <= 1) {
          workspace.lastTabGetsClosedNext = true;
          workspace.lastActiveTab = await workspace.getActiveTab();

          const state = { name: workspace.name, active: workspace.active, hiddenTabs: workspace.hiddenTabs, windowId: workspace.windowId, lastTabGetsClosedNext: workspace.lastTabGetsClosedNext, lastActiveTab: workspace.lastActiveTab };
          await WorkspaceStorage.storeWorkspaceState(workspace.id, state);
        }
      }

      await BackgroundLogic.updateContextMenu();
    }
  },

  updateContextMenu: Util.debounce(async () => {
    await browser.menus.removeAll();
    await BackgroundLogic.initializeContextMenu();
    await BackgroundLogic.updateTabsCount();
  }, 250),

  async handleContextMenuClick(menu, clickedTab) {
    var destinationWorkspace, tabs;

    if (menu.menuItemId.substring(0, 3) == "new") {
      destinationWorkspace = await BackgroundLogic.createNewWorkspace(false);
      await BackgroundLogic.addToWorkspacesList(destinationWorkspace, { "switch": false });
    } else {
      destinationWorkspace = await Workspace.find(menu.menuItemId);
    }

    tabs = await destinationWorkspace.getHighlightedTabs();

    const index = tabs.findIndex(tab => tab.id == clickedTab.id);

    if (index < 0) {
      tabs = [clickedTab];
    }

    // if (tabs.length > 0) {
    if (tabs.length > 1) {
      destinationWorkspace.lastTabGetsClosedNext = false;
      const state = { name: destinationWorkspace.name, active: destinationWorkspace.active, hiddenTabs: destinationWorkspace.hiddenTabs, windowId: destinationWorkspace.windowId, lastTabGetsClosedNext: destinationWorkspace.lastTabGetsClosedNext, lastActiveTab: destinationWorkspace.lastActiveTab };
      WorkspaceStorage.storeWorkspaceState(destinationWorkspace.id, state);
    }

    await BackgroundLogic.moveTabToWorkspace(tabs, clickedTab, destinationWorkspace);
  },

  commandTimeOut: false,
  timeoutHandle: setTimeout(function () {
    BackgroundLogic.commandTimeOut = false;
  }, 250),
  setCommandTimeout() {
    clearTimeout(BackgroundLogic.timeoutHandle);
    BackgroundLogic.timeoutHandle = setTimeout(function () {
      BackgroundLogic.commandTimeOut = false;
    }, 250);
  },

  async handleCommands(command) {
    //prevent errors resulting from longpressed keys
    BackgroundLogic.setCommandTimeout();
    if (!BackgroundLogic.commandTimeOut) {
      BackgroundLogic.commandTimeOut = true;
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
          create = true;
          nextWorkspace = await BackgroundLogic.createNewWorkspaceAndSwitch();
          break;
        default:
          break;
      }

      if (!create) {
        if (workspaces.length > 1) {
          BackgroundLogic.switchToWorkspace(nextWorkspace.id, { commandsBased: true });
          BackgroundLogic.updateContextMenu();
          let views = await BackgroundLogic.getViewsArray();
          views.map(view => {
            view.document.querySelector(`#ws-${activeWorkspace.id}`).classList.remove("active");
            view.document.querySelector(`#ws-${nextWorkspace.id}`).classList.add("active");
          });
        }
      }
    }
  },

  async addToWorkspacesList(workspace, args = { switch: true }) {
    let views = await BackgroundLogic.getViewsArray();
    views.map(async (view) => {
      const list = view.document.querySelector("#workspace-list");
      const listItem = BackgroundLogic.createListItem(workspace);
      list.appendChild(listItem);
      if (args.switch === true) {
        view.document.querySelector(`.workspace-list-entry.active`).classList.remove("active");
        view.document.querySelector(`#ws-${workspace.id}`).classList.add("active");
      }
      workspace = await workspace.toObject();
      listItem.querySelector(".tabs-qty").textContent = workspace.tabCount;
    });
  },

  createListItem(workspace) {

    const li = document.createElement("li");
    li.id = `ws-${workspace.id}`;
    li.classList.add("workspace-list-entry", "js-switch-workspace");
    if (workspace.active) {
      li.classList.add("active");
    }
    li.tabIndex = 0;
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
    renameBtn.tabIndex = 0;
    const editIcon = `<svg id="rename-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
    renameBtn.insertAdjacentHTML('beforeend', editIcon);
    li.appendChild(renameBtn);

    const deleteBtn = document.createElement("a");
    deleteBtn.classList.add("edit-button", "edit-button-delete", "js-delete-workspace");
    deleteBtn.href = "#";
    deleteBtn.tabIndex = 0;
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