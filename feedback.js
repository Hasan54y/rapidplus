// Public feedback wall on the homepage: anyone can post a short note, with a name or anonymously, no sign-in
// required. Stored in Firestore ("feedback" collection, public create + read, no update/delete — see
// firebase/firestore.rules). Shown back to every visitor as a slow, auto-scrolling strip of cards.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cfg = window.RAPID_FIREBASE || {};
const configured = !!cfg.apiKey && !String(cfg.apiKey).startsWith("PASTE");
const db = configured ? getFirestore(getApps().length ? getApp() : initializeApp(cfg)) : null;

const slider = document.getElementById("fbSlider");
const track = document.getElementById("fbTrack");
const empty = document.getElementById("fbEmpty");
const form = document.getElementById("fbForm");
const nameInput = document.getElementById("fbName");
const msgInput = document.getElementById("fbMessage");
const status = document.getElementById("fbStatus");

const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function say(el, text, kind) {
  el.textContent = text;
  el.className = "alert " + kind;
  el.hidden = !text;
}

function cardHtml(name, message) {
  const who = (name || "").trim() || "Anonymous";
  return `<div class="fb-card"><div class="fb-top"><div class="fb-avatar">${esc(who.charAt(0).toUpperCase())}</div><div class="fb-name">${esc(who)}</div></div><p>${esc(message)}</p><button type="button" class="fb-more" hidden>Read more</button></div>`;
}

// Fixed card height clamps text to a few lines; only show "Read more" on cards where text actually overflows.
function markOverflow(root) {
  root.querySelectorAll(".fb-card").forEach(card => {
    const p = card.querySelector("p"), btn = card.querySelector(".fb-more");
    if (p && btn) btn.hidden = p.scrollHeight <= p.clientHeight + 1;
  });
}

document.getElementById("fbTrack")?.addEventListener("click", e => {
  const btn = e.target.closest(".fb-more");
  if (!btn) return;
  const card = btn.closest(".fb-card");
  const expanded = card.classList.toggle("expanded");
  btn.textContent = expanded ? "Show less" : "Read more";
});

async function load() {
  if (!db || !slider) return;
  try {
    const snap = await getDocs(query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(30)));
    const items = [];
    snap.forEach(d => items.push(d.data()));
    if (!items.length) { if (empty) empty.hidden = false; slider.hidden = true; return; }
    if (empty) empty.hidden = true;
    slider.hidden = false;
    const html = items.map(d => cardHtml(d.name, d.message)).join("");
    // Duplicated once so a -50% translateX loops seamlessly; pure CSS, no per-frame JS.
    track.innerHTML = html + html;
    track.style.animationDuration = Math.max(24, items.length * 7) + "s";
    requestAnimationFrame(() => markOverflow(track));
  } catch (e) {
    // Rules not published yet, or offline — fail quiet, the form below still lets people try to post.
  }
}
load();

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!db) { say(status, "Feedback isn't set up yet.", "err"); return; }
    const message = msgInput.value.trim();
    if (!message) return;
    const last = +(localStorage.getItem("rp_fb_last") || 0);
    if (Date.now() - last < 60_000) { say(status, "You can share again in a minute.", "info"); return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const name = nameInput.value.trim().slice(0, 60);
      await addDoc(collection(db, "feedback"), {
        ...(name ? { name } : {}),
        message: message.slice(0, 500),
        createdAt: serverTimestamp()
      });
      localStorage.setItem("rp_fb_last", String(Date.now()));
      form.reset();
      say(status, "Thanks for sharing!", "ok");
      load();
    } catch (e) {
      say(status, "Something went wrong. Please try again.", "err");
    } finally {
      btn.disabled = false;
    }
  });
}
