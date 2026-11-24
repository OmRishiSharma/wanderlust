// Resets the database with demo data:  npm run seed   (add --no-geocode to skip map lookups)
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const config = require("../config");
const User = require("../models/User");
const Listing = require("../models/Listing");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const BookingNight = require("../models/BookingNight");
const { geocode } = require("../utils/geocode");
const { data: sampleListings } = require("./data");

const DEMO_PASSWORD = "Wanderlust#123";
const CACHE_FILE = path.join(__dirname, "geo-cache.json");
const skipGeocode = process.argv.includes("--no-geocode");

const REVIEWERS = ["demo_guest", "maya_travels", "arjun.k", "liam_o", "sofia_r"];
const COMMENTS = [
    [5, "Absolutely stunning. The photos don't do it justice, and the host was wonderfully welcoming."],
    [5, "One of the best stays we've ever had. Spotless, peaceful and exactly as described."],
    [4, "Great location and very comfortable. Would happily come back."],
    [4, "Lovely place with thoughtful touches. Check-in was smooth and easy."],
    [5, "Perfect for a weekend away. We didn't want to leave!"],
    [3, "Nice spot overall, though it was a little noisier than we expected."],
    [4, "Beautiful views and a cosy atmosphere. Great value for money."],
    [5, "Magical. Waking up here was the highlight of our trip."],
    [4, "Clean, well equipped and in a fantastic area. Highly recommend."],
    [3, "Good stay. A couple of small things could be improved, but the host was responsive."],
];

function categorize(title) {
    const t = title.toLowerCase();
    if (/luxury/.test(t)) return "Luxury";
    if (/beach|island/.test(t)) return "Beach";
    if (/mountain|chalet|ski/.test(t)) return "Mountain";
    if (/cabin|treehouse|log/.test(t)) return "Cabin";
    if (/loft|penthouse|apartment|brownstone|canal/.test(t)) return "City";
    if (/villa/.test(t)) return "Villa";
    if (/cottage/.test(t)) return "Countryside";
    return "Unique";
}

// tiny deterministic PRNG so repeated seeds look the same
function rng(seed) {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadGeo() {
    try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { return {}; }
}

async function main() {
    await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 15000 });
    console.log("Connected. Resetting data…");

    await Promise.all([Listing.deleteMany({}), Review.deleteMany({}), Booking.deleteMany({}), BookingNight.deleteMany({})]);
    await User.deleteMany({ username: { $in: ["demo_host", ...REVIEWERS] } });

    const host = await User.register(new User({ username: "demo_host", email: "host@wanderlust.demo" }), DEMO_PASSWORD);
    const reviewers = [];
    for (const name of REVIEWERS) {
        reviewers.push(await User.register(new User({ username: name, email: `${name.replace(/[^a-z0-9]/gi, "")}@wanderlust.demo` }), DEMO_PASSWORD));
    }
    if (process.env.SEED_ADMIN_PASSWORD) {
        await User.deleteMany({ username: "admin" });
        await User.register(new User({ username: "admin", email: "admin@wanderlust.demo", role: "admin" }), process.env.SEED_ADMIN_PASSWORD);
        console.log("Created admin user.");
    }

    const geo = await loadGeo();
    const docs = [];
    for (const item of sampleListings) {
        const place = `${item.location}, ${item.country}`;
        let geometry = geo[place] || null;
        if (!geometry && !skipGeocode) {
            geometry = await geocode(place);
            if (geometry) geo[place] = geometry;
            await sleep(1100); // be polite to Nominatim (max 1 request/second)
            process.stdout.write(geometry ? "." : "x");
        }
        const category = categorize(item.title);
        docs.push({
            ...item,
            category,
            maxGuests: category === "Luxury" || category === "Villa" ? 8 : category === "City" ? 3 : 5,
            owner: host._id,
            ...(geometry ? { geometry } : {}),
        });
    }
    if (!skipGeocode) { fs.writeFileSync(CACHE_FILE, JSON.stringify(geo, null, 2)); console.log(); }

    const listings = await Listing.insertMany(docs);
    console.log(`Inserted ${listings.length} listings.`);

    const rand = rng(42);
    let reviewCount = 0;
    for (const listing of listings) {
        const n = Math.floor(rand() * 5); // 0–4 reviews
        const pool = [...reviewers].sort(() => rand() - 0.5).slice(0, n);
        for (const author of pool) {
            const [rating, comment] = COMMENTS[Math.floor(rand() * COMMENTS.length)];
            await Review.create({ rating, comment, author: author._id, listing: listing._id });
            reviewCount++;
        }
        await Review.refreshListingStats(listing._id);
    }
    console.log(`Inserted ${reviewCount} reviews.`);

    console.log("\nDemo accounts (password for all: " + DEMO_PASSWORD + ")");
    console.log("  host : demo_host   (owns every seeded listing)");
    console.log("  guest: demo_guest  (use this one to book and review)");
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
