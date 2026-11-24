// One-off migration: creates night slots for confirmed bookings made before slots existed.
//   npm run migrate:slots
const mongoose = require("mongoose");
const config = require("../config");
const BookingNight = require("../models/BookingNight");
const { backfillSlots } = require("../services/bookings");

(async () => {
    await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 15000 });
    await BookingNight.syncIndexes(); // make sure the unique (listing, night) index exists
    const created = await backfillSlots();
    console.log(`Backfill complete. Created ${created} missing night slot(s).`);
})()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
