// Listings index: filter drawer + lazy-initialised map of the current results.
(function () {
    "use strict";

    var filterBtn = document.querySelector("[data-filter-toggle]");
    var filters = document.getElementById("filters");
    if (filterBtn && filters) {
        filters.hidden = filterBtn.getAttribute("data-initial-open") !== "true" && !/[?&](q|category|minPrice|maxPrice)=/.test(location.search);
        filterBtn.setAttribute("aria-expanded", String(!filters.hidden));
        filterBtn.addEventListener("click", function () {
            filters.hidden = !filters.hidden;
            filterBtn.setAttribute("aria-expanded", String(!filters.hidden));
            if (!filters.hidden) { var first = filters.querySelector("input,select"); if (first) first.focus(); }
        });
    }

    var mapBtn = document.querySelector("[data-map-toggle]");
    var wrap = document.querySelector("[data-map-wrap]");
    var dataEl = document.getElementById("map-data");
    if (!mapBtn || !wrap || !dataEl || typeof L === "undefined") return;

    var markers = [];
    try { markers = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var map = null;

    function popupFor(m) {
        var a = document.createElement("a");
        a.className = "map-pop";
        a.href = "/listings/" + encodeURIComponent(m.id);
        if (m.image) { var img = document.createElement("img"); img.src = m.image; img.alt = ""; a.appendChild(img); }
        var t = document.createElement("strong"); t.textContent = m.title; a.appendChild(t);
        var s = document.createElement("span"); s.textContent = m.location + " · ₹" + Number(m.price).toLocaleString("en-IN") + "/night"; a.appendChild(s);
        return a;
    }

    function initMap() {
        map = L.map("map", { scrollWheelZoom: false });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &mdash; Street Map'
        }).addTo(map);

        var brandIcon = L.divIcon({
            className: "wander-pin",
            html: '<div class="pin-inner"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
        });

        var bounds = [];
        markers.forEach(function (m) {
            var latlng = [m.coords[1], m.coords[0]];
            bounds.push(latlng);
            L.marker(latlng, { icon: brandIcon, title: m.title }).addTo(map).bindPopup(popupFor(m));
        });
        if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }

    mapBtn.addEventListener("click", function () {
        var show = wrap.hidden;
        wrap.hidden = !show;
        mapBtn.setAttribute("aria-pressed", String(show));
        mapBtn.querySelector("span").textContent = show ? "Hide map" : "Map";
        if (show) {
            if (!map) initMap(); else map.invalidateSize();
            wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    });
})();
