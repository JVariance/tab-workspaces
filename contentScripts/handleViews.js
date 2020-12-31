const Logic = {

    workspaces: [],

    async init() {

        // browser.storage.local.clear();

        // We need the workspaces for rendering, so wait for this one
        await Logic.fetchWorkspaces();

        browser.storage.local.get("workspacestheme").then((item) => {
            if (item.workspacestheme === undefined) {
                item.workspacestheme = {
                    name: "dark"
                }
            }
            document.body.setAttribute("theme", item.workspacestheme.name);
            if (item.workspacestheme.name === "light") {
                document.getElementById("theme-switch").checked = false;
            }
        }, (err) => console.log(err));

        Logic.renderWorkspacesList();
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

                if (e.target.classList.contains("active")) {
                    return;
                }

                const workspaceId = e.target.dataset.workspaceId;
                await Logic.callBackground("switchToWorkspace", {
                    workspaceId: workspaceId
                });

                document.querySelector(".js-switch-workspace.active").classList.remove("active");
                document.querySelector(`#ws-${workspaceId}`).classList.add("active");

            } else if (e.target.classList.contains("js-new-workspace") || e.target.classList.contains("js-plus-icon")) {
                await Logic.callBackground("createNewWorkspaceAndSwitch");
                await Logic.fetchWorkspaces();
            } else if (e.target.classList.contains("js-switch-panel")) {
                document.querySelectorAll(".container").forEach(el => el.classList.toggle("hide"));

            } else if (e.target.classList.contains("js-edit-workspace")) {
                e.target.parentNode.classList.add("edit-mode");
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

                // Delete the workspace
                await Logic.callBackground("deleteWorkspace", {
                    workspaceId: workspaceId
                });
            }
        });

        document.addEventListener("focusin", async e => {
            if (e.target.classList.contains("workspace-list-entry")) {
                let btns = Array.from(e.target.querySelectorAll(".edit-button"));
                btns.map(btn => btn.classList.add("visible"));
            }
            if (e.target.classList.contains("edit-button")) {
                let btns = Array.from(e.target.parentElement.querySelectorAll(".edit-button"));
                btns.map(btn => btn.classList.add("visible"));
            }
        });

        document.addEventListener("focusout", async e => {
            if (e.target.classList.contains("js-edit-workspace-input")) {
                e.target.parentNode.classList.remove("edit-mode");
            }
            if (e.target.classList.contains("workspace-list-entry")) {
                let btns = Array.from(e.target.querySelectorAll(".edit-button"));
                btns.map(btn => btn.classList.remove("visible"));
            }
            if (e.target.classList.contains("edit-button")) {
                let btns = Array.from(e.target.parentElement.querySelectorAll(".edit-button"));
                btns.map(btn => btn.classList.remove("visible"));
            }
        });

        document.addEventListener("change", async e => {
            if (e.target.classList.contains("js-edit-workspace-input")) {
                // Re-disable the input
                const name = e.target.value === "" ? "untitled" : e.target.value;
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
            const li = this.createListItem(workspace);
            fragment.appendChild(li);
        });

        const list = document.querySelector("#workspace-list");
        list.innerHTML = '';
        list.appendChild(fragment);
    },

    async callBackground(method, args) {
        const message = Object.assign({}, { method }, args);

        if (typeof browser != "undefined") {
            return await browser.runtime.sendMessage(message);
        } else {
            return BackgroundMock.sendMessage(message);
        }
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
        input.tabIndex = 0;
        li.appendChild(input);

        const renameBtn = document.createElement("a");
        renameBtn.classList.add("edit-button", "edit-button-rename", "js-edit-workspace");
        renameBtn.href = "#";
        const editIcon = `<svg id="rename-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
        renameBtn.insertAdjacentHTML('beforeend', editIcon);
        renameBtn.tabIndex = 0;
        li.appendChild(renameBtn);

        const deleteBtn = document.createElement("a");
        deleteBtn.classList.add("edit-button", "edit-button-delete", "js-delete-workspace");
        deleteBtn.href = "#";
        const deleteIcon = `<svg id="delete-icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
        deleteBtn.insertAdjacentHTML('beforeend', deleteIcon);
        deleteBtn.tabIndex = 0;
        li.appendChild(deleteBtn);

        const span = document.createElement("span");
        span.classList.add("tabs-qty");
        span.textContent = workspace.tabCount;
        li.appendChild(span);

        return li;
    }
}

Logic.init();