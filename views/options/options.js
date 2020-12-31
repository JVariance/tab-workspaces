if (window.matchMedia && !!window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.setAttribute("theme", "dark");
} else {
    document.body.setAttribute("theme", "light");
}

initShowNotificationsCheckbox();

document.addEventListener("click", async e => {
    if (e.target.id === "show-notifications") {
        let bool = await getNotification();
        bool = bool.showNotifications.show;
        await setNotification(!bool);
    }
});

async function getNotification() {
    let val = await browser.storage.local.get("showNotifications");
    return val;
}

async function setNotification(val) {
    let showNotifications = { show: val }
    await browser.storage.local.set({ showNotifications });
}

async function initShowNotificationsCheckbox() {
    let bool = await getNotification();
    bool = bool.showNotifications.show;
    await setNotification(bool);
    document.getElementById("show-notifications").setAttribute("checked", bool);
}