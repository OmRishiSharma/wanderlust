// Proves that overlapping bookings fired at the same instant can't both succeed.
// Needs a real MongoDB. Uses a throwaway database (default: local `wanderlust_test`),
// never your real data. Override with TEST_MONGO_URL. Skipped if unreachable.
process.env.NODE_ENV = "test";
const TEST_URL = process.env.TEST_MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust_test";
process.env.MONGO_URL = TEST_URL; // must be set before app/config are loaded

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking");
const BookingNight = require("../models/BookingNight");
const { createBooking, cancelBooking } = require("../services/bookings");
const { validateStay } = require("../utils/booking");

const PASSWORD = "Concurrency#123";
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const stayOf = (a, b) => validateStay({ checkIn: day(a), checkOut: day(b) });

let dbUp = false;
let server, base, host, guests, listing;

test.before(async () => {
    try {
        await mongoose.connect(TEST_URL, { serverSelectionTimeoutMS: 3000 });
        dbUp = true;
    } catch {
        return;
    }
    await mongoose.connection.dropDatabase();
    await Promise.all([User.init(), Listing.init(), Booking.init(), BookingNight.init()]); // build unique indexes first

    host = await User.register(new User({ username: "host", email: "host@test.dev" }), PASSWORD);
    guests = [];
    for (let i = 0; i < 4; i++) guests.push(await User.register(new User({ username: `guest${i}`, email: `g${i}@test.dev` }), PASSWORD));
    listing = await Listing.create({
        title: "Race Cabin", description: "d", location: "X", country: "Y", price: 1000, maxGuests: 4, owner: host._id,
    });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) server.close();
    if (dbUp) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }
});

const slotCount = () => BookingNight.countDocuments({ listing: listing._id });
const bookingCount = (status = "confirmed") => Booking.countDocuments({ listing: listing._id, status });
const reset = () => Promise.all([Booking.deleteMany({}), BookingNight.deleteMany({})]);

test("20 simultaneous bookings for identical dates: exactly one wins", async (t) => {
    if (!dbUp) return t.skip("MongoDB not reachable");
    await reset();
    const stay = stayOf(30, 34); // 4 nights
    const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => createBooking({ listing, guestId: guests[i % 4]._id, stay, guests: 2 }))
    );
    assert.equal(results.filter((r) => r.booking).length, 1);
    assert.equal(results.filter((r) => r.conflict).length, 19);
    assert.equal(await bookingCount(), 1);
    assert.equal(await Booking.countDocuments({ listing: listing._id }), 1, "losing attempts must be rolled back");
    assert.equal(await slotCount(), 4);
});

test("partially overlapping ranges: overlap is impossible, back-to-back is allowed", async (t) => {
    if (!dbUp) return t.skip("MongoDB not reachable");
    for (let round = 0; round < 5; round++) {
        await reset();
        const A = stayOf(40, 44); // nights 40-43
        const B = stayOf(43, 47); // overlaps A on night 43
        const C = stayOf(47, 50); // starts the day B ends: never conflicts with B
        const [a, b, c] = await Promise.all([A, B, C].map((s, i) => createBooking({ listing, guestId: guests[i]._id, stay: s, guests: 1 })));
        assert.ok(Boolean(a.booking) !== Boolean(b.booking), "exactly one of the overlapping pair wins");
        assert.ok(c.booking, "back-to-back booking is allowed");
        const winnerNights = (a.booking ? 4 : 4) + 3;
        assert.equal(await slotCount(), winnerNights);
        assert.equal(await bookingCount(), 2);
    }
});

test("cancelling frees the dates so they can be booked again", async (t) => {
    if (!dbUp) return t.skip("MongoDB not reachable");
    await reset();
    const stay = stayOf(60, 63);
    const first = await createBooking({ listing, guestId: guests[0]._id, stay, guests: 1 });
    assert.ok(first.booking);
    assert.ok((await createBooking({ listing, guestId: guests[1]._id, stay, guests: 1 })).conflict);
    await cancelBooking(first.booking);
    assert.equal(await slotCount(), 0);
    assert.ok((await createBooking({ listing, guestId: guests[1]._id, stay, guests: 1 })).booking);
});

// ---- Same thing end-to-end over HTTP with two real logged-in sessions ----------------
async function login(username) {
    let cookie = "";
    const jar = (res) => {
        for (const c of res.headers.getSetCookie()) {
            const [kv] = c.split(";");
            const name = kv.split("=")[0];
            cookie = cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)).concat(kv).join("; ");
        }
    };
    const token = (html) => html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
    let res = await fetch(`${base}/login`, { headers: { cookie } });
    jar(res);
    let csrf = token(await res.text());
    res = await fetch(`${base}/login?_csrf=${csrf}`, {
        method: "POST", redirect: "manual",
        headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password: PASSWORD }).toString(),
    });
    jar(res);
    assert.equal(res.status, 302);
    res = await fetch(`${base}/listings/${listing._id}`, { headers: { cookie } });
    csrf = token(await res.text());
    return {
        book: (a, b) => fetch(`${base}/listings/${listing._id}/bookings?_csrf=${csrf}`, {
            method: "POST", redirect: "manual",
            headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "booking[checkIn]": day(a), "booking[checkOut]": day(b), "booking[guests]": "2" }).toString(),
        }),
    };
}

test("two logged-in users POST overlapping bookings at the same time: only one succeeds", async (t) => {
    if (!dbUp) return t.skip("MongoDB not reachable");
    await reset();
    const [u1, u2] = await Promise.all([login("guest0"), login("guest1")]);

    for (let round = 0; round < 3; round++) {
        await reset();
        const from = 70 + round * 10;
        // identical dates, and a partially overlapping range, all in flight together
        const responses = await Promise.all([u1.book(from, from + 4), u2.book(from, from + 4), u2.book(from + 2, from + 6)]);
        const locations = responses.map((r) => r.headers.get("location") || "");
        const won = locations.filter((l) => l === "/trips");
        const lost = locations.filter((l) => l.includes("#booking"));
        assert.equal(won.length, 1, `round ${round}: exactly one request wins (got ${locations.join(", ")})`);
        assert.equal(lost.length, 2);
        assert.equal(await bookingCount(), 1);
        assert.ok((await slotCount()) >= 4 && (await slotCount()) <= 4, "only the winner's nights are held");
    }
});
