if (typeof message === 'undefined') {
    var message = undefined;
} else {
    document.getElementById("tab-workspaces-message").remove();
}

message = document.createElement("p");
message.id = "tab-workspaces-message";

appendMessage(message);

function fadeIn(el) {
    el.classList.add('show');
    el.classList.remove('hide');
}
function fadeOut(el) {
    el.classList.add('hide');
    el.classList.remove('show');
}

async function appendMessage(message) {
    let wsName = await browser.storage.local.get("currentWorkspace");
    wsName = wsName.currentWorkspace.name;
    message.textContent = `Switched to:\n${wsName}`;
    document.body.appendChild(message);
    fadeIn(message);
    setTimeout(function () {
        fadeOut(message);
    }, 2000);
}