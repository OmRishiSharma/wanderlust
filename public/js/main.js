// Site-wide progressive enhancements. Every feature works without this file
// (forms post normally, links navigate); JS only makes things nicer.
(function () {
    "use strict";
    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- Theme toggle ---------------------------------------------------- */
    var themeBtn = $("[data-theme-toggle]");
    if (themeBtn) {
        themeBtn.addEventListener("click", function () {
            var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
        });
    }

    /* ---- Navbar: shadow on scroll + mobile menu ---------------------------- */
    var nav = $("[data-nav]");
    if (nav) {
        var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 8); };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }
    var toggle = $("[data-nav-toggle]");
    var menu = $("#nav-menu");
    if (toggle && menu) {
        var setOpen = function (open) {
            menu.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        };
        toggle.addEventListener("click", function () { setOpen(!menu.classList.contains("is-open")); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
        menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    }
    // close the account dropdown when clicking elsewhere
    document.addEventListener("click", function (e) {
        $$("details.user-menu[open]").forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute("open"); });
    });

    /* ---- Toasts ------------------------------------------------------------- */
    function dismiss(toast) {
        if (!toast || toast.classList.contains("is-leaving")) return;
        toast.classList.add("is-leaving");
        setTimeout(function () { toast.remove(); }, 280);
    }
    $$(".toast").forEach(function (t) {
        setTimeout(function () { dismiss(t); }, t.classList.contains("toast-error") ? 7000 : 4500);
    });
    document.addEventListener("click", function (e) {
        var close = e.target.closest(".toast-close");
        if (close) dismiss(close.closest(".toast"));
    });
    window.showToast = function (message, type) {
        var box = $(".toasts");
        if (!box) return;
        var el = document.createElement("div");
        el.className = "toast toast-" + (type || "success");
        el.setAttribute("role", type === "error" ? "alert" : "status");
        var span = document.createElement("span");
        span.textContent = message;
        el.appendChild(span);
        box.appendChild(el);
        setTimeout(function () { dismiss(el); }, 4500);
    };

    /* ---- Images: shimmer until loaded, graceful fallback on error ------------ */
    function markImage(img) {
        var holder = img.closest(".skeleton");
        if (!holder) return;
        var done = function () { holder.classList.add("is-loaded"); };
        var fail = function () { holder.classList.add("is-failed"); };
        if (img.complete) { img.naturalWidth > 0 ? done() : fail(); return; }
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", fail, { once: true });
    }
    $$(".skeleton img").forEach(markImage);

    /* ---- Scroll-reveal -------------------------------------------------------- */
    var revealEls = $$(".reveal");
    if (revealEls.length && "IntersectionObserver" in window && !reduceMotion) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.remove("is-pending");
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
        revealEls.forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.top > window.innerHeight) { el.classList.add("is-pending"); io.observe(el); }
        });
    }

    /* ---- Count-up numbers ---------------------------------------------------- */
    $$("[data-count]").forEach(function (el) {
        var target = parseInt(el.getAttribute("data-count"), 10);
        if (!target || reduceMotion) return;
        var start = null;
        var duration = 1100;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / duration, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
        }
        el.textContent = "0";
        requestAnimationFrame(step);
    });

    /* ---- Forms: validation, loading state, image preview ----------------------- */
    $$("form[data-validate]").forEach(function (form) {
        form.addEventListener("submit", function (e) {
            if (!form.checkValidity()) {
                e.preventDefault();
                form.classList.add("was-validated");
                var bad = form.querySelector(":invalid");
                if (bad) bad.focus({ preventScroll: false });
            }
        });
    });
    document.addEventListener("submit", function (e) {
        if (e.defaultPrevented) return;
        var btn = e.target.querySelector("button[data-loading-text]");
        if (!btn) return;
        // let the browser start the submission first, then show the spinner
        setTimeout(function () {
            btn.classList.add("is-loading");
            btn.dataset.label = btn.textContent;
            btn.textContent = btn.dataset.loadingText;
        }, 0);
    });
    // back/forward cache: restore buttons
    window.addEventListener("pageshow", function (e) {
        if (!e.persisted) return;
        $$("button.is-loading").forEach(function (b) { b.classList.remove("is-loading"); if (b.dataset.label) b.textContent = b.dataset.label; });
    });

    $$("[data-upload]").forEach(function (box) {
        var input = $("[data-upload-input]", box);
        var preview = $("[data-upload-preview]", box);
        var nameEl = $("[data-upload-name]", box);
        if (!input) return;
        input.addEventListener("change", function () {
            var file = input.files && input.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                input.value = "";
                if (nameEl) nameEl.textContent = "That file is larger than 5 MB. Please choose a smaller one.";
                return;
            }
            if (nameEl) nameEl.textContent = file.name;
            var img = document.createElement("img");
            img.alt = "Selected photo preview";
            img.src = URL.createObjectURL(file);
            preview.textContent = "";
            preview.appendChild(img);
        });
    });

    /* ---- Confirm dialog for destructive forms ----------------------------------- */
    var dialog = $("#confirm-dialog");
    document.addEventListener("submit", function (e) {
        var form = e.target;
        var message = form.getAttribute && form.getAttribute("data-confirm");
        if (!message || form.dataset.confirmed) return;
        if (!dialog || typeof dialog.showModal !== "function") {
            if (!window.confirm(message)) e.preventDefault();
            return;
        }
        e.preventDefault();
        $("#confirm-text").textContent = message;
        dialog.returnValue = "";
        dialog.showModal();
        dialog.addEventListener("close", function onClose() {
            if (dialog.returnValue === "ok") { form.dataset.confirmed = "1"; form.submit(); }
        }, { once: true });
    }, true);

    /* ---- Favourites (AJAX, falls back to normal form post) ------------------------- */
    document.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-fav]");
        if (!btn) return;
        var form = btn.closest("form");
        if (!form || !window.fetch) return;
        e.preventDefault();
        var meta = $('meta[name="csrf-token"]');
        btn.disabled = true;
        fetch(form.action, {
            method: "POST",
            headers: { Accept: "application/json", "X-CSRF-Token": meta ? meta.content : "" },
            credentials: "same-origin"
        }).then(function (res) {
            if (!res.ok) throw new Error("failed");
            return res.json();
        }).then(function (data) {
            btn.classList.toggle("is-on", data.saved);
            btn.setAttribute("aria-pressed", String(data.saved));
            btn.classList.remove("is-pop"); void btn.offsetWidth; btn.classList.add("is-pop");
            var label = $("[data-fav-label]", btn);
            if (label) label.textContent = data.saved ? "Saved" : "Save";
            else btn.setAttribute("aria-label", data.saved ? "Remove from favourites" : "Save to favourites");
            window.showToast(data.saved ? "Saved to your favourites" : "Removed from favourites");
        }).catch(function () {
            form.submit(); // fall back to a full page request
        }).then(function () { btn.disabled = false; });
    });
})();
