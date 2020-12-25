if (typeof message === 'undefined') {
    var message = document.createElement("p");
} else {
    message = document.getElementById("tab-workspaces-message");
}

if (!document.getElementById("tab-workspaces-message")) {
    message.id = "tab-workspaces-message";
    message.textContent = "Switched Workspace";
    message.style.padding = "2rem";
    message.style.backgroundColor = "rgba(0 0 0 / 0.75)";
    message.style.color = "#fff";
    message.style.position = "fixed";
    message.style.bottom = "1rem";
    message.style.right = "1rem";
    message.style.borderRadius = "10px";
    document.body.appendChild(message);
    message.style.transition = "opacity 1s linear";
    message.style.display = "block";
    message.style.opacity = "1";

    setTimeout(function () {
        message.style.opacity = "0";
    }, 2000);
    setTimeout(function () {
        console.log("message removed!");
        message.style.display = "none";
    }, 2050);
} else {
    message.style.display = "block";
    message.style.transition = "opacity 1s linear";
    message.style.opacity = "1";

    setTimeout(function () {
        message.style.opacity = "0";
    }, 2000);
    setTimeout(function () {
        console.log("message removed!");
        message.style.display = "none";
    }, 2050);
}


// message.style.opacity = "1";
//  else {
//     message = document.getElementById("tab-worskpaces-message");
// }