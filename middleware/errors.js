const ExpressError = require("../utils/ExpressError");

module.exports.notFound = (req, res, next) => {
    next(new ExpressError(404, "We couldn't find the page you were looking for."));
};

// Central error handler: maps known error types to friendly pages.
// eslint-disable-next-line no-unused-vars
module.exports.errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || "Something went wrong.";

    if (err.name === "CastError") {
        statusCode = 404;
        message = "That page or item does not exist.";
    } else if (err.name === "ValidationError") {
        statusCode = 400;
    } else if (err.code === 11000) {
        statusCode = 409;
        message = "That already exists.";
    } else if (err.type === "entity.too.large") {
        statusCode = 413;
        message = "That request was too large.";
    }

    if (statusCode >= 500) {
        console.error(err);
        message = "Something went wrong on our side. Please try again.";
    }

    // Errors can occur before the template-locals middleware has run (e.g. CSRF,
    // body parsing), so make sure the layout always has what it needs.
    const base = `${req.protocol}://${req.get("host")}`;
    const defaults = {
        currentUser: null,
        success: [],
        error: [],
        currentPath: req.path,
        csrfToken: "",
        description: "Discover and book unique stays around the world.",
        ogImage: undefined,
        canonical: `${base}${req.path}`,
    };
    for (const [k, v] of Object.entries(defaults)) if (res.locals[k] === undefined) res.locals[k] = v;

    const wantsJson = req.xhr || (req.get("accept") || "").includes("application/json");
    if (wantsJson) return res.status(statusCode).json({ error: message });

    res.status(statusCode).render("pages/error", {
        title: statusCode === 404 ? "Page not found" : "Something went wrong",
        statusCode,
        message,
    });
};
