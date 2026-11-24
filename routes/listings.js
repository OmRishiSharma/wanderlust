const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const listings = require("../controllers/listings");
const reviews = require("../controllers/reviews");
const bookings = require("../controllers/bookings");
const users = require("../controllers/users");
const { isLoggedIn, isOwner, isReviewAuthor } = require("../middleware/auth");
const { validateListing, validateReview, validateBooking } = require("../middleware/validate");
const { parseImage } = require("../utils/upload");

router.get("/", wrapAsync(listings.index));
router.post("/", isLoggedIn, parseImage, validateListing, wrapAsync(listings.create));
router.get("/new", isLoggedIn, listings.newForm);

router.get("/:id", wrapAsync(listings.show));
router.put("/:id", isLoggedIn, isOwner, parseImage, validateListing, wrapAsync(listings.update));
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(listings.destroy));
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listings.editForm));

// favourites (toggle)
router.post("/:id/favourite", isLoggedIn, wrapAsync(users.toggleFavourite));

// reviews
router.post("/:id/reviews", isLoggedIn, validateReview, wrapAsync(reviews.create));
router.delete("/:id/reviews/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviews.destroy));

// bookings
router.post("/:id/bookings", isLoggedIn, validateBooking, wrapAsync(bookings.create));

module.exports = router;
