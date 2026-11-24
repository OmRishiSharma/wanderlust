const test = require("node:test");
const assert = require("node:assert/strict");
const { parseListingQuery, escapeRegex } = require("../utils/search");
const { paginate, pageWindow } = require("../utils/pagination");

test("parseListingQuery: empty query gives defaults", () => {
    const { filter, sort, params } = parseListingQuery({});
    assert.deepEqual(filter, {});
    assert.deepEqual(sort, { createdAt: -1, _id: -1 });
    assert.equal(params.sort, "newest");
});

test("parseListingQuery: builds a text filter that is regex-safe", () => {
    const { filter } = parseListingQuery({ q: "a.b(c" });
    assert.equal(filter.$or.length, 4);
    assert.ok(filter.$or[0].title.test("xa.b(cx"));
    assert.ok(!filter.$or[0].title.test("aXb(c")); // '.' must not act as a wildcard
    assert.equal(escapeRegex("a+b"), "a\\+b");
});

test("parseListingQuery: category, price range and sort", () => {
    const { filter, sort } = parseListingQuery({ category: "Beach", minPrice: "500", maxPrice: "2000", sort: "price_desc" });
    assert.equal(filter.category, "Beach");
    assert.deepEqual(filter.price, { $gte: 500, $lte: 2000 });
    assert.equal(sort.price, -1);
});

test("parseListingQuery: ignores hostile / invalid input", () => {
    const { filter, sort } = parseListingQuery({
        q: { $ne: "x" },
        category: "NotACategory",
        minPrice: "-5",
        maxPrice: "abc",
        sort: "__proto__",
    });
    assert.deepEqual(filter, {});
    assert.deepEqual(sort, { createdAt: -1, _id: -1 });
});

test("paginate clamps pages and computes offsets", () => {
    assert.deepEqual(paginate({ page: "2", limit: 12, total: 30 }), {
        page: 2, pages: 3, limit: 12, total: 30, skip: 12, hasPrev: true, hasNext: true,
    });
    assert.equal(paginate({ page: "99", limit: 12, total: 30 }).page, 3);
    assert.equal(paginate({ page: "-4", limit: 12, total: 30 }).page, 1);
    assert.equal(paginate({ page: "abc", limit: 12, total: 0 }).pages, 1);
});

test("pageWindow adds ellipses for long ranges", () => {
    assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
    assert.deepEqual(pageWindow(6, 12), [1, "…", 5, 6, 7, "…", 12]);
});
