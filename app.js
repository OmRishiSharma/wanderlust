const path = require("path");
const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const config = require("./config");
const User = require("./models/User");
const csrf = require("./middleware/csrf");
const { notFound, errorHandler } = require("./middleware/errors");
const pagesRouter = require("./routes/pages");
const listingsRouter = require("./routes/listings");
const usersRouter = require("./routes/users");

const app = express();
Object.assign(app.locals, require("./utils/helpers"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.disable("x-powered-by");
if (config.isProd) app.set("trust proxy", 1); // secure cookies behind the host's proxy

// ---- Security + performance ----------------------------------------------------
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://apis.google.com", "https://www.gstatic.com"],
                "script-src-attr": ["'unsafe-inline'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                "font-src": ["'self'", "https://fonts.gstatic.com"],
                "img-src": [
                    "'self'",
                    "data:",
                    "blob:",
                    "https://images.unsplash.com",
                    "https://plus.unsplash.com",
                    "https://*.unsplash.com",
                    "https://unsplash.com",
                    "https://res.cloudinary.com",
                    "https://*.tile.openstreetmap.org",
                    "https://tile.openstreetmap.org",
                    "https://*.basemaps.cartocdn.com",
                    "https://basemaps.cartocdn.com",
                    "https://server.arcgisonline.com",
                    "https://*.googleusercontent.com",
                ],
                "connect-src": [
                    "'self'",
                    "https://*.googleapis.com",
                    "https://*.firebaseio.com",
                    "https://identitytoolkit.googleapis.com",
                    "https://securetoken.googleapis.com",
                    "https://www.gstatic.com",
                    "https://*.google.com",
                ],
                "frame-src": ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
                "form-action": ["'self'"],
                "frame-ancestors": ["'none'"],
                "object-src": ["'none'"],
                "upgrade-insecure-requests": config.isProd ? [] : null,
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
);
app.use(compression());
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        skip: (req) => config.isTest || req.path === "/healthz",
    })
);

// ---- Static files ------------------------------------------------------------------
const staticOpts = { maxAge: config.isProd ? "7d" : 0 };
app.use(express.static(path.join(__dirname, "public"), staticOpts));
app.use("/vendor/leaflet", express.static(path.join(__dirname, "node_modules", "leaflet", "dist"), staticOpts));

// ---- Parsers + sessions ------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100, depth: 3 }));
app.use(methodOverride("_method"));

if (!config.sessionSecret) {
    throw new Error("Missing SESSION_SECRET. Copy .env.example to .env and set it.");
}
app.use(
    session({
        name: "wanderlust.sid",
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: config.isTest
            ? undefined
            : MongoStore.create({ mongoUrl: config.mongoUrl, ttl: 7 * 24 * 60 * 60, touchAfter: 24 * 3600 }),
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: config.isProd,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        },
    })
);
app.use(flash());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(passport.initialize());
app.use(passport.session());

// ---- Template locals ---------------------------------------------------------------
app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.firebaseConfig = config.firebase.enabled ? config.firebase : null;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentPath = req.path;
    res.locals.title = undefined;
    res.locals.description = "Discover and book unique stays around the world.";
    res.locals.ogImage = undefined;
    res.locals.canonical = `${config.baseUrl || `${req.protocol}://${req.get("host")}`}${req.path}`;
    next();
});
app.use(csrf);

// ---- Routes -------------------------------------------------------------------------
app.use("/", pagesRouter);
app.use("/listings", listingsRouter);
app.use("/", usersRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
