const mongoose = require("mongoose");
const { Schema } = mongoose;

// A stay is the half-open range [checkIn, checkOut) of UTC-midnight dates.
// See utils/booking.js for the overlap rule.
const bookingSchema = new Schema(
    {
        listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
        guest: { type: Schema.Types.ObjectId, ref: "User", required: true },
        checkIn: { type: Date, required: true },
        checkOut: { type: Date, required: true },
        guests: { type: Number, required: true, min: 1, max: 20 },
        nights: { type: Number, required: true, min: 1 },
        pricePerNight: { type: Number, required: true, min: 0 }, // snapshot at booking time
        totalPrice: { type: Number, required: true, min: 0 },
        status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    },
    { timestamps: true }
);

// Fast availability lookups for a listing.
bookingSchema.index({ listing: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ guest: 1, checkIn: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
