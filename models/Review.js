const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
    {
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true, trim: true, maxlength: 1500 },
        author: { type: Schema.Types.ObjectId, ref: "User", required: true },
        listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    },
    { timestamps: true }
);

// One review per guest per listing.
reviewSchema.index({ listing: 1, author: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

// Recomputes the denormalised rating fields on a listing.
Review.refreshListingStats = async function refreshListingStats(listingId) {
    const Listing = mongoose.model("Listing");
    const [stats] = await Review.aggregate([
        { $match: { listing: new mongoose.Types.ObjectId(String(listingId)) } },
        { $group: { _id: "$listing", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await Listing.findByIdAndUpdate(listingId, {
        avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
        reviewCount: stats ? stats.count : 0,
    });
};

module.exports = Review;
