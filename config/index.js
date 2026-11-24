require("dotenv").config({ quiet: true });

const env = process.env.NODE_ENV || "development";

const config = {
    env,
    isProd: env === "production",
    isTest: env === "test",
    port: Number(process.env.PORT) || 8080,
    mongoUrl: process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust",
    sessionSecret: process.env.SESSION_SECRET || "wanderlust-session-secret-production-fallback",
    baseUrl: process.env.BASE_URL || "",
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    firebase: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    },
};

config.cloudinary.enabled = Boolean(
    config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

config.firebase.enabled = Boolean(
    config.firebase.apiKey && config.firebase.projectId
);

module.exports = config;
