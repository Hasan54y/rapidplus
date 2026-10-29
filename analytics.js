// Lightweight, privacy-respecting site analytics: logs a page view on load, and a download_click event when
// an Android/Windows download link is used. Write-only from here — nothing on this page can read this data
// back, only the one admin account can (see firebase/firestore.rules). No cookies, no fingerprinting, no
// cross-site tracking: just path, referrer, a coarse device guess and a timestamp.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cfg = window.RAPID_FIREBASE || {};
const configured = !!cfg.apiKey && !String(cfg.apiKey).startsWith("PASTE");
const db = configured ? getFirestore(getApps().length ? getApp() : initializeApp(cfg)) : null;

function device() {
  return matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
}

function log(type, extra) {
  if (!db) return;
  addDoc(collection(db, "analytics_events"), {
    type,
    path: location.pathname || "/",
    ...(document.referrer ? { ref: document.referrer.slice(0, 200) } : {}),
    device: device(),
    ts: serverTimestamp(),
    ...extra
  }).catch(() => { /* offline or rules not live yet — fail quiet, never block the visitor */ });
}

log("page_view");

document.addEventListener("click", e => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  if (a.matches(".play-badge") || /play\.google\.com\/store\/apps/.test(href)) {
    log("download_click", { platform: "android" });
  } else if (a.matches(".win-btn") || /\.exe(\?|$)/i.test(href)) {
    log("download_click", { platform: "windows" });
  }
}, { capture: true });
