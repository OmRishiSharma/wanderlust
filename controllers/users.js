const crypto = require("crypto");
const User = require("../models/User");
const Listing = require("../models/Listing");
const ExpressError = require("../utils/ExpressError");
const { verifyIdToken } = require("../utils/firebase");

module.exports.signupForm = (req, res) => res.render("auth/signup", { title: "Create your account" });

module.exports.signup = async (req, res, next) => {
    const { username, email, password } = req.body;
    try {
        if (await User.exists({ email: email.toLowerCase() })) {
            req.flash("error", "An account with that email already exists.");
            return res.redirect("/signup");
        }
        const user = await User.register(new User({ username, email }), password);
        req.login(user, (err) => {
            if (err) return next(err);
            req.flash("success", `Welcome to Wanderlust, ${user.username}!`);
            res.redirect("/listings");
        });
    } catch (err) {
        if (err.name === "UserExistsError") {
            req.flash("error", err.message);
            return res.redirect("/signup");
        }
        next(err);
    }
};

module.exports.loginForm = (req, res) => res.render("auth/login", { title: "Log in" });

// passport.authenticate() runs before this handler.
module.exports.login = (req, res) => {
    req.flash("success", `Welcome back, ${req.user.username}!`);
    const target = res.locals.returnTo;
    // only allow same-site relative redirects
    res.redirect(target && target.startsWith("/") && !target.startsWith("//") ? target : "/listings");
};

module.exports.firebaseAuth = async (req, res, next) => {
    const { idToken } = req.body;
    if (!idToken) {
        return res.status(400).json({ error: "Missing Firebase ID token." });
    }

    try {
        const fbUser = await verifyIdToken(idToken);
        const email = (fbUser.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ error: "Firebase account did not provide an email address." });
        }

        let user = await User.findOne({ email });
        if (!user) {
            const rawName = (fbUser.displayName || email.split("@")[0]).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 25) || "user";
            let username = rawName;
            let count = 1;
            while (await User.exists({ username })) {
                username = `${rawName.slice(0, 20)}_${count++}`;
            }

            user = new User({ username, email });
            await user.setPassword(crypto.randomBytes(32).toString("hex"));
            await user.save();
        }

        req.login(user, (err) => {
            if (err) return next(err);
            req.flash("success", `Welcome, ${user.username}!`);
            const target = req.session.returnTo || "/listings";
            delete req.session.returnTo;
            res.json({ ok: true, redirect: target.startsWith("/") && !target.startsWith("//") ? target : "/listings" });
        });
    } catch (err) {
        if (err.status === 401) {
            return res.status(401).json({ error: err.message });
        }
        next(err);
    }
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You've been logged out.");
        res.redirect("/");
    });
};

// ---- Favourites ----------------------------------------------------------------
module.exports.favourites = async (req, res) => {
    const user = await User.findById(req.user._id).populate("favourites").lean();
    res.render("listings/favourites", {
        title: "Your favourites",
        listings: (user.favourites || []).filter(Boolean),
        favourites: (user.favourites || []).map((l) => String(l._id)),
    });
};

module.exports.toggleFavourite = async (req, res) => {
    const listing = await Listing.exists({ _id: req.params.id });
    if (!listing) throw new ExpressError(404, "That listing does not exist.");

    const has = (req.user.favourites || []).some((f) => f.equals(req.params.id));
    await User.updateOne(
        { _id: req.user._id },
        has ? { $pull: { favourites: req.params.id } } : { $addToSet: { favourites: req.params.id } }
    );
    const saved = !has;
    const wantsJson = req.xhr || (req.get("accept") || "").includes("application/json");
    if (wantsJson) return res.json({ saved });
    req.flash("success", saved ? "Saved to your favourites." : "Removed from favourites.");
    // go back to where the user was, but only within this site
    let back = "/listings";
    try {
        const ref = new URL(req.get("referer") || "", `${req.protocol}://${req.get("host")}`);
        if (ref.host === req.get("host")) back = ref.pathname + ref.search;
    } catch {
        /* keep default */
    }
    res.redirect(back);
};
