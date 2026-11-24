const Listing = require("../models/Listing");
const Review = require("../models/Review");
const ExpressError = require("../utils/ExpressError");
const wrapAsync = require("../utils/wrapAsync");

const isAdmin = (user) => Boolean(user && user.role === "admin");

// Redirects anonymous visitors to the login page and remembers where they were going.
module.exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    if (req.method === "GET") req.session.returnTo = req.originalUrl;
    req.flash("error", "Please log in to continue.");
    res.redirect("/login");
};

// passport clears the session on login, so copy returnTo into res.locals first.
module.exports.saveReturnTo = (req, res, next) => {
    if (req.session.returnTo) res.locals.returnTo = req.session.returnTo;
    next();
};

module.exports.isOwner = wrapAsync(async (req, res, next) => {
    const listing = await Listing.findById(req.params.id).select("owner");
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    if (!listing.owner.equals(req.user._id) && !isAdmin(req.user)) {
        req.flash("error", "You don't have permission to do that.");
        return res.redirect(`/listings/${req.params.id}`);
    }
    next();
});

module.exports.isReviewAuthor = wrapAsync(async (req, res, next) => {
    const review = await Review.findById(req.params.reviewId).select("author");
    if (!review) throw new ExpressError(404, "That review does not exist.");
    if (!review.author.equals(req.user._id) && !isAdmin(req.user)) {
        req.flash("error", "You can only delete your own reviews.");
        return res.redirect(`/listings/${req.params.id}`);
    }
    next();
});

module.exports.isAdmin = isAdmin;
