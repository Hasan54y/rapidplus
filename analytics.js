// Site analytics for rapidplusbrowser.online. Write-only: events go straight to Firestore over its REST API
// (no SDK download on every page), and only the admin account can read them back (firebase/firestore.rules).
// No cookies and no ID that follows a visitor across visits: a random per-tab session id (sessionStorage) and a
// one-bit "has visited before" flag (localStorage) are the only things kept in the browser.
const cfg = window.RAPID_FIREBASE || {};
const off = !cfg.apiKey || !cfg.projectId || navigator.webdriver ||
  /^\/admin/.test(location.pathname) || !/^https?:$/.test(location.protocol) ||
  /^(localhost|127\.)/.test(location.hostname);

const DOCS = `projects/${cfg.projectId}/databases/(default)/documents`;
const URL_COMMIT = `https://firestore.googleapis.com/v1/${DOCS}:commit?key=${cfg.apiKey}`;

const cut = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

function store(kind, key, make) {
  try { let v = window[kind].getItem(key); if (v === null) { v = make(); window[kind].setItem(key, v); return [v, true]; } return [v, false]; }
  catch { return [make(), true]; }
}
const [sid] = store("sessionStorage", "rp_sid", rid);
const [, firstVisit] = store("localStorage", "rp_seen", () => "1");

function browser(ua) {
  if (/; wv\)/.test(ua)) return "Android WebView";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox|FxiOS/.test(ua)) return "Firefox";
  if (/Electron/.test(ua)) return "Rapid+ (Windows)";
  if (/Chrome|CriOS/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  return "Other";
}
function os(ua) {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}
function device() {
  const w = Math.min(screen.width, screen.height), touch = matchMedia("(pointer: coarse)").matches;
  return !touch ? "desktop" : w >= 600 ? "tablet" : "mobile";
}

function val(v) {
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(Math.round(v)) };
  return { stringValue: String(v) };
}
function send(type, data, keepalive) {
  if (off) return;
  const fields = { type: val(type), path: val(cut(location.pathname, 200) || "/"), sid: val(sid) };
  for (const [k, v] of Object.entries(data)) if (v !== "" && v !== undefined && v !== null) fields[k] = val(v);
  const body = JSON.stringify({ writes: [{
    update: { name: `${DOCS}/analytics_events/${rid()}`, fields },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }]
  }] });
  fetch(URL_COMMIT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: !!keepalive }).catch(() => {});
}

// Page view
const ua = navigator.userAgent, qs = new URLSearchParams(location.search);
let refHost = "";
try { refHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { }
if (refHost === location.hostname) refHost = "";
send("page_view", {
  title: cut(document.title, 120),
  ref: refHost ? cut(document.referrer, 200) : "",
  refHost: cut(refHost, 80),
  utmSource: cut(qs.get("utm_source"), 60),
  utmMedium: cut(qs.get("utm_medium"), 60),
  utmCampaign: cut(qs.get("utm_campaign"), 60),
  device: device(),
  browser: browser(ua),
  os: os(ua),
  lang: cut(navigator.language, 20),
  tz: cut(Intl.DateTimeFormat().resolvedOptions().timeZone, 40),
  screen: `${screen.width}x${screen.height}`,
  newVisitor: firstVisit
});

// Engagement: visible time and deepest scroll, sent once when the page is hidden or left.
let visibleMs = 0, since = document.visibilityState === "visible" ? performance.now() : 0, maxScroll = 0, sentEngage = false;
function trackScroll() {
  const h = document.documentElement.scrollHeight - innerHeight;
  const pct = h <= 0 ? 100 : Math.round(scrollY / h * 100);
  if (pct > maxScroll) maxScroll = Math.min(100, pct);
}
addEventListener("scroll", trackScroll, { passive: true });
trackScroll();
function flush() {
  if (since) { visibleMs += performance.now() - since; since = 0; }
  if (sentEngage) return;
  sentEngage = true;
  const dur = Math.round(visibleMs / 1000);
  if (dur >= 1) send("engage", { dur: Math.min(dur, 86400), scroll: maxScroll }, true);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
  else if (!since) since = performance.now();
});
addEventListener("pagehide", flush);

// Clicks: download buttons get their own event type; everything else is a plain click.
document.addEventListener("click", e => {
  const el = e.target.closest("a[href], button");
  if (!el) return;
  const label = cut(el.getAttribute("aria-label") || el.innerText || el.querySelector("img")?.alt || el.getAttribute("title"), 60);
  let target = "";
  if (el.tagName === "A") {
    try {
      const u = new URL(el.getAttribute("href"), location.href);
      target = u.hostname === location.hostname ? u.pathname + u.hash : u.hostname + u.pathname;
    } catch { target = el.getAttribute("href"); }
  }
  target = cut(target, 120);
  const href = el.getAttribute("href") || "";
  if (el.matches(".play-badge") || /play\.google\.com\/store\/apps/.test(href)) send("download_click", { platform: "android", label, target }, true);
  else if (el.matches(".win-btn") || /\.exe(\?|$)/i.test(href)) send("download_click", { platform: "windows", label, target }, true);
  else send("click", { label, target }, true);
}, { capture: true });
