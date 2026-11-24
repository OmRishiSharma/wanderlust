const express = require("express");
const passport = require("passport");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const users = require("../controllers/users");
const bookings = require("../controllers/bookings");
const config = require("../config");
const { isLoggedIn, saveReturnTo } = require("../middleware/auth");
const { validateSignup } = require("../middleware/validate");

// Slow down password guessing / account spam.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) => {
        req.flash("error", "Too many attempts. Please wait a few minutes and try again.");
        res.redirect(req.path === "/signup" ? "/signup" : "/login");
    },
});

router.get("/signup", users.signupForm);
router.post("/signup", authLimiter, validateSignup, wrapAsync(users.signup));

router.get("/login", users.loginForm);
router.post(
    "/login",
    authLimiter,
    saveReturnTo,
    passport.authenticate("local", { failureRedirect: "/login", failureFlash: "Incorrect username or password." }),
    users.login
);
router.post("/auth/firebase", authLimiter, saveReturnTo, wrapAsync(users.firebaseAuth));
router.post("/logout", users.logout);

router.get("/favourites", isLoggedIn, wrapAsync(users.favourites));
router.get("/trips", isLoggedIn, wrapAsync(bookings.mine));
router.delete("/bookings/:bookingId", isLoggedIn, wrapAsync(bookings.cancel));

module.exports = router;
