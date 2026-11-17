// Article alerts: a bell in the blog header. Turning it on stores this browser's push address in Firestore
// (no name, no email). A GitHub Action sends a notification whenever a new article goes live.
const VAPID_PUBLIC = "BHx01329AY7u9whHQgSAWIPOpeRJhy73FF5L6wCEOTVqGdZuu-eUlMwhPU36Q4QzIZ9-ke_mGldH1t32j3p81fg";
const cfg = window.RAPID_FIREBASE || {};
const live = !!(cfg.apiKey && cfg.projectId && VAPID_PUBLIC && !VAPID_PUBLIC.startsWith("__"));
const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const btn = document.getElementById("bnotify");
const DOCS = `projects/${cfg.projectId}/databases/(default)/documents`;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

if (btn && (!supported || !live)) btn.hidden = true;
else if (btn) init();

function b64ToBytes(s) { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); }
function toB64Url(buf) { let s = ""; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sha1hex(s) { const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }

async function save(sub) {
  const j = sub.toJSON(), id = await sha1hex(sub.endpoint);
  const fields = { endpoint: { stringValue: sub.endpoint }, p256dh: { stringValue: j.keys.p256dh }, auth: { stringValue: j.keys.auth }, ua: { stringValue: (navigator.userAgent || "").slice(0, 120) } };
  const r = await fetch(`https://firestore.googleapis.com/v1/${DOCS}:commit?key=${cfg.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{ update: { name: `${DOCS}/push_subscribers/${id}`, fields }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] }] })
  });
  // 409/403: this browser is already on the list
  if (!r.ok && ![403, 409].includes(r.status)) throw new Error("HTTP " + r.status);
}

function init() {
  btn.hidden = false;
  const pop = document.createElement("div");
  pop.className = "npop"; pop.id = "npop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Article alerts");
  pop.innerHTML = '<b>New article alerts</b><p class="np-t"></p><div class="np-row"><button type="button" class="btn primary sm np-go"></button><button type="button" class="btn sm np-x">Close</button></div><p class="np-f">Uses your browser\'s own notifications. No account or email. Turn it off here at any time.</p>';
  document.body.appendChild(pop);
  const text = pop.querySelector(".np-t"), go = pop.querySelector(".np-go");
  let busy = false;

  async function current() { try { const reg = await navigator.serviceWorker.getRegistration("/"); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; } }
  async function paint() {
    const sub = Notification.permission === "granted" ? await current() : null;
    btn.classList.toggle("on", !!sub); btn.setAttribute("aria-pressed", String(!!sub));
    btn.title = sub ? "Article alerts are on" : "Get an alert for new articles";
    if (Notification.permission === "denied") { text.textContent = "Notifications are blocked for this site. Allow them in your browser's site settings (the icon next to the address), then try again."; go.hidden = true; return; }
    go.hidden = false;
    if (sub) { text.textContent = "Alerts are on. You will get a notification when a new article is published."; go.textContent = "Turn off"; go.dataset.mode = "off"; }
    else { text.textContent = "Get a notification in this browser whenever we publish a new article."; go.textContent = "Turn on alerts"; go.dataset.mode = "on"; }
  }
  const open = async o => { pop.hidden = !o; btn.setAttribute("aria-expanded", String(o)); if (o) await paint(); };
  btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
  btn.addEventListener("click", e => { e.stopPropagation(); open(pop.hidden); });
  pop.querySelector(".np-x").addEventListener("click", () => open(false));
  document.addEventListener("click", e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) open(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) open(false); });

  go.addEventListener("click", async () => {
    if (busy) return; busy = true; go.disabled = true;
    try {
      if (go.dataset.mode === "off") { const s = await current(); if (s) await s.unsubscribe(); store.del("rp_push"); text.textContent = "Alerts are off."; }
      else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { await paint(); return; }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" }); await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
        await save(sub); store.set("rp_push", "1"); text.textContent = "Done. You will get a notification for each new article.";
      }
    } catch (err) { text.textContent = "Could not change alerts here. Check your connection and try again."; }
    finally { busy = false; go.disabled = false; setTimeout(paint, 1600); await (async () => { btn.classList.toggle("on", !!(await current())); })(); }
  });
  // keep the bell state right on load, and renew a saved address that the browser rotated
  paint();
  if (Notification.permission === "granted" && store.get("rp_push")) current().then(s => { if (s) save(s).catch(() => {}); });
}
