# Wanderlust

A full-stack stay-booking app in the spirit of Airbnb. Guests can search, filter, save, book and review stays; hosts can list their own places with photos and a map location. Built with **Express 5, EJS, MongoDB and vanilla JavaScript**, with no front-end framework.

> **Live demo:** _add your deployed URL here_ &nbsp;·&nbsp; **Demo login:** `demo_guest` / `Wanderlust#123`

## Screenshots

_Add screenshots to `docs/` and link them here._

| Home | Explore | Listing | Booking |
|---|---|---|---|
| `docs/home.png` | `docs/explore.png` | `docs/listing.png` | `docs/booking.png` |

## Features

- **Accounts & roles:** sign up / log in / log out (Passport + hashed passwords), `user` and `admin` roles, redirect back to the page you came from after login.
- **Ownership & permissions:** only the host (or an admin) can edit or delete a listing; only an author can delete their review.
- **Search, filter, sort, paginate:** full-text-style search, category chips, price range, four sort orders, 12 per page, all shareable by URL.
- **Image upload:** drag-in file upload with preview and validation (type and 5 MB limit). Stored on Cloudinary when configured, otherwise on local disk.
- **Maps:** each listing is geocoded (OpenStreetMap Nominatim, no API key) and shown on a Leaflet map. The Explore page has a map of the current results.
- **Ratings & reviews:** accessible star input, average and count on every card, rating histogram, one review per guest per listing.
- **Favourites:** heart button with instant (AJAX) toggle that degrades to a normal form post.
- **Bookings:** date picker with live availability and price, server-side overlap protection, "Your trips" page, cancellation by guest or host.
- **Design system:** CSS custom-property tokens, light and dark themes (remembers your choice, respects the OS setting), responsive down to small phones.
- **Motion:** page and cross-document view transitions, staggered scroll-reveal, image shimmer skeletons, toasts, heart pop, count-up stats, animated rating bars. All of it is disabled by `prefers-reduced-motion`.
- **Accessibility:** semantic landmarks, skip link, labelled inputs, visible focus, `aria-live` toasts, keyboard-operable star rating and dialogs.
- **Security:** Helmet + strict CSP, CSRF tokens on every state-changing request, rate limiting (stricter on auth), secure session cookies and a MongoDB session store, Joi validation with unknown-field stripping, regex-escaped search, same-site-only redirects.

## Tech stack

| Layer | Tools |
|---|---|
| Server | Node 20+, Express 5, EJS + ejs-mate layouts |
| Database | MongoDB (Atlas or local) with Mongoose 9 |
| Auth | Passport (local), passport-local-mongoose, express-session + connect-mongo |
| Validation | Joi |
| Uploads | Multer (memory) → Cloudinary or local disk |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim geocoding |
| Security / perf | Helmet, express-rate-limit, compression |
| Tests | Node's built-in test runner (`node:test`) |

## Project structure

```
app.js              Express app (middleware, security, routes). Exported for tests.
server.js           Connects to MongoDB and starts listening (graceful shutdown).
config/             Environment-driven configuration.
models/             Mongoose models: User, Listing, Review, Booking.
controllers/        Request handlers (listings, reviews, bookings, users).
routes/             URL → controller wiring (pages, listings, users).
middleware/         auth guards, CSRF, validation, error handling.
utils/              Pure helpers: booking rules, search parsing, pagination, geocoding, uploads, view helpers.
schemas.js          Joi schemas.
views/              EJS: layouts/, partials/, pages/, listings/, auth/, bookings/.
public/             css/main.css (design system), js/ (progressive enhancement), favicon.
seeds/              Demo data + seed script.
tests/              Unit and HTTP tests.
```

## Getting started

```bash
npm install
cp .env.example .env      # then edit the values (see below)
npm run seed              # loads 29 demo stays, demo users and reviews
npm run dev               # http://localhost:8080
```

`npm run seed` geocodes locations politely (1 request per second, then caches them in `seeds/geo-cache.json`). Use `npm run seed:fast` to skip geocoding. **Seeding wipes listings, reviews and bookings.**

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `MONGO_URL` | yes | MongoDB connection string (local or Atlas) |
| `SESSION_SECRET` | yes | Long random string used to sign session cookies |
| `PORT` | no | Defaults to `8080` |
| `NODE_ENV` | no | `production` enables secure cookies and caching |
| `BASE_URL` | no | Public site URL for the sitemap and canonical links |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | Enable Cloudinary image storage (falls back to `public/uploads`) |
| `SEED_ADMIN_PASSWORD` | no | If set, `npm run seed` also creates an `admin` user |

### Demo accounts (created by the seed)

| Username | Password | Notes |
|---|---|---|
| `demo_guest` | `Wanderlust#123` | Use this one to book and review |
| `demo_host` | `Wanderlust#123` | Owns every seeded listing |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm start` | Production start |
| `npm test` | Run the test suite |
| `npm run seed` / `seed:fast` | Reset and load demo data |

## Booking data model

```
Booking { listing, guest, checkIn, checkOut, guests, nights,
          pricePerNight (snapshot), totalPrice, status: confirmed | cancelled }
```

A stay is a **half-open range `[checkIn, checkOut)`** of UTC dates, so one guest can check out the same day the next checks in. Two stays clash when:

```
existing.checkIn < requested.checkOut  AND  existing.checkOut > requested.checkIn
```

The rule lives in one pure, unit-tested module (`utils/booking.js`) and is mirrored in the browser for instant feedback (`public/js/listing-show.js`). Stays are limited to 30 nights and cannot start in the past. Prices are snapshotted so later price changes don't alter existing bookings.

**Double-booking protection is atomic.** A check-then-insert is racy (in a test, 18 of 20 simultaneous identical requests got through), and transactions alone don't fix it because concurrent inserts of *different* documents don't conflict. Instead, every booking claims one `BookingNight { listing, night, booking }` document per night, and a **unique index on `(listing, night)`** lets MongoDB itself reject any overlap (`services/bookings.js`). If any night is taken, the half-made booking is rolled back. Cancelling frees the nights. It works on standalone MongoDB as well as Atlas, no replica set required. `tests/booking-concurrency.test.js` fires 20 simultaneous bookings, partially overlapping ranges, and real concurrent HTTP requests from two logged-in users, and checks only one wins.

If you have bookings from before this change, run `npm run migrate:slots` once to create their night slots.

## Deployment

**Render (free tier):** push the repo, create a Blueprint from `render.yaml`, and set `MONGO_URL` (Atlas), `BASE_URL` and optionally the Cloudinary keys. In Atlas, allow the host's IPs under *Network Access*.

**Docker:** `docker build -t wanderlust . && docker run -p 8080:8080 --env-file .env wanderlust`

Health check: `GET /healthz`. SEO: `GET /sitemap.xml`, `GET /robots.txt`.

## Ideas for next

A host dashboard with earnings and booking charts, host-approval booking requests, payments, and image galleries with multiple photos per listing.
