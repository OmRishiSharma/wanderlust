const test = require("node:test");
const assert = require("node:assert/strict");
const { listingSchema, reviewSchema, bookingSchema, signupSchema } = require("../schemas");

const validListing = {
    listing: { title: "Cosy cabin", description: "Nice.", location: "Aspen", country: "USA", price: "1200", maxGuests: "4" },
};

test("listing schema coerces numbers and applies defaults", () => {
    const { error, value } = listingSchema.validate(validListing);
    assert.equal(error, undefined);
    assert.equal(value.listing.price, 1200);
    assert.equal(value.listing.category, "Unique");
});

test("listing schema rejects bad data", () => {
    assert.ok(listingSchema.validate({ listing: { ...validListing.listing, price: -1 } }).error);
    assert.ok(listingSchema.validate({ listing: { ...validListing.listing, title: "" } }).error);
    assert.ok(listingSchema.validate({ listing: { ...validListing.listing, category: "Spaceship" } }).error);
    assert.ok(listingSchema.validate({ listing: { ...validListing.listing, image: { url: "javascript:alert(1)" } } }).error);
    assert.ok(listingSchema.validate({}).error);
});

test("listing schema accepts an empty or http(s) image url", () => {
    assert.equal(listingSchema.validate({ listing: { ...validListing.listing, image: { url: "" } } }).error, undefined);
    assert.equal(listingSchema.validate({ listing: { ...validListing.listing, image: { url: "https://x.test/a.jpg" } } }).error, undefined);
});

test("review schema: rating must be an integer from 1 to 5", () => {
    assert.equal(reviewSchema.validate({ review: { rating: 5, comment: "Great" } }).error, undefined);
    assert.ok(reviewSchema.validate({ review: { rating: 0, comment: "x" } }).error);
    assert.ok(reviewSchema.validate({ review: { rating: 6, comment: "x" } }).error);
    assert.ok(reviewSchema.validate({ review: { rating: 3.5, comment: "x" } }).error);
    assert.ok(reviewSchema.validate({ review: { rating: 3, comment: "" } }).error);
});

test("booking schema", () => {
    assert.equal(bookingSchema.validate({ booking: { checkIn: "2030-01-01", checkOut: "2030-01-02", guests: "2" } }).error, undefined);
    assert.ok(bookingSchema.validate({ booking: { checkIn: "2030-01-01", guests: 2 } }).error);
    assert.ok(bookingSchema.validate({ booking: { checkIn: "a", checkOut: "b", guests: 0 } }).error);
});

test("signup schema", () => {
    assert.equal(signupSchema.validate({ username: "jane_doe", email: "jane@example.com", password: "longenough1" }).error, undefined);
    assert.ok(signupSchema.validate({ username: "x", email: "jane@example.com", password: "longenough1" }).error);
    assert.ok(signupSchema.validate({ username: "jane doe", email: "jane@example.com", password: "longenough1" }).error);
    assert.ok(signupSchema.validate({ username: "jane", email: "not-an-email", password: "longenough1" }).error);
    assert.ok(signupSchema.validate({ username: "jane", email: "jane@example.com", password: "short" }).error);
});
