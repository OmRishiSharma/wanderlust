const mongoose = require("mongoose");
const { Schema } = mongoose;

const CATEGORIES = ["Beach", "Mountain", "City", "Villa", "Cabin", "Countryside", "Luxury", "Unique"];
const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1547699224-0924faf995c6?auto=format&fit=crop&w=1200&q=70";

const listingSchema = new Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, required: true, trim: true, maxlength: 4000 },
        image: {
            url: { type: String, default: DEFAULT_IMAGE },
            filename: String, // set for images we host (Cloudinary id / local file name)
        },
        price: { type: Number, required: true, min: 0 },
        location: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true },
        category: { type: String, enum: CATEGORIES, default: "Unique" },
        maxGuests: { type: Number, min: 1, max: 20, default: 4 },
        // GeoJSON point: [longitude, latitude]
        geometry: {
            type: { type: String, enum: ["Point"] },
            coordinates: { type: [Number], default: undefined },
        },
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
        // Denormalised from reviews so cards can show ratings without a join.
        avgRating: { type: Number, default: 0, min: 0, max: 5 },
        reviewCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ avgRating: -1, reviewCount: -1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ owner: 1 });

const Listing = mongoose.model("Listing", listingSchema);
Listing.CATEGORIES = CATEGORIES;
Listing.DEFAULT_IMAGE = DEFAULT_IMAGE;
module.exports = Listing;
