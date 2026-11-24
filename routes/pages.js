const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const listings = require("../controllers/listings");
const Listing = require("../models/Listing");
const config = require("../config");

router.get("/", wrapAsync(listings.home));

router.get("/privacy", (req, res) =>
    res.render("pages/privacy", { title: "Privacy policy", description: "How Wanderlust handles your data." })
);
router.get("/terms", (req, res) =>
    res.render("pages/terms", { title: "Terms of use", description: "The rules for using Wanderlust." })
);

// Liveness probe for hosting platforms.
router.get("/healthz", (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp || config.isTest ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp });
});

router.get("/robots.txt", (req, res) => {
    const base = config.baseUrl || `${req.protocol}://${req.get("host")}`;
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /trips\nDisallow: /favourites\nSitemap: ${base}/sitemap.xml\n`);
});

router.get(
    "/sitemap.xml",
    wrapAsync(async (req, res) => {
        const base = config.baseUrl || `${req.protocol}://${req.get("host")}`;
        const items = await Listing.find().select("updatedAt").lean();
        const urls = [
            `<url><loc>${base}/</loc></url>`,
            `<url><loc>${base}/listings</loc></url>`,
            ...items.map((l) => `<url><loc>${base}/listings/${l._id}</loc><lastmod>${l.updatedAt.toISOString()}</lastmod></url>`),
        ];
        res.type("application/xml").send(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`
        );
    })
);

module.exports = router;
