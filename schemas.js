const Joi = require("joi");
const { CATEGORIES } = require("./models/Listing");

const httpUrl = Joi.string().uri({ scheme: ["http", "https"] }).max(2000);

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().trim().max(120).required(),
        description: Joi.string().trim().max(4000).required(),
        location: Joi.string().trim().max(120).required(),
        country: Joi.string().trim().max(80).required(),
        price: Joi.number().min(0).max(10000000).required(),
        category: Joi.string().valid(...CATEGORIES).default("Unique"),
        maxGuests: Joi.number().integer().min(1).max(20).default(4),
        image: Joi.object({ url: httpUrl.allow("", null) }).default({}),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().max(1500).required(),
    }).required(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.string().required(),
        checkOut: Joi.string().required(),
        guests: Joi.number().integer().min(1).max(20).required(),
    }).required(),
});

module.exports.signupSchema = Joi.object({
    username: Joi.string().trim().pattern(/^[A-Za-z0-9_.-]+$/).min(3).max(30).required()
        .messages({ "string.pattern.base": "Username may only contain letters, numbers, dots, dashes and underscores." }),
    email: Joi.string().trim().email().max(120).required(),
    password: Joi.string().min(8).max(128).required(),
});
