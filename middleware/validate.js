const ExpressError = require("../utils/ExpressError");
const schemas = require("../schemas");

// Builds a middleware that validates + sanitises req.body against a Joi schema.
// Unknown keys (e.g. _csrf, injected fields) are stripped, values are coerced.
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body || {}, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
    });
    if (error) {
        throw new ExpressError(400, error.details.map((d) => d.message.replace(/"/g, "")).join(". "));
    }
    req.body = value;
    next();
};

module.exports = {
    validateListing: validate(schemas.listingSchema),
    validateReview: validate(schemas.reviewSchema),
    validateBooking: validate(schemas.bookingSchema),
    validateSignup: validate(schemas.signupSchema),
};
