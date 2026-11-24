const config = require("../config");

/**
 * Verifies a Firebase ID token using Google's Identity Toolkit REST API.
 * This does not require service account private keys, only the Firebase Web API key.
 * 
 * @param {string} idToken - The Firebase ID token sent from the client.
 * @returns {Promise<object>} The decoded user record from Firebase.
 */
async function verifyIdToken(idToken) {
    if (!config.firebase.apiKey) {
        throw new Error("FIREBASE_API_KEY is not configured.");
    }
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.firebase.apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
        }
    );

    const data = await response.json();
    if (!response.ok || !data.users || !data.users[0]) {
        const message = (data.error && data.error.message) || "Invalid or expired Firebase ID token";
        const err = new Error(message);
        err.status = 401;
        throw err;
    }

    return data.users[0];
}

module.exports = {
    verifyIdToken,
    firebaseConfig: config.firebase,
};
