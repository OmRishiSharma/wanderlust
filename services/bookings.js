// Booking persistence with an atomic double-booking guarantee.
//
// Strategy: create the Booking, then claim one BookingNight slot per night.
// BookingNight has a unique (listing, night) index, so if any night is already
// taken the insert fails; we then roll back what we created and report a
// conflict. Because the uniqueness check happens inside MongoDB, concurrent
// requests cannot both succeed for overlapping dates.
const Booking = require("../models/Booking");
const BookingNight = require("../models/BookingNight");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isDuplicateKey = (err) =>
    err && (err.code === 11000 || (err.writeErrors || []).some((w) => w.code === 11000) || /E11000/.test(err.message || ""));

const nightsOf = (checkIn, nights) =>
    Array.from({ length: nights }, (_, i) => new Date(checkIn.getTime() + i * MS_PER_DAY));

// stay = { checkIn: Date, checkOut: Date, nights: number }
// Returns { booking } on success or { conflict: true } if any night is taken.
async function createBooking({ listing, guestId, stay, guests }) {
    const booking = await Booking.create({
        listing: listing._id,
        guest: guestId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests,
        nights: stay.nights,
        pricePerNight: listing.price,
        totalPrice: stay.nights * listing.price,
    });

    try {
        await BookingNight.insertMany(
            nightsOf(stay.checkIn, stay.nights).map((night) => ({ listing: listing._id, night, booking: booking._id })),
            { ordered: true }
        );
    } catch (err) {
        // Release any nights we managed to claim and drop the half-made booking.
        await Promise.all([
            BookingNight.deleteMany({ booking: booking._id }),
            Booking.deleteOne({ _id: booking._id }),
        ]);
        if (isDuplicateKey(err)) return { conflict: true };
        throw err;
    }
    return { booking };
}

// Marks a booking cancelled, then frees its nights. Status first: if we crash
// in between, the dates stay blocked rather than becoming double-bookable.
async function cancelBooking(booking) {
    booking.status = "cancelled";
    await booking.save();
    await BookingNight.deleteMany({ booking: booking._id });
}

// Creates missing slots for confirmed bookings (e.g. data created before slots existed).
async function backfillSlots() {
    let created = 0;
    for await (const b of Booking.find({ status: "confirmed" }).cursor()) {
        const docs = nightsOf(b.checkIn, b.nights).map((night) => ({ listing: b.listing, night, booking: b._id }));
        for (const d of docs) {
            const res = await BookingNight.updateOne({ listing: d.listing, night: d.night }, { $setOnInsert: d }, { upsert: true });
            if (res.upsertedCount) created++;
        }
    }
    return created;
}

module.exports = { createBooking, cancelBooking, backfillSlots, nightsOf, isDuplicateKey };
