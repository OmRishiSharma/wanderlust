// Runs before first paint (blocking, tiny) so there is no light/dark flash.
(function () {
    var root = document.documentElement;
    root.classList.add("js");
    try {
        var saved = localStorage.getItem("theme");
        var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", dark ? "dark" : "light");
    } catch (e) {
        /* storage blocked: fall back to light */
    }
})();
