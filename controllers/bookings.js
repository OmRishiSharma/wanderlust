const Listing = require("../models/Listing");
const Booking = require("../models/Booking");
const ExpressError = require("../utils/ExpressError");
const { validateStay, startOfTodayUTC } = require("../utils/booking");
const { createBooking, cancelBooking } = require("../services/bookings");

const fail = (req, res, id, message) => {
    req.flash("error", message);
    return res.redirect(`/listings/${id}#booking`);
};

// POST /listings/:id/bookings
module.exports.create = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    if (listing.owner.equals(req.user._id)) return fail(req, res, listing._id, "You can't book your own listing.");

    const { checkIn, checkOut, guests } = req.body.booking;
    const stay = validateStay({ checkIn, checkOut });
    if (stay.error) return fail(req, res, listing._id, stay.error);
    if (guests > listing.maxGuests) {
        return fail(req, res, listing._id, `This stay sleeps up to ${listing.maxGuests} guests.`);
    }

    // Atomic: the database's unique (listing, night) index rejects any overlap,
    // even between simultaneous requests. See services/bookings.js.
    const result = await createBooking({ listing, guestId: req.user._id, stay, guests });
    if (result.conflict) return fail(req, res, listing._id, "Sorry, those dates are no longer available.");

    req.flash("success", `Booked! ${stay.nights} night${stay.nights > 1 ? "s" : ""} at ${listing.title}.`);
    res.redirect("/trips");
};

// GET /trips
module.exports.mine = async (req, res) => {
    const today = startOfTodayUTC();
    const bookings = await Booking.find({ guest: req.user._id })
        .populate("listing", "title image location country")
        .sort({ checkIn: -1 })
        .lean();
    const upcoming = bookings.filter((b) => b.status === "confirmed" && b.checkOut > today);
    const past = bookings.filter((b) => !upcoming.includes(b));
    res.render("bookings/trips", { title: "Your trips", upcoming, past, today });
};

// DELETE /bookings/:bookingId  (guest, the listing's host, or an admin)
module.exports.cancel = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId).populate("listing", "owner");
    if (!booking) throw new ExpressError(404, "That booking does not exist.");

    const isGuest = booking.guest.equals(req.user._id);
    const isHost = booking.listing && booking.listing.owner.equals(req.user._id);
    if (!isGuest && !isHost && req.user.role !== "admin") {
        throw new ExpressError(403, "You can't cancel someone else's booking.");
    }
    if (booking.checkOut <= startOfTodayUTC()) {
        req.flash("error", "Past stays can't be cancelled.");
        return res.redirect(isGuest ? "/trips" : `/listings/${booking.listing._id}`);
    }
    await cancelBooking(booking);
    req.flash("success", "Booking cancelled.");
    res.redirect(isGuest ? "/trips" : `/listings/${booking.listing._id}`);
};
