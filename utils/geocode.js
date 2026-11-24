// Free geocoding through OpenStreetMap's Nominatim. Failures are non-fatal:
// a listing without coordinates simply doesn't appear on the map.
const USER_AGENT = "WanderlustPortfolioApp/1.0";

async function geocode(query) {
    if (!query || typeof fetch !== "function") return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        const [hit] = await res.json();
        if (!hit) return null;
        const lng = Number(hit.lon);
        const lat = Number(hit.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return { type: "Point", coordinates: [lng, lat] };
    } catch {
        return null;
    }
}

module.exports = { geocode };
