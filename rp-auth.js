// Shared Firebase setup for the sign-in and account pages. Loaded only on those pages, not on the whole site.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cfg = window.RAPID_FIREBASE || {};
export const configured = !!cfg.apiKey && !String(cfg.apiKey).startsWith("PASTE") && !String(cfg.projectId).startsWith("PASTE");

let app = null, auth = null, db = null;
if (configured) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
}
export { auth, db };

const KEY = "rp_user";
/** Only a display hint for the header ("Account" vs "Sign in"); the real check is Firebase on the account page. */
export function remember(user) {
  try { localStorage.setItem(KEY, JSON.stringify({ n: user.displayName || user.email || "Account" })); } catch (e) {}
}
export function forget() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

/** Where to go after signing in. Only our own pages are allowed, so a crafted ?next= can't send people elsewhere. */
export function nextUrl() {
  const n = new URLSearchParams(location.search).get("next") || "";
  return ["account.html", "pricing.html", "download.html"].includes(n) ? n : "account.html";
}

export function show(el, on) { el.hidden = !on; }
