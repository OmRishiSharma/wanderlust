const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDateOnly, nightsBetween, rangesOverlap, validateStay, hasConflict, MAX_NIGHTS } = require("../utils/booking");

const d = (s) => new Date(`${s}T00:00:00.000Z`);
const NOW = new Date("2030-01-10T15:30:00Z");

test("parseDateOnly accepts real dates only", () => {
    assert.ok(parseDateOnly("2030-02-28"));
    assert.equal(parseDateOnly("2030-02-30"), null); // not a real day
    assert.equal(parseDateOnly("2030-2-3"), null);
    assert.equal(parseDateOnly("nonsense"), null);
    assert.equal(parseDateOnly(undefined), null);
    assert.equal(parseDateOnly({}), null);
});

test("nightsBetween counts nights", () => {
    assert.equal(nightsBetween(d("2030-03-01"), d("2030-03-04")), 3);
});

test("rangesOverlap: half-open ranges", () => {
    // overlapping
    assert.equal(rangesOverlap(d("2030-03-01"), d("2030-03-05"), d("2030-03-03"), d("2030-03-08")), true);
    // one fully inside the other
    assert.equal(rangesOverlap(d("2030-03-01"), d("2030-03-10"), d("2030-03-03"), d("2030-03-05")), true);
    // identical
    assert.equal(rangesOverlap(d("2030-03-01"), d("2030-03-05"), d("2030-03-01"), d("2030-03-05")), true);
    // back-to-back is allowed: checkout day == next check-in day
    assert.equal(rangesOverlap(d("2030-03-01"), d("2030-03-05"), d("2030-03-05"), d("2030-03-08")), false);
    assert.equal(rangesOverlap(d("2030-03-05"), d("2030-03-08"), d("2030-03-01"), d("2030-03-05")), false);
    // far apart
    assert.equal(rangesOverlap(d("2030-03-01"), d("2030-03-02"), d("2030-04-01"), d("2030-04-02")), false);
});

test("validateStay happy path", () => {
    const r = validateStay({ checkIn: "2030-01-12", checkOut: "2030-01-15", now: NOW });
    assert.equal(r.error, undefined);
    assert.equal(r.nights, 3);
});

test("validateStay allows check-in today", () => {
    const r = validateStay({ checkIn: "2030-01-10", checkOut: "2030-01-11", now: NOW });
    assert.equal(r.error, undefined);
});

test("validateStay rejects bad input", () => {
    assert.match(validateStay({ checkIn: "x", checkOut: "y", now: NOW }).error, /valid/);
    assert.match(validateStay({ checkIn: "2030-01-09", checkOut: "2030-01-12", now: NOW }).error, /past/);
    assert.match(validateStay({ checkIn: "2030-01-15", checkOut: "2030-01-15", now: NOW }).error, /after/);
    assert.match(validateStay({ checkIn: "2030-01-15", checkOut: "2030-01-12", now: NOW }).error, /after/);
});

test("validateStay enforces the maximum stay", () => {
    const ok = validateStay({ checkIn: "2030-02-01", checkOut: "2030-03-03", now: NOW }); // 30 nights
    assert.equal(ok.nights, MAX_NIGHTS);
    const tooLong = validateStay({ checkIn: "2030-02-01", checkOut: "2030-03-04", now: NOW }); // 31 nights
    assert.match(tooLong.error, /limited/);
});

test("hasConflict checks against many bookings", () => {
    const existing = [
        { checkIn: d("2030-03-01"), checkOut: d("2030-03-05") },
        { checkIn: d("2030-03-10"), checkOut: d("2030-03-12") },
    ];
    assert.equal(hasConflict({ checkIn: d("2030-03-04"), checkOut: d("2030-03-06") }, existing), true);
    assert.equal(hasConflict({ checkIn: d("2030-03-05"), checkOut: d("2030-03-10") }, existing), false);
    assert.equal(hasConflict({ checkIn: d("2030-03-11"), checkOut: d("2030-03-13") }, existing), true);
    assert.equal(hasConflict({ checkIn: d("2030-03-01"), checkOut: d("2030-03-02") }, []), false);
});
