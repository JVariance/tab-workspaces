class Workspace {
  constructor(id, state) {
    this.id = id;

    if (state) {
      this.name = state.name;
      this.active = state.active;
      this.hiddenTabs = state.hiddenTabs;
      this.windowId = state.windowId;
    }
  }

  static async create(windowId, name, active) {
    const workspace = new Workspace(Util.generateUUID(), {
      name: name,
      active: active || false,
      hiddenTabs: [],
      windowId: windowId
    });

    console.log("created Workspace: ");
    console.log({ name, windowId });

    await workspace.storeState();
    await WorkspaceStorage.registerWorkspaceToWindow(windowId, workspace.id);

    return workspace;
  }

  static async find(workspaceId) {
    const workspace = new Workspace(workspaceId);
    await workspace.refreshState();

    return workspace;
  }

  async rename(newName) {
    this.name = newName;
    await this.storeState();
  }

  async getTabs() {
    if (this.active) {
      // Not counting pinned tabs. Should we?
      const tabs = await browser.tabs.query({
        pinned: false,
        windowId: this.windowId,
        hidden: false
      });

      return tabs;
    } else {
      return this.hiddenTabs;
    }
  }

  async toObject() {
    const obj = Object.assign({}, this);
    obj.tabCount = (await this.getTabs()).length;

    return obj;
  }

  // Store hidden tabs in storage
  async prepareToHide() {
    const tabs = await browser.tabs.query({
      windowId: this.windowId,
      pinned: false,
      hidden: false
    });

    tabs.forEach(tab => {
      this.hiddenTabs.push(tab);
    })
  }

  // Hide tabs
  async hide() {
    this.active = false;
    await this.storeState();

    const tabIds = this.hiddenTabs.map(tab => tab.id);
    console.log({ tabIds });
    await browser.tabs.hide(tabIds);
  }

  async show() {

    const hiddenTabs = this.hiddenTabs;
    const tabIds = hiddenTabs?.map(tab => tab.id);

    console.log({ tabIds });

    if (tabIds.length == 0) {
      browser.tabs.create({ url: null, active: true });
    } else {
      await browser.tabs.show(tabIds).then(console.log("Tabs get showed"), err => console.log(err));
      await browser.tabs.update(tabIds[0], { active: true });
    }

    this.hiddenTabs = [];
    this.active = true;
    await this.storeState();
  }

  // Then remove the tabs from the window
  async delete() {
    await WorkspaceStorage.deleteWorkspaceState(this.id);
    await WorkspaceStorage.unregisterWorkspaceToWindow(this.windowId, this.id);
  }

  async attachTab(tab) {
    this.hiddenTabs.push(tab);

    await browser.tabs.show(tab.id);
    await this.storeState();
  }

  async detachTab(tab) {
    // We need to refresh the state because if the active workspace was switched we might have an old reference
    await this.refreshState();

    if (this.active) {
      // If the workspace is currently active, simply remove the tab.
      // await browser.tabs.remove(tab.id);
      await browser.tabs.hide(tab.id);
    } else {
      // Otherwise, forget it from hiddenTabs
      const index = this.hiddenTabs.findIndex(hiddenTab => hiddenTab.id == tab.id);
      if (index > -1) {
        this.hiddenTabs.splice(index, 1);
        await this.storeState();
      }
    }
  }

  async refreshState() {
    const state = await WorkspaceStorage.fetchWorkspaceState(this.id);

    this.name = state.name;
    this.active = state.active;
    this.hiddenTabs = state.hiddenTabs;
    this.windowId = state.windowId;

    // For backwards compatibility
    if (!this.windowId) {
      console.log("Backwards compatibility for", this.name);
      this.windowId = (await browser.windows.getCurrent()).id;
      await this.storeState();
    }
  }

  async storeState() {
    await WorkspaceStorage.storeWorkspaceState(this.id, {
      name: this.name,
      active: this.active,
      hiddenTabs: this.hiddenTabs,
      windowId: this.windowId
    });
  }
}
