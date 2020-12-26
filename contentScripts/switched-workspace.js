if (typeof message === 'undefined') {
    var message = undefined;
} else {
    document.getElementById("tab-workspaces-message").remove();
}

message = document.createElement("p");
message.id = "tab-workspaces-message";
// message.textContent = `Switched to:\n${document.body.getAttribute("tab-workspace-name")}`;
// message.textContent = `Switched to ${window.wrappedJSObject.tabWorkspaceName}`;
// const windowId = await BackgroundLogic.getCurrentWindowId();
// console.log({ windowId });
// let workspaceName = await BackgroundLogic.getCurrentWorkspaceForWindow(windowId);
// workspaceName = workspaceName.name;
// message.textContent = `Switched to ${workspaceName}`;
// browser.runtime.sendMessage({ type: "getWorkspaceName" }).then(msg => console.log(msg.result));
// wsName = undefined;
// console.log({ wsName });
appendMessage(message);

function fadeIn(el) {
    el.classList.add('show');
    el.classList.remove('hide');
}
function fadeOut(el) {
    el.classList.add('hide');
    el.classList.remove('show');
}
async function getWorkspaceName() {
    let wsName = await browser.runtime.sendMessage({ type: "getWorkspaceName" });
    console.log({ wsName });
    return wsName;
}

async function appendMessage(message) {
    // let wsName = await getWorkspaceName();
    // let wsName = await BackgroundLogic.getCurrentWindowId();
    console.log(browser.storage.local.get("current-workspace-name"));
    let wsName = "pups";
    message.textContent = `Switched to ${wsName}`;
    document.body.appendChild(message);
    fadeIn(message);
    setTimeout(function () {
        fadeOut(message);
    }, 2000);

}