// Blog extras: view counter, article votes, share bar (with copy link and print) and comments.
// Talks to Firestore over its REST API (same approach as analytics.js, no SDK). Counters are bumped with
// increment transforms; comments are public once posted and moderated from the admin dashboard.
const cfg = window.RAPID_FIREBASE || {};
const live = !!(cfg.apiKey && cfg.projectId);
const DOCS = `projects/${cfg.projectId}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOCS}`;
const KEY = `key=${cfg.apiKey}`;

const slug = (location.pathname.replace(/\/+$/, "").split("/").pop() || "").replace(/\.html$/, "");
const article = document.querySelector("article");
const isPost = !!article && /^[a-z0-9-]+$/.test(slug) && slug !== "blog" && slug !== "index";

// Brand logos (Simple Icons, CC0), 24x24 paths.
const ICON = {
  "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  "messenger": "M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z",
  "whatsapp": "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  "linkedin": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
};
const NS = "http://www.w3.org/2000/svg";
const svg = (d, cls) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls); const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.appendChild(p); return s; };
const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
};
const nf = n => Number(n || 0).toLocaleString();

// ---- Firestore REST helpers
async function api(url, init) { const r = await fetch(url, init); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const commit = writes => post(`${BASE}:commit?${KEY}`, { writes });
// Move counters on a document that may not exist yet: empty field mask + increment transforms only.
const bump = (path, d) => commit([{
  update: { name: `${DOCS}/${path}` }, updateMask: { fieldPaths: [] },
  updateTransforms: Object.entries(d).filter(([, n]) => n).map(([f, n]) => ({ fieldPath: f, increment: { integerValue: String(n) } }))
}]);
const int = f => Number(f && f.integerValue || 0);
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

let countsP;
function loadCounts() {
  if (!countsP) countsP = live ? api(`${BASE}/blog_posts?pageSize=300&${KEY}`).then(j => {
    const m = {}; for (const d of j.documents || []) { const f = d.fields || {}; m[d.name.split("/").pop()] = { views: int(f.views), up: int(f.up), down: int(f.down) }; }
    return m;
  }).catch(() => ({})) : Promise.resolve({});
  return countsP;
}

// ---- small bits of local state (all optional, wrapped so private mode never breaks the page)
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};
const declined = () => { try { return localStorage.getItem("rp_consent") === "no"; } catch { return false; } };
const ignored = () => { try { return localStorage.getItem("rp_ignore") === "1"; } catch { return false; } };
const myVotes = () => store.get("rp_votes", {});
const setMyVote = (k, v) => { const m = myVotes(); if (v) m[k] = v; else delete m[k]; store.set("rp_votes", m); };

let toastEl, toastT;
function toast(msg) {
  if (!toastEl) { toastEl = el("div", { class: "toast", role: "status" }); document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 2400);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { }
  try { const a = el("textarea", { readonly: true, style: "position:fixed;left:-9999px" }); a.value = t; document.body.append(a); a.select(); const ok = document.execCommand("copy"); a.remove(); return ok; } catch { return false; }
}

// ---- votes widget: up arrow, score, down arrow. All boxes for one path share a state, so the bar at the top and
// the one under the article always agree.
const VS = {};
function voteBox(path, init, label) {
  const st = VS[path] || (VS[path] = { up: init.up || 0, down: init.down || 0, mine: myVotes()[path] || 0, busy: false, boxes: [] });
  const bu = el("button", { type: "button", class: "v up", "aria-label": "Upvote", title: "Upvote" }), bd = el("button", { type: "button", class: "v down", "aria-label": "Downvote", title: "Downvote" });
  // Reddit-style arrows: outlined when idle, filled when chosen
  bu.append(svg("M12 3.5 3.5 12.5h5v8h7v-8h5z")); bd.append(svg("M12 20.5 3.5 11.5h5v-8h7v8h5z"));
  const sc = el("span", { class: "sc", "aria-live": "polite" });
  const root = el("div", { class: "vote", role: "group", "aria-label": label }, bu, sc, bd);
  const paint = () => { sc.textContent = nf(st.up - st.down); sc.classList.toggle("up", st.mine === 1); sc.classList.toggle("down", st.mine === -1); bu.classList.toggle("on", st.mine === 1); bd.classList.toggle("on", st.mine === -1); bu.setAttribute("aria-pressed", st.mine === 1); bd.setAttribute("aria-pressed", st.mine === -1); };
  const paintAll = () => { st.boxes = st.boxes.filter(b => b.root.isConnected); st.boxes.forEach(b => b.paint()); };
  async function cast(v) {
    if (st.busy || !live) return; st.busy = true;
    const next = st.mine === v ? 0 : v, dUp = (next === 1) - (st.mine === 1), dDown = (next === -1) - (st.mine === -1), prev = { up: st.up, down: st.down, mine: st.mine };
    st.up += dUp; st.down += dDown; st.mine = next; paintAll(); setMyVote(path, next);
    try { await bump(path, { up: dUp, down: dDown }); }
    catch { st.up = prev.up; st.down = prev.down; st.mine = prev.mine; setMyVote(path, st.mine); paintAll(); toast("Couldn't save your vote. Try again."); }
    st.busy = false;
  }
  bu.addEventListener("click", () => cast(1)); bd.addEventListener("click", () => cast(-1));
  st.boxes.push({ root, paint }); paint();
  return root;
}

// ---- share bar
const SHARES = [
  ["Facebook", "facebook", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
  ["Messenger", "messenger", null],
  ["WhatsApp", "whatsapp", (u, t) => `https://wa.me/?text=${t}%20${u}`],
  ["X", "x", (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
  ["LinkedIn", "linkedin", (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`]
];
function shareBar() {
  const canon = (document.querySelector('link[rel="canonical"]') || {}).href || (location.origin + location.pathname);
  const u = encodeURIComponent(canon), t = encodeURIComponent((document.querySelector("article h1") || document.querySelector("h1") || {}).textContent || document.title);
  const bar = el("div", { class: "share", role: "group", "aria-label": "Share this article" });
  for (const [name, key, mk] of SHARES) {
    const a = el("a", { class: "sh " + key, title: "Share on " + name, "aria-label": "Share on " + name, href: mk ? mk(u, t) : "https://www.messenger.com/", target: "_blank", rel: "noopener noreferrer" });
    a.append(svg(ICON[key]));
    if (key === "messenger") a.addEventListener("click", async e => {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) { e.preventDefault(); location.href = `fb-messenger://share/?link=${u}`; }
      else { await copyText(canon); toast("Link copied. Paste it into Messenger."); }
    });
    bar.append(a);
  }
  const cp = el("button", { type: "button", class: "sh cplink", title: "Copy link", "aria-label": "Copy link" });
  cp.append(svg("M16 1H6a2 2 0 0 0-2 2v12h2V3h10zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H10V7h9z"), el("span", { text: "Copy link" }));
  cp.addEventListener("click", async () => toast((await copyText(canon)) ? "Link copied" : "Couldn't copy. Copy it from the address bar."));
  const pr = el("button", { type: "button", class: "sh prt", title: "Print", "aria-label": "Print this article" });
  pr.append(svg("M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3m-3 11H8v-5h8zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2M18 3H6v4h12z"), el("span", { text: "Print" }));
  pr.addEventListener("click", () => window.print());
  bar.append(cp, pr);
  return bar;
}

// ---- comments
const ago = ms => {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now"; const m = Math.round(s / 60); if (m < 60) return m + " min ago";
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  const d = Math.round(h / 24); if (d < 30) return d + (d === 1 ? " day ago" : " days ago");
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const SPAM = /(https?:|www\.|\.com|\.net|\.org|\.ru|\.xyz|\.top|\.cn|\.io|bit\.ly|casino|viagra|porn|loan offer|click here|[a-z0-9_.]+@[a-z0-9-]+\.[a-z]{2,})/i;

async function fetchComments() {
  const rows = await post(`${BASE}:runQuery?${KEY}`, { structuredQuery: {
    from: [{ collectionId: "blog_comments" }],
    where: { compositeFilter: { op: "AND", filters: [
      { fieldFilter: { field: { fieldPath: "post" }, op: "EQUAL", value: { stringValue: slug } } },
      { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "visible" } } }] } },
    limit: 200 } });
  return rows.filter(r => r.document).map(r => {
    const f = r.document.fields || {};
    return { id: r.document.name.split("/").pop(), name: (f.name && f.name.stringValue) || "", text: (f.text && f.text.stringValue) || "", ms: f.ts && f.ts.timestampValue ? Date.parse(f.ts.timestampValue) : Date.now(), up: int(f.up), down: int(f.down) };
  });
}

function commentsSection() {
  const sec = el("section", { class: "cm", id: "comments", "aria-labelledby": "cmh" });
  const h = el("h2", { id: "cmh" }), cnt = el("span", { class: "cnt" });
  h.append("Comments ", cnt);
  const form = el("form", { class: "cm-form", novalidate: true });
  const name = el("input", { type: "text", name: "name", maxlength: "40", placeholder: "Name (optional)", autocomplete: "nickname", "aria-label": "Name (optional)" });
  const text = el("textarea", { name: "text", rows: "4", maxlength: "1000", placeholder: "Add a comment…", "aria-label": "Comment", required: true });
  const trap = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", class: "hp", "aria-hidden": "true" });
  const left = el("small", { class: "cm-note", text: "No links, please. Be kind and stay on topic." });
  const btn = el("button", { type: "submit", class: "btn primary sm", text: "Post comment" });
  const msg = el("p", { class: "cm-msg", role: "status" });
  form.append(name, text, trap, el("div", { class: "cm-row" }, left, btn), msg);
  name.value = store.get("rp_cname", "");

  const bar = el("div", { class: "cm-bar" });
  const sortNew = el("button", { type: "button", class: "on", text: "Newest" }), sortTop = el("button", { type: "button", text: "Top" });
  bar.append(el("span", { text: "Sort by" }), sortNew, sortTop);
  const list = el("ol", { class: "cm-list" }), empty = el("p", { class: "cm-empty", text: "No comments yet. Be the first to share a thought." });
  sec.append(h, form, bar, list, empty);

  let items = [], sort = "new";
  const born = Date.now();
  function draw() {
    const arr = items.slice().sort((a, b) => sort === "top" ? ((b.up - b.down) - (a.up - a.down)) || b.ms - a.ms : b.ms - a.ms);
    list.replaceChildren(...arr.map(c => {
      const who = c.name || "Anonymous";
      const av = el("div", { class: "av", "aria-hidden": "true", text: who.trim().charAt(0).toUpperCase() || "A", style: `--h:${hue(who)}` });
      const body = el("div", { class: "cm-body" },
        el("div", { class: "cm-top" }, el("b", { text: who }), el("time", { text: ago(c.ms) })),
        el("p", { text: c.text }),
        voteBox("blog_comments/" + c.id, { up: c.up, down: c.down }, "Vote on this comment"));
      return el("li", { class: "cm-item", id: "c-" + c.id }, av, body);
    }));
    cnt.textContent = items.length ? `(${nf(items.length)})` : "";
    empty.hidden = items.length > 0; bar.hidden = items.length < 2;
  }
  sortNew.addEventListener("click", () => { sort = "new"; sortNew.classList.add("on"); sortTop.classList.remove("on"); draw(); });
  sortTop.addEventListener("click", () => { sort = "top"; sortTop.classList.add("on"); sortNew.classList.remove("on"); draw(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const t = text.value.trim(), n = name.value.trim();
    msg.className = "cm-msg"; msg.textContent = "";
    if (t.length < 2) { msg.classList.add("err"); msg.textContent = "Write a little more before posting."; return; }
    if (SPAM.test(t) || SPAM.test(n)) { msg.classList.add("err"); msg.textContent = "Links, email addresses and ad-like words aren't allowed in comments."; return; }
    const last = store.get("rp_clast", 0);
    if (Date.now() - last < 30000) { msg.classList.add("err"); msg.textContent = "Please wait a few seconds before posting again."; return; }
    if (trap.value || Date.now() - born < 2500) { msg.textContent = "Thanks! Your comment was posted."; text.value = ""; return; } // quietly drop bots
    if (!live) { msg.classList.add("err"); msg.textContent = "Comments are unavailable right now."; return; }
    btn.disabled = true; btn.textContent = "Posting…";
    const id = rid(), fields = { post: { stringValue: slug }, text: { stringValue: t }, status: { stringValue: "visible" }, up: { integerValue: "0" }, down: { integerValue: "0" } };
    if (n) fields.name = { stringValue: n };
    try {
      await commit([{ update: { name: `${DOCS}/blog_comments/${id}`, fields }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] }]);
      store.set("rp_clast", Date.now()); if (n) store.set("rp_cname", n);
      items.unshift({ id, name: n, text: t, ms: Date.now(), up: 0, down: 0 }); text.value = ""; draw();
      msg.classList.add("ok"); msg.textContent = "Thanks! Your comment was posted.";
    } catch { msg.classList.add("err"); msg.textContent = "Couldn't post your comment. Check your connection and try again."; }
    btn.disabled = false; btn.textContent = "Post comment";
  });

  draw();
  if (live) fetchComments().then(r => { const seen = new Set(items.map(i => i.id)); items = items.concat(r.filter(c => !seen.has(c.id))); draw(); }).catch(() => { empty.textContent = "Comments couldn't be loaded right now."; });
  else empty.textContent = "Comments are unavailable right now.";
  return sec;
}

// One row: vote pill, a thin divider, then the share buttons (used under the byline and under the article)
function actionBar(top) {
  const share = shareBar();
  if (top) { share.classList.add("top"); return { bar: el("div", { class: "actions top" }, share) }; } // top: share only
  const voteSlot = el("div", { class: "eng-vote" });
  return { bar: el("div", { class: "actions" }, voteSlot, el("span", { class: "sep", "aria-hidden": "true" }), share), voteSlot };
}

// ---- page wiring
async function initPost() {
  const byline = article.querySelector(".byline");
  const viewsEl = el("span", { class: "views", hidden: true }), dotEl = el("span", { text: " · ", hidden: true });
  const metaSpan = byline && byline.querySelector("div > span");
  if (metaSpan) metaSpan.append(dotEl, viewsEl);
  const topA = actionBar(true);
  if (byline) byline.after(topA.bar);

  const end = article.querySelector(".post-end");
  const botA = actionBar(false);
  const engage = el("section", { class: "engage", id: "engage", "aria-label": "Reactions and comments" });
  engage.append(
    el("div", { class: "eng-actions" }, el("b", { class: "lab", text: "Helpful?" }), botA.bar),
    subscribeCard("article"),
    commentsSection());
  (end || article).after(engage);

  const counts = await loadCounts();
  const cur = counts[slug] || { views: 0, up: 0, down: 0 };
  botA.voteSlot.append(voteBox("blog_posts/" + slug, cur, "Vote on this article"));

  let views = cur.views, counted = false;
  const skip = ignored() || declined() || navigator.webdriver || /^(localhost|127\.)/.test(location.hostname) || !live;
  let seen = false; try { seen = sessionStorage.getItem("rp_v_" + slug) === "1"; } catch { }
  if (!skip && !seen) {
    try { await bump("blog_posts/" + slug, { views: 1 }); views += 1; counted = true; try { sessionStorage.setItem("rp_v_" + slug, "1"); } catch { } } catch { }
  }
  if (views > 0) { viewsEl.textContent = `${nf(views)} ${views === 1 ? "view" : "views"}`; viewsEl.hidden = false; dotEl.hidden = false; }
  return counted;
}

// Home and category pages: "load more", view counts on the cards, popular articles ordered by real views
async function initListing() {
  const more = document.querySelector("[data-more]");
  if (more) more.addEventListener("click", () => {
    const hid = [...document.querySelectorAll("#list [data-extra][hidden]")];
    hid.slice(0, 8).forEach(e => { e.hidden = false; });
    if (hid.length <= 8) more.parentElement.remove();
  });
  const counts = await loadCounts();
  const viewsText = v => `${nf(v)} ${v === 1 ? "view" : "views"}`;
  document.querySelectorAll(".feature-post[data-slug], .pitem[data-slug]").forEach(c => {
    const v = (counts[c.dataset.slug] || {}).views, meta = c.querySelector(".postmeta");
    if (v > 0 && meta) meta.append(el("span", { class: "dot", text: "·" }), el("span", { text: viewsText(v) }));
  });
  const pop = document.querySelector(".side-pop");
  if (pop) {
    const lis = [...pop.children], vOf = li => (counts[li.dataset.slug] || {}).views || 0;
    if (lis.some(li => vOf(li) > 0)) lis.sort((a, b) => vOf(b) - vOf(a)).forEach(li => pop.append(li));
    lis.forEach(li => { const v = vOf(li), sv = li.querySelector(".sv"); if (v > 0 && sv) sv.textContent = viewsText(v); });
  }
}

// Search page (/blog/search?q=...): full-text results, category filter
async function initSearchPage() {
  const form = document.getElementById("sform"); if (!form) return;
  const input = document.getElementById("sq"), filters = document.getElementById("sfilters"), status = document.getElementById("sstatus"), res = document.getElementById("sres");
  const params = new URLSearchParams(location.search);
  let cat = params.get("cat") || "all", data = null, timer;
  input.value = params.get("q") || "";
  async function draw() {
    data = data || await loadIndex();
    const q = input.value.trim(), words = q.toLowerCase().split(/\s+/).filter(Boolean), all = search(q, data);
    const cats = new Map(); all.forEach(p => cats.set(p.cs, { label: p.cat, n: ((cats.get(p.cs) || {}).n || 0) + 1 }));
    if (cat !== "all" && !cats.has(cat)) cat = "all";
    const found = cat === "all" ? all : all.filter(p => p.cs === cat);
    const link = (k, l, n) => el("a", { href: "/blog/search?" + new URLSearchParams({ ...(q ? { q } : {}), ...(k !== "all" ? { cat: k } : {}) }), class: k === cat ? "on" : "", "data-c": k }, l, el("i", { text: String(n) }));
    filters.replaceChildren(link("all", "All", all.length), ...[...cats].map(([k, v]) => link(k, v.label, v.n)));
    filters.hidden = cats.size < 2;
    status.textContent = !data.length ? "Search isn't available right now." : q ? (found.length ? `${found.length} ${found.length === 1 ? "article" : "articles"} for “${q}”` : `No articles match “${q}”. Try a shorter or different word, or browse a category from the menu.`) : `All ${data.length} articles. Type above to search titles and the full text.`;
    res.replaceChildren(...found.map(p => el("div", { class: "pitem" },
      el("a", { class: "pthumb", href: "/blog/" + p.slug, tabindex: "-1", "aria-hidden": "true" }, el("img", { src: `/assets/blog/${p.slug}.jpg`, alt: "", loading: "lazy", width: "1200", height: "630" })),
      el("div", { class: "ptxt" }, el("a", { class: "chip", href: "/blog/category/" + p.cs, text: p.cat }), el("h3", {}, el("a", { href: "/blog/" + p.slug }, hl(p.title, words))), el("p", {}, q ? snippet(p, words) : p.desc),
        el("div", { class: "postmeta" }, el("span", { text: p.date }), el("span", { class: "dot", text: "·" }), el("span", { text: p.mins + " min read" }))))));
  }
  const sync = () => { const q = input.value.trim(), qs = new URLSearchParams({ ...(q ? { q } : {}), ...(cat !== "all" ? { cat } : {}) }).toString(); history.replaceState(null, "", "/blog/search" + (qs ? "?" + qs : "")); };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { sync(); draw(); }, 120); });
  form.addEventListener("submit", e => { e.preventDefault(); sync(); draw(); });
  filters.addEventListener("click", e => { const a = e.target.closest("a[data-c]"); if (!a) return; e.preventDefault(); cat = a.dataset.c; sync(); draw(); });
  draw(); if (!input.value) input.focus();
}

// ---- newsletter: collects an address into Firestore; emails are sent from the admin's own mail tool
async function emailId(e) {
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join(""); }
  catch { let h1 = 5381, h2 = 52711; for (const c of e) { h1 = ((h1 * 33) ^ c.charCodeAt(0)) >>> 0; h2 = (h2 * 31 + c.charCodeAt(0)) | 0; } return "f" + h1.toString(16) + (h2 >>> 0).toString(16); }
}
function subscribeCard(source) {
  const card = el("section", { class: "nl", "aria-labelledby": "nlh-" + source });
  const done = () => { card.replaceChildren(el("div", { class: "nl-done" }, svg("M5 12.5l4.5 4.5L19 7.5"), el("div", {}, el("b", { text: "You're on the list." }), el("p", { text: "We'll email you when a new article is published." })))); };
  if (store.get("rp_sub", false)) { done(); return card; }
  const input = el("input", { type: "email", name: "email", placeholder: "you@example.com", autocomplete: "email", inputmode: "email", maxlength: "120", "aria-label": "Email address", required: true });
  const trap = el("input", { type: "text", name: "company", tabindex: "-1", autocomplete: "off", class: "hp", "aria-hidden": "true" });
  const btn = el("button", { type: "submit", class: "btn primary sm", text: "Subscribe" });
  const msg = el("p", { class: "cm-msg", role: "status" });
  const form = el("form", { class: "nl-form", novalidate: true }, input, trap, btn);
  card.append(
    el("h2", { id: "nlh-" + source, text: "Get new articles by email" }),
    el("p", { class: "nl-sub", text: "One short email when we publish something new. No spam, and you can leave any time." }),
    form, msg,
    el("p", { class: "nl-fine" }, "By subscribing you agree to get these emails. We use your address for nothing else. To unsubscribe, email ", el("a", { href: "mailto:admin@rapidplusbrowser.online", text: "admin@rapidplusbrowser.online" }), ". See our ", el("a", { href: "/privacy", text: "Privacy Policy" }), "."));
  const born = Date.now();
  form.addEventListener("submit", async e => {
    e.preventDefault(); msg.className = "cm-msg"; msg.textContent = "";
    const addr = input.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(addr) || addr.length > 120) { msg.classList.add("err"); msg.textContent = "Enter a valid email address."; return; }
    if (trap.value || Date.now() - born < 1500) { done(); return; } // quietly drop bots
    if (!live) { msg.classList.add("err"); msg.textContent = "Sign-up is unavailable right now."; return; }
    btn.disabled = true; btn.textContent = "Subscribing…";
    try {
      const id = await emailId(addr);
      await commit([{ update: { name: `${DOCS}/subscribers/${id}`, fields: { email: { stringValue: addr }, source: { stringValue: source }, consent: { booleanValue: true } } }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] }]);
      store.set("rp_sub", true); done();
    } catch (err) {
      btn.disabled = false; btn.textContent = "Subscribe"; msg.classList.add("err");
      msg.textContent = /403|409/.test(String(err.message)) ? "Looks like you're already on the list. If you don't get our emails, write to us." : "Couldn't sign you up. Check your connection and try again.";
    }
  });
  return card;
}

// ---- header: mobile menu
const hdr = document.getElementById("bnav");
function setMenu(open) {
  if (!hdr) return;
  hdr.classList.toggle("open", open);
  const b = document.getElementById("bburger"); if (b) b.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("noscroll", open);
}
if (hdr) {
  const b = document.getElementById("bburger");
  if (b) b.addEventListener("click", () => setMenu(!hdr.classList.contains("open")));
  hdr.querySelectorAll("#bmenu a").forEach(a => a.addEventListener("click", () => setMenu(false)));
  addEventListener("resize", () => { if (innerWidth > 980) setMenu(false); });
}

// ---- search: titles, summaries and the full text of every article (blog/search.json)
let indexP, ov, qIn, resUl, hintP, lastFocus, sel = -1, resLinks = [];
const loadIndex = () => indexP || (indexP = fetch("/blog/search.json").then(r => { if (!r.ok) throw 0; return r.json(); }).catch(() => []));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hl(text, words) {
  if (!words.length) return [text];
  return text.split(new RegExp("(" + words.map(reEsc).join("|") + ")", "i")).map((part, i) => i % 2 ? el("mark", { text: part }) : part);
}
function snippet(p, words) {
  const low = p.text.toLowerCase(); let at = -1;
  for (const w of words) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return hl(p.desc, words);
  const from = Math.max(0, at - 60), to = Math.min(p.text.length, at + 120);
  return [from ? "… " : "", ...hl(p.text.slice(from, to).trim(), words), to < p.text.length ? " …" : ""];
}
function search(q, data) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? data.map(p => {
    const t = p.title.toLowerCase(), d = p.desc.toLowerCase(), x = p.text.toLowerCase(), c = p.cat.toLowerCase();
    let score = 0;
    for (const w of words) {
      const inT = t.includes(w), inD = d.includes(w), inX = x.includes(w), inC = c.includes(w);
      if (!(inT || inD || inX || inC)) return null;
      score += (inT ? 20 : 0) + (inC ? 6 : 0) + (inD ? 8 : 0) + (inX ? Math.min(10, x.split(w).length - 1) : 0);
    }
    return { p, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.p) : data;
}
function paintSel() { resLinks.forEach((a, i) => a.classList.toggle("sel", i === sel)); if (resLinks[sel]) resLinks[sel].scrollIntoView({ block: "nearest" }); }
async function render() {
  const q = qIn.value.trim(), data = await loadIndex();
  if (q !== qIn.value.trim()) return; // a newer keystroke is already being handled
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), found = search(q, data);
  resUl.replaceChildren(...found.map(p => el("li", {}, el("a", { href: "/blog/" + p.slug }, el("img", { src: `/assets/blog/${p.slug}.jpg`, alt: "", loading: "lazy", width: "84", height: "44" }),
    el("div", { class: "rt" }, el("span", { class: "rc", text: p.cat }), el("b", {}, hl(p.title, words)), el("p", {}, q ? snippet(p, words) : p.desc))))));
  resLinks = [...resUl.querySelectorAll("a")]; sel = resLinks.length && q ? 0 : -1; paintSel();
  const msg = !data.length ? "Search isn't available right now." : q ? (found.length ? `${found.length} ${found.length === 1 ? "article" : "articles"} found` : `No articles match “${q}”. Try a shorter or different word.`) : `${data.length} articles. Type to search titles and the full text.`;
  hintP.replaceChildren(msg, q ? el("a", { href: "/blog/search?q=" + encodeURIComponent(q), class: "bsearch-all", text: " Open search page →" }) : "");
}
function openSearch() {
  if (!ov) {
    qIn = el("input", { type: "search", placeholder: "Search articles…", autocomplete: "off", spellcheck: "false", "aria-label": "Search articles" });
    const x = el("button", { type: "button", class: "bsearch-x", text: "Esc", "aria-label": "Close search" });
    resUl = el("ul", { class: "bsearch-res" }); hintP = el("p", { class: "bsearch-hint", role: "status" });
    ov = el("div", { class: "bsearch-ov", role: "dialog", "aria-modal": "true", "aria-label": "Search the blog", hidden: true },
      el("div", { class: "bsearch-box" }, el("div", { class: "bsearch-in" }, svg("M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13m9 15.5-4.2-4.2").cloneNode(true), qIn, x), resUl, hintP));
    ov.querySelector("svg").removeAttribute("class");
    document.body.append(ov);
    x.addEventListener("click", closeSearch);
    ov.addEventListener("mousedown", e => { if (e.target === ov) closeSearch(); });
    qIn.addEventListener("input", render);
    qIn.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (resLinks.length) { sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + resLinks.length) % resLinks.length; paintSel(); } }
      else if (e.key === "Enter") {
        e.preventDefault();
        const a = resLinks[Math.max(sel, 0)], q = qIn.value.trim();
        if (a) location.href = a.href; else if (q) location.href = "/blog/search?q=" + encodeURIComponent(q);
      }
    });
    resUl.addEventListener("mousemove", e => { const a = e.target.closest("a"); if (a) { sel = resLinks.indexOf(a); paintSel(); } });
  }
  setMenu(false); lastFocus = document.activeElement;
  ov.hidden = false; document.body.classList.add("noscroll"); qIn.value = ""; render(); qIn.focus();
}
function closeSearch() { if (!ov || ov.hidden) return; ov.hidden = true; document.body.classList.remove("noscroll"); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
const sb = document.getElementById("bsearch");
if (sb) sb.addEventListener("click", openSearch);
addEventListener("keydown", e => {
  if (e.key === "Escape") { closeSearch(); setMenu(false); }
  else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") && !(document.activeElement || {}).isContentEditable) { e.preventDefault(); openSearch(); }
});

document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => toast((await copyText(b.dataset.copy)) ? "Copied" : "Couldn't copy. Select it and copy by hand.")));
document.querySelectorAll("[data-subscribe]").forEach(h => h.append(subscribeCard(h.dataset.subscribe || "page")));
// old links like /blog/#privacy now go to the real category page
if (/^\/blog\/?(index)?(\.html)?$/.test(location.pathname) && /^#(security|privacy|how-the-web-works|productivity|performance)$/.test(location.hash)) location.replace("/blog/category/" + location.hash.slice(1));
if (isPost) initPost(); else { initListing(); initSearchPage(); }
