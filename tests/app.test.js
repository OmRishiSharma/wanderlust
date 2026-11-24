// HTTP-level tests that don't need a database.
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

let server;
let base;
test.before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test("GET /healthz responds", async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, "degraded"); // no DB connection in tests
});

test("unknown routes render a friendly 404", async () => {
    const res = await fetch(`${base}/definitely-not-here`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Lost in transit/);
});

test("security headers are set", async () => {
    const res = await fetch(`${base}/healthz`);
    assert.ok(res.headers.get("content-security-policy").includes("default-src 'self'"));
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("state-changing requests without a CSRF token are rejected", async () => {
    const res = await fetch(`${base}/login`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "username=a&password=b",
    });
    assert.equal(res.status, 403);
});

test("login and signup pages render with a CSRF token", async () => {
    for (const path of ["/login", "/signup"]) {
        const res = await fetch(`${base}${path}`);
        assert.equal(res.status, 200);
        assert.match(await res.text(), /name="csrf-token" content="[a-f0-9]{48}"/);
    }
});

test("protected pages redirect anonymous users to /login", async () => {
    for (const path of ["/listings/new", "/trips", "/favourites"]) {
        const res = await fetch(`${base}${path}`, { redirect: "manual" });
        assert.equal(res.status, 302, path);
        assert.equal(res.headers.get("location"), "/login");
    }
});

test("static pages and assets are served", async () => {
    for (const path of ["/privacy", "/terms", "/css/main.css", "/js/main.js", "/favicon.svg", "/robots.txt", "/vendor/leaflet/leaflet.js"]) {
        const res = await fetch(`${base}${path}`);
        assert.equal(res.status, 200, path);
    }
});
