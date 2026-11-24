const Listing = require("../models/Listing");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const BookingNight = require("../models/BookingNight");
const User = require("../models/User");
const ExpressError = require("../utils/ExpressError");
const { geocode } = require("../utils/geocode");
const { saveImage, removeImage } = require("../utils/upload");
const { paginate, pageWindow } = require("../utils/pagination");
const { parseListingQuery, SORT_LABELS } = require("../utils/search");
const { startOfTodayUTC } = require("../utils/booking");

const PAGE_SIZE = 12;

const toMarker = (l) => ({
    id: String(l._id),
    title: l.title,
    price: l.price,
    image: l.image && l.image.url,
    location: `${l.location}, ${l.country}`,
    coords: l.geometry.coordinates, // [lng, lat]
});

// ---- Home ---------------------------------------------------------------
module.exports.home = async (req, res) => {
    const [featured, latest, categoryCounts, totals, ratingAgg] = await Promise.all([
        Listing.find().sort({ avgRating: -1, reviewCount: -1, createdAt: -1, _id: -1 }).limit(6).lean(),
        Listing.find().sort({ createdAt: -1, _id: -1 }).limit(3).lean(),
        Listing.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
        Listing.aggregate([{ $group: { _id: null, listings: { $sum: 1 }, countries: { $addToSet: "$country" } } }]),
        Listing.aggregate([
            { $match: { reviewCount: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: "$avgRating" } } },
        ]),
    ]);
    const counts = Object.fromEntries(categoryCounts.map((c) => [c._id, c.count]));
    const stats = {
        listings: totals[0] ? totals[0].listings : 0,
        countries: totals[0] ? totals[0].countries.length : 0,
        rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : null,
    };
    res.render("pages/home", {
        title: "Find your next stay",
        description: "Wanderlust is a place to discover and book unique stays around the world.",
        featured,
        latest,
        counts,
        stats,
        categories: Listing.CATEGORIES,
    });
};

// ---- Index (search / filter / sort / paginate) ----------------------------
module.exports.index = async (req, res) => {
    const { filter, sort, params } = parseListingQuery(req.query);
    const total = await Listing.countDocuments(filter);
    const pg = paginate({ page: req.query.page, limit: PAGE_SIZE, total });
    const listings = await Listing.find(filter).sort(sort).skip(pg.skip).limit(PAGE_SIZE).lean();

    let favourites = [];
    if (req.user) favourites = (req.user.favourites || []).map(String);

    const markers = listings.filter((l) => l.geometry && l.geometry.coordinates).map(toMarker);
    const activeFilters = ["q", "category", "minPrice", "maxPrice"].filter((k) => params[k] !== "").length;

    // helper for building links that keep the current filters
    const linkTo = (overrides = {}) => {
        const sp = new URLSearchParams();
        const merged = { ...params, ...overrides };
        for (const [k, v] of Object.entries(merged)) {
            if (v !== "" && v !== null && v !== undefined && !(k === "sort" && v === "newest")) sp.set(k, v);
        }
        const s = sp.toString();
        return "/listings" + (s ? `?${s}` : "");
    };

    res.render("listings/index", {
        title: params.q ? `Search: ${params.q}` : params.category ? `${params.category} stays` : "Explore stays",
        description: "Browse and filter unique stays by location, category and price.",
        listings,
        pg,
        pages: pageWindow(pg.page, pg.pages),
        params,
        activeFilters,
        categories: Listing.CATEGORIES,
        sortLabels: SORT_LABELS,
        favourites,
        markers,
        linkTo,
    });
};

module.exports.newForm = (req, res) => {
    res.render("listings/new", {
        title: "Create a listing",
        categories: Listing.CATEGORIES,
        listing: {},
    });
};

// ---- Show -----------------------------------------------------------------
module.exports.show = async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate("owner", "username createdAt").lean();
    if (!listing) throw new ExpressError(404, "That listing does not exist.");

    const reviews = await Review.find({ listing: listing._id })
        .sort({ createdAt: -1 })
        .populate("author", "username")
        .lean();

    const histogram = [0, 0, 0, 0, 0, 0]; // index = stars
    reviews.forEach((r) => (histogram[r.rating] += 1));

    const today = startOfTodayUTC();
    const upcoming = await Booking.find({ listing: listing._id, status: "confirmed", checkOut: { $gt: today } })
        .select("checkIn checkOut guest")
        .populate("guest", "username")
        .sort({ checkIn: 1 })
        .lean();

    const user = req.user;
    const isOwner = Boolean(user && listing.owner && String(listing.owner._id) === String(user._id));
    const isAdmin = Boolean(user && user.role === "admin");
    const isFavourite = Boolean(user && (user.favourites || []).map(String).includes(String(listing._id)));
    const myReview = user ? reviews.find((r) => r.author && String(r.author._id) === String(user._id)) : null;

    res.render("listings/show", {
        title: listing.title,
        description: listing.description.slice(0, 155),
        ogImage: listing.image && listing.image.url,
        listing,
        reviews,
        histogram,
        booked: upcoming.map((b) => ({
            checkIn: b.checkIn.toISOString().slice(0, 10),
            checkOut: b.checkOut.toISOString().slice(0, 10),
        })),
        // only the host/admin sees who the upcoming guests are
        reservations: isOwner || isAdmin ? upcoming : [],
        isOwner,
        isAdmin,
        isFavourite,
        myReview,
        today: today.toISOString().slice(0, 10),
    });
};

// ---- Create / Update --------------------------------------------------------
module.exports.create = async (req, res) => {
    const data = req.body.listing;
    const image = {};
    if (req.file) Object.assign(image, await saveImage(req.file));
    else if (data.image && data.image.url) image.url = data.image.url;

    const listing = new Listing({ ...data, image, owner: req.user._id });
    const geometry = await geocode(`${data.location}, ${data.country}`);
    if (geometry) listing.geometry = geometry;
    await listing.save();

    req.flash("success", "Your listing is live!");
    res.redirect(`/listings/${listing._id}`);
};

module.exports.editForm = async (req, res) => {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    res.render("listings/edit", {
        title: `Edit ${listing.title}`,
        categories: Listing.CATEGORIES,
        listing,
    });
};

module.exports.update = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    const data = req.body.listing;

    const placeChanged = data.location !== listing.location || data.country !== listing.country;
    const previousImage = listing.image && listing.image.filename ? { ...listing.image.toObject() } : null;

    listing.set({
        title: data.title,
        description: data.description,
        price: data.price,
        location: data.location,
        country: data.country,
        category: data.category,
        maxGuests: data.maxGuests,
    });

    if (req.file) {
        listing.image = await saveImage(req.file);
    } else if (data.image && data.image.url && data.image.url !== listing.image.url) {
        listing.image = { url: data.image.url };
    }
    if (placeChanged || !listing.geometry || !listing.geometry.coordinates) {
        const geometry = await geocode(`${data.location}, ${data.country}`);
        if (geometry) listing.geometry = geometry;
    }
    await listing.save();

    if (previousImage && previousImage.filename !== (listing.image && listing.image.filename)) {
        await removeImage(previousImage);
    }
    req.flash("success", "Listing updated.");
    res.redirect(`/listings/${listing._id}`);
};

// ---- Delete -----------------------------------------------------------------
module.exports.destroy = async (req, res) => {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    await Promise.all([
        Review.deleteMany({ listing: listing._id }),
        Booking.deleteMany({ listing: listing._id }),
        BookingNight.deleteMany({ listing: listing._id }),
        User.updateMany({ favourites: listing._id }, { $pull: { favourites: listing._id } }),
        removeImage(listing.image),
    ]);
    req.flash("success", "Listing deleted.");
    res.redirect("/listings");
};
