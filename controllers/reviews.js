const Listing = require("../models/Listing");
const Review = require("../models/Review");
const ExpressError = require("../utils/ExpressError");

module.exports.create = async (req, res) => {
    const listing = await Listing.findById(req.params.id).select("owner");
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You can't review your own listing.");
        return res.redirect(`/listings/${listing._id}`);
    }
    try {
        await Review.create({ ...req.body.review, author: req.user._id, listing: listing._id });
    } catch (err) {
        if (err.code === 11000) {
            req.flash("error", "You've already reviewed this stay. Delete your review to write a new one.");
            return res.redirect(`/listings/${listing._id}#reviews`);
        }
        throw err;
    }
    await Review.refreshListingStats(listing._id);
    req.flash("success", "Thanks for your review!");
    res.redirect(`/listings/${listing._id}#reviews`);
};

module.exports.destroy = async (req, res) => {
    const { id, reviewId } = req.params;
    await Review.findOneAndDelete({ _id: reviewId, listing: id });
    await Review.refreshListingStats(id);
    req.flash("success", "Review deleted.");
    res.redirect(`/listings/${id}#reviews`);
};
