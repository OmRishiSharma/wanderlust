const mongoose = require("mongoose");
const config = require("./config");
const app = require("./app");

async function start() {
    try {
        await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected to MongoDB (" + (config.mongoUrl.includes("mongodb+srv") ? "Atlas" : "local") + ")");
    } catch (err) {
        if (config.mongoUrl !== "mongodb://127.0.0.1:27017/wanderlust") {
            console.warn("Atlas connection failed: " + err.message + ". Falling back to local MongoDB...");
            await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust", { serverSelectionTimeoutMS: 5000 });
            console.log("Connected to local MongoDB (fallback)");
        } else {
            throw err;
        }
    }

    const server = app.listen(config.port, () => {
        console.log(`Wanderlust running on http://localhost:${config.port} (${config.env})`);
    });

    const shutdown = (signal) => {
        console.log(`${signal} received, shutting down…`);
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
});
