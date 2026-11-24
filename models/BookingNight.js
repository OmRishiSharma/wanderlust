const mongoose = require("mongoose");
const { Schema } = mongoose;

// One document per booked night. The unique index on (listing, night) lets the
// database itself guarantee that two confirmed bookings can never share a night,
// even when requests arrive at the same instant. No application-level locking
// or transactions needed.
const bookingNightSchema = new Schema({
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    night: { type: Date, required: true }, // UTC midnight of the occupied night
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
});

bookingNightSchema.index({ listing: 1, night: 1 }, { unique: true });

module.exports = mongoose.model("BookingNight", bookingNightSchema);
