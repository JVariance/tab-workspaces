const Logic = {

  workspaces: [],


  async init() {
    // We need the workspaces for rendering, so wait for this one
    await Logic.fetchWorkspaces();

    browser.storage.local.get("workspacestheme").then((item) => {
      document.body.setAttribute("theme", item.workspacestheme.name);
      if (item.workspacestheme.name === "light") {
        document.getElementById("theme-switch").checked = false;
      }
    }, (err) => console.log(err));

    Logic.renderWorkspacesList();
    // Logic.renderWorkspacesEdit();
    Logic.registerEventListeners();
  },

  registerEventListeners() {
    document.addEventListener("click", async e => {
      if (e.target.classList.contains("js-switch-theme")) {
        let theme = document.getElementById("theme-switch").checked ? "dark" : "light";
        document.body.setAttribute("theme", theme);

        let workspacestheme = {
          name: theme
        }

        browser.storage.local.set({ workspacestheme }).then((item) => { console.log(item); }, (err) => console.log(err));

      } else if (e.target.classList.contains("js-switch-workspace")) {
        const workspaceId = e.target.dataset.workspaceId;
        Logic.callBackground("switchToWorkspace", {
          workspaceId: workspaceId
        });

        window.close();

      } else if (e.target.classList.contains("js-new-workspace") || e.target.classList.contains("js-plus-icon")) {
        console.log("Workspace hinzugefügt!");
        Logic.callBackground("createNewWorkspaceAndSwitch");

        window.close();

      } else if (e.target.classList.contains("js-switch-panel")) {
        document.querySelectorAll(".container").forEach(el => el.classList.toggle("hide"));

      } else if (e.target.classList.contains("js-edit-workspace")) {
        // const input = e.target.parentNode.childNodes[0];
        const input = e.target.parentNode.querySelector("input");
        input.disabled = false;
        input.focus();

      } else if (e.target.classList.contains("js-delete-workspace")) {
        // Delete element
        const li = e.target.parentNode;
        if (li.parentNode.childNodes.length == 1) {
          // Can't delete the last workspace
          return;
        }

        const workspaceId = li.dataset.workspaceId;
        li.parentNode.removeChild(li);

        // Delete the workspace
        await Logic.callBackground("deleteWorkspace", {
          workspaceId: workspaceId
        });

        // And re-render the list panel
        await Logic.fetchWorkspaces();
        Logic.renderWorkspacesList();
      }
    });

    // document.addEventListener("contextmenu", async e => {
    //   if (e.target.classList.contains("workspace-list-entry")) {
    //     let contextMenu = document.createElement("div"),
    //       deleteBtn = document.createElement("button");
    //     deleteBtn.textContent = "delete";
    //     contextMenu.appendChild(deleteBtn);

    //     console.log("contextmenu");
    //     e.target.appendChild(contextMenu);
    //   }
    // });

    document.addEventListener("change", async e => {
      if (e.target.classList.contains("js-edit-workspace-input")) {
        // Re-disable the input
        const name = e.target.value === "" ? "untitled" : e.target.value;

        console.log({ name });

        // name = name === "" ? "pups" : name;
        e.target.disabled = true;

        // Save new name
        const workspaceId = e.target.parentNode.dataset.workspaceId;
        await Logic.callBackground("renameWorkspace", {
          workspaceId: workspaceId,
          workspaceName: name
        });

        // And re-render the list panel
        await Logic.fetchWorkspaces();
        Logic.renderWorkspacesList();
      }
    });

    document.addEventListener("keydown", async e => {
      console.log("taste gedrückt");
      if (e.key === "Enter") {
        if (document.activeElement.classList.contains("js-edit-workspace-input")) {
          document.activeElement.disabled = true;
        }
      }
    });

    // This focus is needed to capture key presses without user interaction
    document.querySelector("#keyupTrap").focus();
    document.addEventListener("keyup", async e => {
      const key = e.key;
      var index = parseInt(key);

      if (key.length == 1 && !isNaN(index)) {
        if (index == 0) {
          index = 10;
        }

        const el = document.querySelector(`#workspace-list li:nth-child(${index})`);
        if (el) {
          Logic.callBackground("switchToWorkspace", {
            workspaceId: el.dataset.workspaceId
          });

          window.close();
        }
      }

    });
  },

  async fetchWorkspaces() {
    this.workspaces = await Logic.callBackground("getWorkspacesForCurrentWindow");
  },

  async renderWorkspacesList() {
    const fragment = document.createDocumentFragment();

    this.workspaces.forEach(workspace => {
      const li = document.createElement("li");
      li.classList.add("workspace-list-entry", "js-switch-workspace");
      if (workspace.active) {
        li.classList.add("active");
      }
      li.textContent = workspace.name;
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

      fragment.appendChild(li);
    });

    const list = document.querySelector("#workspace-list");
    list.innerHTML = '';
    list.appendChild(fragment);
  },

  // async renderWorkspacesEdit() {
  //   const fragment = document.createDocumentFragment();

  //   this.workspaces.forEach(workspace => {
  //     const li = document.createElement("li");
  //     li.classList.add("workspace-edit-entry");
  //     li.dataset.workspaceId = workspace.id;

  //     const input = document.createElement("input");
  //     input.classList.add("js-edit-workspace-input");
  //     input.type = "text";
  //     input.minLength = "1";
  //     input.setAttribute("maxlength", "20");
  //     input.value = workspace.name;
  //     input.disabled = true;
  //     li.appendChild(input);

  //     const renameBtn = document.createElement("a");
  //     renameBtn.classList.add("edit-button", "edit-button-rename", "js-edit-workspace");
  //     renameBtn.href = "#";
  //     const editIcon = `<svg id="rename-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
  //     renameBtn.insertAdjacentHTML('beforeend', editIcon);
  //     li.appendChild(renameBtn);

  //     const deleteBtn = document.createElement("a");
  //     deleteBtn.classList.add("edit-button", "edit-button-delete", "js-delete-workspace");
  //     deleteBtn.href = "#";
  //     const deleteIcon = `<svg id="delete-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
  //     deleteBtn.insertAdjacentHTML('beforeend', deleteIcon);
  //     li.appendChild(deleteBtn);

  //     fragment.appendChild(li);
  //   });

  //   const list = document.querySelector("#workspace-edit");
  //   list.innerHTML = '';
  //   list.appendChild(fragment);
  // },

  async callBackground(method, args) {
    const message = Object.assign({}, { method }, args);

    if (typeof browser != "undefined") {
      return await browser.runtime.sendMessage(message);
    } else {
      return BackgroundMock.sendMessage(message);
    }
  }

}

Logic.init();
