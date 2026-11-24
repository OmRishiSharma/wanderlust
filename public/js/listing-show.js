// Listing detail page: location map + live availability / price in the booking card.
(function () {
    "use strict";

    /* ---- Map -------------------------------------------------------------------- */
    var mapEl = document.getElementById("map");
    if (mapEl && typeof L !== "undefined") {
        var lat = parseFloat(mapEl.dataset.lat);
        var lng = parseFloat(mapEl.dataset.lng);
        if (isFinite(lat) && isFinite(lng)) {
            var map = L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], 13);
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &mdash; Street Map'
            }).addTo(map);

            // Branded Wanderlust marker pin
            var brandIcon = L.divIcon({
                className: "wander-pin",
                html: '<div class="pin-inner"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });

            var marker = L.marker([lat, lng], { icon: brandIcon, title: mapEl.dataset.title }).addTo(map);
            var popHtml = '<div class="map-show-pop"><strong>' + (mapEl.dataset.title || "Exact location") + '</strong><span>Provided after booking</span></div>';
            marker.bindPopup(popHtml);

            // Neighborhood area circle for pleasant visual context
            L.circle([lat, lng], {
                color: "#fe424d",
                fillColor: "#fe424d",
                fillOpacity: 0.12,
                weight: 1.5,
                radius: 800
            }).addTo(map);

            var mapDetails = document.querySelector("[data-map-details]");
            if (mapDetails) {
                mapDetails.addEventListener("toggle", function () {
                    if (mapDetails.open) {
                        setTimeout(function () {
                            map.invalidateSize();
                            map.setView([lat, lng], 13);
                        }, 60);
                    }
                });
            }
        }
    }

    /* ---- Booking widget ----------------------------------------------------------- */
    var card = document.querySelector("[data-booking]");
    var dataEl = document.getElementById("booked-data");
    if (!card) return;
    var checkIn = card.querySelector("[data-checkin]");
    var checkOut = card.querySelector("[data-checkout]");
    if (!checkIn || !checkOut) return; // anonymous visitor or the host

    var price = Number(card.dataset.price) || 0;
    var MAX_NIGHTS = 30;
    var booked = [];
    try { booked = JSON.parse(dataEl.textContent); } catch (e) { /* ignore */ }

    var msg = card.querySelector("[data-booking-msg]");
    var totalBox = card.querySelector("[data-booking-total]");
    var submit = card.querySelector("[data-booking-submit]");
    var fmt = function (n) { return "₹" + Number(n).toLocaleString("en-IN"); };

    var toUTC = function (iso) {
        var p = iso.split("-");
        return Date.UTC(+p[0], +p[1] - 1, +p[2]);
    };
    var addDay = function (iso) {
        var d = new Date(toUTC(iso) + 86400000);
        return d.toISOString().slice(0, 10);
    };

    // Same half-open overlap rule as the server (utils/booking.js):
    // two stays clash iff each starts before the other ends.
    function conflicts(inIso, outIso) {
        return booked.some(function (b) { return inIso < b.checkOut && outIso > b.checkIn; });
    }

    function update() {
        var a = checkIn.value, b = checkOut.value;
        if (a) checkOut.min = addDay(a);
        if (a && b && b <= a) { checkOut.value = ""; b = ""; }

        msg.textContent = "";
        totalBox.hidden = true;
        submit.disabled = false;
        if (!a || !b) return;

        var nights = Math.round((toUTC(b) - toUTC(a)) / 86400000);
        if (nights > MAX_NIGHTS) { msg.textContent = "Stays are limited to " + MAX_NIGHTS + " nights."; submit.disabled = true; return; }
        if (conflicts(a, b)) { msg.textContent = "Those dates are already booked. Try different dates."; submit.disabled = true; return; }

        card.querySelector("[data-nights]").textContent = fmt(price) + " × " + nights + " night" + (nights > 1 ? "s" : "");
        card.querySelector("[data-subtotal]").textContent = fmt(price * nights);
        card.querySelector("[data-total]").textContent = fmt(price * nights);
        totalBox.hidden = false;
    }

    checkIn.addEventListener("change", update);
    checkOut.addEventListener("change", update);

    /* ---- Manual Guest Input & Stepper --------------------------------------------- */
    var guestInput = card.querySelector("[data-guest-input]");
    var decBtn = card.querySelector("[data-guest-dec]");
    var incBtn = card.querySelector("[data-guest-inc]");
    var maxGuests = parseInt(card.dataset.maxGuests, 10) || 10;

    if (guestInput && decBtn && incBtn) {
        var syncGuests = function () {
            var val = parseInt(guestInput.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > maxGuests) val = maxGuests;
            guestInput.value = val;
            decBtn.disabled = val <= 1;
            incBtn.disabled = val >= maxGuests;
        };

        decBtn.addEventListener("click", function () {
            var current = parseInt(guestInput.value, 10) || 1;
            if (current > 1) {
                guestInput.value = current - 1;
                syncGuests();
            }
        });

        incBtn.addEventListener("click", function () {
            var current = parseInt(guestInput.value, 10) || 1;
            if (current < maxGuests) {
                guestInput.value = current + 1;
                syncGuests();
            }
        });

        guestInput.addEventListener("input", function () {
            var val = parseInt(guestInput.value, 10);
            if (!isNaN(val)) {
                if (val > maxGuests) guestInput.value = maxGuests;
                decBtn.disabled = val <= 1;
                incBtn.disabled = val >= maxGuests;
            }
        });

        guestInput.addEventListener("blur", function () {
            syncGuests();
        });
    }

    card.querySelector("form").addEventListener("submit", function (e) {
        if (!checkIn.value || !checkOut.value) {
            e.preventDefault();
            msg.textContent = "Please choose your check-in and check-out dates.";
            (checkIn.value ? checkOut : checkIn).focus();
        }
    });
})();
