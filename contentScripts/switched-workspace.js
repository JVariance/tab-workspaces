// if (typeof message === 'undefined' && typeof messageText === 'undefined') {
if (typeof message === 'undefined') {
    var message = undefined;
    var messageText = undefined;
    var messageIcon = undefined;
} else {
    console.log("???");
}

document.getElementById("tab-workspaces-message")?.remove();

message = document.createElement("div");
message.id = "tab-workspaces-message";
messageText = document.createElement("p");
messageIcon = document.createElement("div");
messageIcon.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 48 48" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"> <g transform="matrix(1,0,0,1,-56.6627,-61.7354)"> <g id="Dark" transform="matrix(3,0,0,3,56.6627,61.7354)"> <rect x="0" y="0" width="16" height="16" style="fill:none;"/> <clipPath id="_clip1"> <rect x="0" y="0" width="16" height="16"/> </clipPath> <g clip-path="url(#_clip1)"> <g id="page-1"> <g id="artboard"> <g id="group"> <path d="M16,14C16,15.105 15.105,16 14,16L2,16C0.895,16 0,15.105 0,14L0,2C0,0.895 0.895,0 2,0L4,0C5.105,0 6,0.895 6,2L6,3C6,1.895 6.895,1 8,1L9,1C10.105,1 11,1.895 11,3L11,2.987C11.007,1.888 11.9,1 13,1L14,1C15.105,1 16,1.895 16,3L16,14ZM10.641,10.027C10.505,9.982 10.373,9.993 10.243,10.061C10.112,10.129 10.026,10.237 9.983,10.385C9.847,10.84 9.597,11.207 9.231,11.488C8.865,11.769 8.455,11.91 8,11.91C7.545,11.91 7.135,11.769 6.769,11.488C6.403,11.207 6.153,10.84 6.017,10.385C5.974,10.237 5.889,10.129 5.761,10.061C5.634,9.993 5.503,9.982 5.367,10.027C5.226,10.073 5.124,10.162 5.059,10.295C4.994,10.429 4.983,10.567 5.026,10.709C5.226,11.396 5.6,11.95 6.147,12.37C6.695,12.79 7.312,13 8,13C8.688,13 9.306,12.79 9.853,12.37C10.4,11.949 10.773,11.396 10.974,10.709C11.017,10.567 11.007,10.429 10.941,10.295C10.876,10.162 10.776,10.073 10.641,10.027ZM6,9C6.276,9 6.512,8.902 6.707,8.707C6.902,8.512 7,8.276 7,8C7,7.724 6.902,7.488 6.707,7.293C6.512,7.098 6.276,7 6,7C5.724,7 5.488,7.098 5.293,7.293C5.098,7.488 5,7.724 5,8C5,8.276 5.098,8.512 5.293,8.707C5.488,8.902 5.724,9 6,9ZM10,7C9.724,7 9.488,7.098 9.293,7.293C9.098,7.488 9,7.724 9,8C9,8.276 9.098,8.512 9.293,8.707C9.488,8.902 9.724,9 10,9C10.276,9 10.512,8.902 10.707,8.707C10.902,8.512 11,8.276 11,8C11,7.724 10.902,7.488 10.707,7.293C10.512,7.098 10.276,7 10,7ZM10,3C10,2.448 9.552,2 9,2L8,2C7.448,2 7,2.448 7,3L10,3ZM15,3C15,2.448 14.552,2 14,2L13,2C12.448,2 12,2.448 12,3L15,3Z" style="fill:white;"/> </g> </g> </g> </g> </g> </g> </svg>');

message.appendChild(messageIcon);
message.appendChild(messageText);

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
    message.querySelector("p").textContent = `Switched to:\n${wsName}`;
    document.body.appendChild(message);
    fadeIn(message);
    setTimeout(function () {
        fadeOut(message);
    }, 2000);
}