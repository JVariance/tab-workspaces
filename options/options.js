if (window.matchMedia && !!window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.setAttribute("theme", "dark");
} else {
    document.body.setAttribute("theme", "light");
}