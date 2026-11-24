// Pure booking logic (no database access) so it is easy to unit test.
//
// Stays are modelled as half-open date ranges [checkIn, checkOut): the guest
// occupies the nights from checkIn up to, but not including, checkOut. That
// means one guest can check out on the same day another checks in.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 30;

// Strict "YYYY-MM-DD" -> Date at UTC midnight, or null when invalid.
function parseDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function startOfTodayUTC(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nightsBetween(checkIn, checkOut) {
    return Math.round((checkOut - checkIn) / MS_PER_DAY);
}

// Two half-open ranges overlap iff each starts before the other ends.
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}

// Validates the requested stay and returns { error } or { checkIn, checkOut, nights }.
function validateStay({ checkIn, checkOut, now = new Date() }) {
    const start = parseDateOnly(checkIn);
    const end = parseDateOnly(checkOut);
    if (!start || !end) return { error: "Please choose valid check-in and check-out dates." };
    if (start < startOfTodayUTC(now)) return { error: "Check-in cannot be in the past." };
    if (end <= start) return { error: "Check-out must be after check-in." };
    const nights = nightsBetween(start, end);
    if (nights > MAX_NIGHTS) return { error: `Stays are limited to ${MAX_NIGHTS} nights.` };
    return { checkIn: start, checkOut: end, nights };
}

// True when the requested range collides with any existing booking range.
function hasConflict(requested, existing) {
    return existing.some((b) => rangesOverlap(requested.checkIn, requested.checkOut, b.checkIn, b.checkOut));
}

module.exports = {
    MAX_NIGHTS,
    parseDateOnly,
    startOfTodayUTC,
    nightsBetween,
    rangesOverlap,
    validateStay,
    hasConflict,
};
