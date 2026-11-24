// Session-backed CSRF protection (synchroniser token pattern).
// A random token lives in the session; every state-changing request must echo
// it back in the _csrf field/query string or the x-csrf-token header.
const crypto = require("crypto");
const ExpressError = require("../utils/ExpressError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = function csrf(req, res, next) {
    if (!req.session) return next(new Error("CSRF protection requires sessions"));
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    res.locals.csrfToken = req.session.csrfToken;

    if (SAFE_METHODS.has(req.method)) return next();

    const sent = (req.body && req.body._csrf) || req.query._csrf || req.get("x-csrf-token");
    if (!sent || !safeEqual(sent, req.session.csrfToken)) {
        return next(new ExpressError(403, "Your session expired or the form was invalid. Please go back, refresh and try again."));
    }
    next();
};
