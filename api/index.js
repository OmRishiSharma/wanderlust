const mongoose = require("mongoose");
const config = require("../config");
const app = require("../app");

let isConnected = false;

async function connectDB() {
    if (isConnected || mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
    }
    try {
        await mongoose.connect(config.mongoUrl, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
    } catch (err) {
        console.error("MongoDB serverless connection error:", err.message);
    }
}

module.exports = async (req, res) => {
    await connectDB();
    return app(req, res);
};
