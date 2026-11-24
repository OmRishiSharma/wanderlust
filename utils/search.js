// Pure helpers that turn query-string input into a safe MongoDB filter + sort.
const { CATEGORIES } = require("../models/Listing");

const SORTS = {
    // _id is a unique tie-breaker so ordering (and therefore pagination) is stable
    newest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: 1 },
    rating: { avgRating: -1, reviewCount: -1, _id: 1 },
};

const SORT_LABELS = {
    newest: "Newest",
    rating: "Top rated",
    price_asc: "Price: low to high",
    price_desc: "Price: high to low",
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Query-string values can arrive as arrays/objects (?q[$ne]=x), so always coerce.
const str = (v) => (typeof v === "string" ? v.trim().slice(0, 100) : "");

function num(v) {
    const n = Number(str(v));
    return str(v) !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

function parseListingQuery(query = {}) {
    const q = str(query.q);
    const category = CATEGORIES.includes(str(query.category)) ? str(query.category) : "";
    const minPrice = num(query.minPrice);
    const maxPrice = num(query.maxPrice);
    const sort = Object.hasOwn(SORTS, str(query.sort)) ? str(query.sort) : "newest";

    const filter = {};
    if (q) {
        const rx = new RegExp(escapeRegex(q), "i");
        filter.$or = [{ title: rx }, { location: rx }, { country: rx }, { description: rx }];
    }
    if (category) filter.category = category;
    if (minPrice !== null || maxPrice !== null) {
        filter.price = {};
        if (minPrice !== null) filter.price.$gte = minPrice;
        if (maxPrice !== null) filter.price.$lte = maxPrice;
    }

    return {
        filter,
        sort: SORTS[sort],
        // normalised values echoed back into the filter form
        params: { q, category, minPrice: minPrice ?? "", maxPrice: maxPrice ?? "", sort },
    };
}

module.exports = { parseListingQuery, SORTS, SORT_LABELS, escapeRegex };
