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
                // let allItems = Array.from(li.parentElement.querySelectorAll(".workspace-list-entry"));
                // li.style.zIndex = "-1";
                // let index = allItems.findIndex(item => item === li);
                // let itemHeight = li.getBoundingClientRect().height;
                // let normalizeItems = [];
                // li.style.opacity = "0";
                // setTimeout(function () {
                //     for (var i = index; i < allItems.length; i++) {
                //         allItems[i].style.transition = `transform 500ms, opacity 500ms`;
                //         allItems[i].style.transitionDelay = `500ms, 0ms`;
                //         allItems[i].style.transform = `translateY(-${itemHeight}px)`;
                //         if (i > index) {
                //             normalizeItems.push(allItems[i]);
                //         }
                //     }
                // }, 500);
                // setTimeout(function () {
                //     for (var i = 0; i < normalizeItems.length; i++) {
                //         normalizeItems[i].style.transition = `unset`;
                //         normalizeItems[i].style.transform = `translateY(0px)`;
                //     }
                //     // li.remove();
                //     // li.style.display = "none";
                // }, 1000);

                // li.classList.add("remove");
                const workspaceId = li.dataset.workspaceId;

                // Delete the workspace
                await Logic.callBackground("deleteWorkspace", {
                    workspaceId: workspaceId
                });
            } else if (e.target.id === "settings") {
                e.preventDefault();
                browser.runtime.openOptionsPage();
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

                // And re-render the list pb anel
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
        await Logic.callBackground("renderWorkspacesList", { workspaces: this.workspaces });
    },

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