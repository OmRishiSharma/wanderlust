import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const configEl = document.getElementById("firebase-config");
if (configEl) {
    try {
        const firebaseConfig = JSON.parse(configEl.textContent);
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();

        const googleBtn = document.getElementById("firebase-google-btn");
        if (googleBtn) {
            googleBtn.addEventListener("click", async () => {
                const originalHtml = googleBtn.innerHTML;
                try {
                    googleBtn.disabled = true;
                    googleBtn.classList.add("is-loading");
                    googleBtn.innerHTML = `<span>Connecting to Google…</span>`;

                    const result = await signInWithPopup(auth, provider);
                    const idToken = await result.user.getIdToken();
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

                    const res = await fetch("/auth/firebase", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-csrf-token": csrfToken,
                        },
                        body: JSON.stringify({ idToken }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.error || "Authentication failed");
                    }
                    window.location.href = data.redirect || "/listings";
                } catch (err) {
                    googleBtn.disabled = false;
                    googleBtn.classList.remove("is-loading");
                    googleBtn.innerHTML = originalHtml;
                    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
                        console.info("Firebase Sign-in: popup was closed before completing.");
                    } else {
                        console.error("Firebase Auth Error:", err);
                        alert(err.message || "Failed to sign in with Google. Please try again.");
                    }
                }
            });
        }
    } catch (e) {
        console.error("Failed to initialize Firebase:", e);
    }
}
