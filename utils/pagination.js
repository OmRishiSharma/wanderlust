// Pure helper: turns a raw page number + totals into everything the views need.
function paginate({ page, limit, total }) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const current = Math.min(Math.max(parseInt(page, 10) || 1, 1), pages);
    return {
        page: current,
        pages,
        limit,
        total,
        skip: (current - 1) * limit,
        hasPrev: current > 1,
        hasNext: current < pages,
    };
}

// Compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 12]
function pageWindow(current, pages, span = 1) {
    const out = [];
    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - current) <= span) out.push(p);
        else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
}

module.exports = { paginate, pageWindow };
