// Rebuilds everything generated from the articles. Run after adding or editing an article:
//   node tools/build-blog.js
// It writes: blog/index.html (home = all posts), blog/category/*.html, blog/search.html, blog/feed.xml,
// blog/search.json, the shared header/footer on every blog page, and the blog URLs in sitemap.xml.
// Adding a new article = drop its HTML in blog/ (copy an existing one), then run this.
const fs = require('fs'), path = require('path');
const PUSH_ON = fs.existsSync(path.join(__dirname, 'push-enabled')); // create tools/push-enabled once the Firestore rules for push_subscribers are deployed
const root = path.join(__dirname, '..'), dir = path.join(root, 'blog'), SITE = 'https://rapidplusbrowser.online';

const CATS = [
  ["Cybersecurity", 'cybersecurity', "Breaches, zero-days and threats: what happened, what it means and how to stay protected."],
  ["Privacy & Data", 'privacy-data', "Tracking, fingerprinting, VPNs and data laws, explained with sources."],
  ["Browsers & AI", 'browsers-ai', "AI assistants in the browser, browser news and what it means for you."],
  ["Web Technology", 'web-technology', "How the web works: the protocols, standards and plumbing behind every page."],
  ["Online Safety", 'online-safety', "Scams, passwords and everyday habits that keep your accounts safe."],
  ["Speed & Productivity", 'speed-productivity', "Faster pages and a tidier workflow in your browser."],
  ["Phones & Apps", 'phones-apps', "Android and iPhone tips, phone news and the apps worth installing, explained in plain words."]
];
const catSlug = name => (CATS.find(c => c[0] === name) || [name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-')])[1];

// ---------- helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = s => s.replace(/&nbsp;/g, ' ').replace(/&mdash;|&ndash;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = h => dec(h.replace(/<(script|style|svg|nav)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/([.!?])\1+/g, '$1').trim();
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const I_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
const I_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
const I_BURGER = '<svg class="ib-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="ib-close" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

// ---------- read the articles
const SKIP = new Set(['index.html', 'about.html', 'contact.html', 'search.html', 'rss.html', 'advertise.html']);
const posts = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html') && !SKIP.has(f))) {
  const h = read(path.join(dir, f)), slug = f.replace(/\.html$/, '');
  const m = re => { const x = h.match(re); return x ? strip(x[1]) : ''; };
  const title = m(/<h1[^>]*>([\s\S]*?)<\/h1>/), desc = m(/<p class="dek">([\s\S]*?)<\/p>/);
  const cat = m(/<header class="post-head">[\s\S]*?<(?:span|a) class="chip"[^>]*>([^<]+)</);
  const body = h.match(/<div class="post-layout">([\s\S]*?)<\/article>/);
  const meta = m(/<div class="byline">[\s\S]*?<span>([\s\S]*?)<\/span>/);
  const alt = (h.match(/<figure class="post-hero">[\s\S]*?alt="([^"]*)"/) || [, ''])[1];
  if (!title || !body || !cat) { console.warn('skipped', f); continue; }
  const date = (meta.match(/\d{1,2} \w{3} \d{4}/) || [''])[0], mins = +((meta.match(/(\d+) min read/) || [, 0])[1]);
  posts.push({ slug, title, desc, cat, cs: catSlug(cat), date, mins, ms: Date.parse(date + ' 08:00 UTC') || 0, alt, text: strip(body[1]) });
}
posts.sort((a, b) => b.ms - a.ms || a.title.localeCompare(b.title));
const usedCats = CATS.filter(c => posts.some(p => p.cs === c[1]));
const count = c => posts.filter(p => p.cs === c).length;

// ---------- shared chrome
const header = current => `<header class="bnav" id="bnav"><div class="wrap">
  <a class="bbrand" href="/blog/"><img src="/assets/logo.png" alt=""><span>Rapid<b>+</b> Blog</span></a>
  <nav class="bnav-cats" aria-label="Categories">${usedCats.map(([l, s]) => `<a href="/blog/category/${s}"${current === s ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="bnav-r">
${PUSH_ON ? `<button type="button" class="bicon bnotify" id="bnotify" aria-label="Get an alert for new articles" title="Get an alert for new articles" hidden>${I_BELL}</button>` : ''}
    <button type="button" class="bicon" id="bsearch" aria-label="Search articles" title="Search (press /)">${I_SEARCH}</button>
    <a class="btn primary sm bnav-dl" href="/download">Download</a>
    <button type="button" class="bicon bburger" id="bburger" aria-label="Menu" aria-expanded="false" aria-controls="bmenu">${I_BURGER}</button>
  </div>
</div>
<nav class="bmenu" id="bmenu" aria-label="Menu">
  <div class="bmenu-in">
    <p class="bmenu-h">Browse</p>
    <a href="/blog/">All articles${CHEV}</a>
    ${usedCats.map(([l, s]) => `<a href="/blog/category/${s}">${l}${CHEV}</a>`).join('\n    ')}
    <a href="/blog/search">Search${CHEV}</a>
    <p class="bmenu-h">Rapid+ Blog</p>
    <a href="/blog/about">About${CHEV}</a>
    <a href="/blog/contact">Contact${CHEV}</a>
    <a href="/blog/advertise">Advertise${CHEV}</a>
    <a href="/blog/rss">RSS feed${CHEV}</a>
    <p class="bmenu-h">Rapid+ Browser</p>
    <a href="/">About Rapid+ Browser${CHEV}</a>
    <a href="/download">Download the app${CHEV}</a>
    <a href="/privacy">Privacy Policy${CHEV}</a>
    <a href="/terms">Terms of Use${CHEV}</a>
    <a href="https://www.facebook.com/rapidplusbrowser" target="_blank" rel="noopener">Facebook page${CHEV}</a>
  </div>
</nav></header>`;

const footer = `<footer class="bfoot"><div class="wrap">
  <div class="bfoot-top">
    <div><a class="bbrand" href="/blog/"><img src="/assets/logo.png" alt=""><span>Rapid<b>+</b> Blog</span></a><p>Researched guides on privacy, browsers and the web, from the team behind Rapid+ Browser.</p></div>
    <div class="bfoot-links"><a href="/blog/">All articles</a><a href="/blog/about">About</a><a href="/blog/contact">Contact</a><a href="/blog/advertise">Advertise</a><a href="/blog/rss">RSS feed</a><a href="/">Rapid+ Browser</a><a href="/download">Download</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/privacy#analytics" data-privacy-choice>Privacy choices</a><a href="https://www.facebook.com/rapidplusbrowser" target="_blank" rel="noopener">Facebook</a><a href="mailto:admin@rapidplusbrowser.online">admin@rapidplusbrowser.online</a></div>
  </div>
  <div class="copy">© 2026 HM Dev Studio · Rapid+ Blog</div>
</div></footer>`;
const DLBAR = '<div class="dlbar"><img src="/assets/logo.png" alt=""><div><b>Rapid+ Browser</b>Free, always</div><a class="btn primary" href="/download">Get app</a></div>';
const SCRIPTS = `<script>
if(/\\.html$/.test(location.pathname)){var cp=location.pathname.replace(/index\\.html$/,'').replace(/\\.html$/,'')||'/';history.replaceState(null,'',cp+location.search+location.hash)}
</script>
<script src="/firebase-config.js"></script>
<script type="module" src="/analytics.js"></script>
<script type="module" src="/blog.js"></script>${PUSH_ON ? `
<script type="module" src="/push.js"></script>` : ''}`;
const RSS_LINK = '<link rel="alternate" type="application/rss+xml" title="Rapid+ Blog" href="/blog/feed.xml">';

const shell = ({ title, desc, canonical, robots, ogImage, ogAlt, ld, current, body, bodyClass }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ff6b00">
<link rel="canonical" href="${SITE}${canonical}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48.png"><link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website"><meta property="og:site_name" content="Rapid+ Blog">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canonical}"><meta property="og:image" content="${SITE}${ogImage}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">${ogAlt ? `<meta property="og:image:alt" content="${ogAlt}">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">
<meta name="robots" content="${robots || 'index, follow, max-image-preview:large'}">
${(ld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
${RSS_LINK}
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/blog.css">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${header(current)}
<main>
${body}
</main>
${footer}
${DLBAR}
${SCRIPTS}
</body></html>
`;

// ---------- listing pieces
const meta = p => `<div class="postmeta"><span>${esc(p.date)}</span><span class="dot">·</span><span>${p.mins} min read</span></div>`;
const featured = p => `<a class="feature-post" data-slug="${p.slug}" href="/blog/${p.slug}"><div class="thumb"><img src="/assets/blog/${p.slug}.jpg" width="1200" height="630" alt="${p.alt}" fetchpriority="high"></div><div class="txt"><span class="chip">${esc(p.cat)}</span><h2>${esc(p.title)}</h2><p>${esc(p.desc)}</p>${meta(p)}</div></a>`;
const item = (p, hidden) => `<div class="pitem" data-slug="${p.slug}"${hidden ? ' hidden data-extra' : ''}><a class="pthumb" href="/blog/${p.slug}" tabindex="-1" aria-hidden="true"><img src="/assets/blog/${p.slug}.jpg" width="1200" height="630" alt="" loading="lazy"></a><div class="ptxt"><a class="chip" href="/blog/category/${p.cs}">${esc(p.cat)}</a><h3><a href="/blog/${p.slug}">${esc(p.title)}</a></h3><p>${esc(p.desc)}</p>${meta(p)}</div></div>`;
const PAGE = 8;
const list = items => `<div class="plist" id="list">${items.map((p, i) => item(p, i >= PAGE)).join('')}</div>${items.length > PAGE ? `<div class="more" data-total="${items.length}"><div class="more-bar" aria-hidden="true"><i style="width:${Math.round(PAGE / items.length * 100)}%"></i></div><p class="more-count" data-count>Showing ${PAGE} of ${items.length} articles</p><button type="button" class="loadmore" data-more><span>Load more articles</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></div>` : ''}`;
const side = current => `<aside class="side" aria-label="Sidebar">
  <form class="side-search" action="/blog/search" method="get" role="search"><input type="search" name="q" placeholder="Search articles…" aria-label="Search articles" autocomplete="off"><button type="submit" aria-label="Search">${I_SEARCH}</button></form>
  <section class="side-card"><h3>Categories</h3><ul class="side-cats">${usedCats.map(([l, s]) => `<li><a href="/blog/category/${s}"${current === s ? ' class="on"' : ''}>${l}<i>${count(s)}</i></a></li>`).join('')}</ul></section>
  <section class="side-card" id="popular"><h3>Popular articles</h3><ol class="side-pop">${posts.slice(0, 5).map(p => `<li data-slug="${p.slug}"><a href="/blog/${p.slug}">${esc(p.title)}</a><span class="sv"></span></li>`).join('')}</ol></section>
  <div data-subscribe="sidebar"></div>
</aside>`;
const chipsNav = current => `<nav class="cats cats-m" aria-label="Categories"><a href="/blog/"${current ? '' : ' class="on"'}>All<i>${posts.length}</i></a>${usedCats.map(([l, s]) => `<a href="/blog/category/${s}"${current === s ? ' class="on"' : ''}>${l}<i>${count(s)}</i></a>`).join('')}</nav>`;
const crumbLd = (...items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })) });
const publisher = { '@type': 'Organization', name: 'HM Dev Studio', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/logo.png' } };

// ---------- ad slot (tools/ads.json); with no live ad the "Advertise here" banner is shown
const adsCfg = (() => { try { return JSON.parse(read(path.join(__dirname, 'ads.json'))); } catch (e) { return { ads: [] }; } })();
const adToday = new Date().toISOString().slice(0, 10);
const liveAds = slot => (adsCfg.ads || []).filter(a => a && a.active !== false && (a.slot || 'home-top') === slot && a.url && a.title && (!a.from || a.from <= adToday) && (!a.to || a.to >= adToday));
const AD_ICONS = {
  brand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z"/></svg>',
  business: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6"/></svg>',
  service: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z"/></svg>'
};
const adHouse = `<a class="adbanner" href="/blog/advertise" aria-label="Advertise your brand, business or service on Rapid+ Blog. See how it works.">
  <span class="adtag">Ad space</span>
  <div class="adb-txt">
    <h2><span class="sr">Advertise your brand, business or service here</span><span aria-hidden="true">Advertise your <span class="adwords"><b>Brand</b><b>Business</b><b>Service</b></span> here</span></h2>
    <p>Put your name in front of readers who care about browsers, privacy and security. Tap to see the requirements and get in touch.</p>
    <span class="adcta">See how it works<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
  </div>
  <div class="adart" aria-hidden="true">
    <i class="adring r1"></i><i class="adring r2"></i>
    <div class="admain"><span>YOUR AD</span><em></em></div>
    <div class="adc c1">${AD_ICONS.brand}<span>Brand</span></div>
    <div class="adc c2">${AD_ICONS.business}<span>Business</span></div>
    <div class="adc c3">${AD_ICONS.service}<span>Service</span></div>
  </div>
</a>`;
const adPaid = a => `<a class="adpaid" href="${esc(a.url)}" target="_blank" rel="sponsored nofollow noopener">${a.image ? `<span class="adp-img"><img src="${esc(a.image)}" width="1200" height="630" alt="" loading="lazy"></span>` : ''}<span class="adp-txt"><span class="adtag">Sponsored${a.sponsor ? ' · ' + esc(a.sponsor) : ''}</span><strong>${esc(a.title)}</strong>${a.text ? `<span class="adp-p">${esc(a.text)}</span>` : ''}<span class="adcta">${esc(a.cta || 'Learn more')}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></span></a>`;
const adSlot = slot => { const live = liveAds(slot).slice(0, 2); return `<section class="adslot" aria-label="Advertisement"><div class="wrap">${live.length ? live.map(adPaid).join('') : adHouse}</div></section>`; };

// ---------- home (all posts)
const top = posts[0];
write(path.join(dir, 'index.html'), shell({
  title: 'Rapid+ Blog (Rapid Plus Blog): Browser Privacy and Security',
  desc: 'Rapid Plus Blog from the team behind Rapid+ Browser: researched guides on browser privacy, security news, VPNs, fingerprinting, passkeys and how the web works.',
  canonical: '/blog/', ogImage: `/assets/blog/${top.slug}.jpg`, ogAlt: top.alt, bodyClass: 'hub',
  ld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Rapid+ Blog', alternateName: ['Rapid Plus Blog', 'RapidPlus Blog'], description: 'Researched guides on browser privacy, security and how the web works, from the team behind Rapid+ Browser.', inLanguage: 'en', url: SITE + '/blog/', publisher, blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}` })) }, crumbLd(['Home', '/'], ['Blog', '/blog/'])],
  body: `<section class="blogtop slim"><div class="wrap">
  <h1 class="sr-only">Latest articles</h1>
  ${chipsNav(null)}
</div></section>
${adSlot('home-top')}
<section class="bloglist"><div class="wrap homegrid">
  <div class="homemain">
    ${featured(top)}
    ${posts.length > 1 ? `<h2 class="listh">More articles</h2>\n    ${list(posts.slice(1))}` : ''}
  </div>
  ${side(null)}
</div></section>`
}));

// ---------- category pages
fs.mkdirSync(path.join(dir, 'category'), { recursive: true });
for (const [name, s, blurb] of usedCats) {
  const ps = posts.filter(p => p.cs === s), lead = ps[0];
  write(path.join(dir, 'category', s + '.html'), shell({
    title: `${name} Articles | Rapid+ Blog`, desc: `${blurb} ${ps.length} ${ps.length === 1 ? 'article' : 'articles'} from the Rapid+ Blog.`,
    canonical: `/blog/category/${s}`, ogImage: `/assets/blog/${lead.slug}.jpg`, ogAlt: lead.alt, current: s,
    ld: [crumbLd(['Home', '/'], ['Blog', '/blog/'], [name, `/blog/category/${s}`])],
    body: `<section class="blogtop"><div class="wrap">
  <div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / ${esc(name)}</div>
  <h1>${esc(name)}</h1>
  <p>${esc(blurb)} <span class="muted-count">${ps.length} ${ps.length === 1 ? 'article' : 'articles'}.</span></p>
  ${chipsNav(s)}
</div></section>
<section class="bloglist"><div class="wrap homegrid">
  <div class="homemain">
    ${list(ps)}
  </div>
  ${side(s)}
</div></section>`
  }));
}

// ---------- search page
write(path.join(dir, 'search.html'), shell({
  title: 'Search | Rapid+ Blog', desc: 'Search every Rapid+ Blog article by title and full text.', canonical: '/blog/search', robots: 'noindex, follow',
  ogImage: `/assets/blog/${top.slug}.jpg`, ogAlt: top.alt,
  body: `<section class="pagebody searchpage"><div class="wrap wide">
  <div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / Search</div>
  <h1>Search</h1>
  <form class="bigsearch" id="sform" action="/blog/search" method="get" role="search">${I_SEARCH}<input id="sq" type="search" name="q" placeholder="Search titles and full articles…" aria-label="Search articles" autocomplete="off" spellcheck="false"><button class="btn primary" type="submit">Search</button></form>
  <div class="cats" id="sfilters" aria-label="Filter by category"></div>
  <p class="sstatus" id="sstatus" role="status"></p>
  <div class="plist" id="sres"></div>
</div></section>`
}));

// ---------- RSS feed
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Rapid+ Blog</title><link>${SITE}/blog/</link><description>Guides on browser privacy, security, speed and how the web works, from the team behind Rapid+ Browser.</description><language>en</language>
<atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
<lastBuildDate>${new Date(top.ms).toUTCString()}</lastBuildDate>
${posts.map(p => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}</link><guid isPermaLink="true">${SITE}/blog/${p.slug}</guid><pubDate>${new Date(p.ms).toUTCString()}</pubDate><category>${esc(p.cat)}</category><description>${esc(p.desc)}</description></item>`).join('\n')}
</channel></rss>
`;
write(path.join(dir, 'feed.xml'), rss);

// A normal page that explains the feed (linked from the footer, menu and sidebar). Feed readers use feed.xml directly.
write(path.join(dir, 'rss.html'), shell({
  title: 'RSS Feed | Rapid+ Blog', desc: 'Follow Rapid+ Blog in your news reader with the RSS feed.', canonical: '/blog/rss',
  ogImage: `/assets/blog/${top.slug}.jpg`, ogAlt: top.alt,
  body: `<section class="pagebody"><div class="wrap">
  <div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / RSS feed</div>
  <h1>RSS feed</h1>
  <p class="lead">Get every new article in your news reader, with no account needed.</p>
  <div class="contact-card">
    <div><span class="k">Feed address</span><span class="email feedurl">${SITE}/blog/feed.xml</span></div>
    <button type="button" class="btn sm" data-copy="${SITE}/blog/feed.xml">Copy address</button>
  </div>
  <h2>How to use it</h2>
  <ol>
    <li>Open a feed reader such as Feedly, Inoreader or NetNewsWire.</li>
    <li>Choose "Add feed" and paste the address above.</li>
    <li>New Rapid+ Blog articles will show up there as soon as they are published.</li>
  </ol>
  <p>Prefer email? You can <a href="#subscribe">get new articles by email</a> instead.</p>
  <div id="subscribe" data-subscribe="rss" class="nlsec-inline"></div>
</div></section>`
}));

// ---------- advertise page
write(path.join(dir, 'advertise.html'), shell({
  title: 'Advertise | Rapid+ Blog', desc: 'Advertise your brand, business or service on the Rapid+ Blog. Ad formats, requirements, and a form to get in touch.', canonical: '/blog/advertise',
  ogImage: `/assets/blog/${top.slug}.jpg`, ogAlt: top.alt, ld: [crumbLd(['Home', '/'], ['Blog', '/blog/'], ['Advertise', '/blog/advertise'])],
  body: `<section class="pagebody adpage"><div class="wrap">
  <div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / Advertise</div>
  <h1>Advertise on Rapid+ Blog</h1>
  <p class="lead">Show your brand, business or service to people who read about browsers, privacy and security. Ads are clearly labelled, and they never change what we write.</p>

  <h2>What you get</h2>
  <div class="adgrid">
    <div class="adbox"><b>Top banner</b><span>A sponsored card right under "Latest articles" on the blog home page, with your image, a short headline, a line of text and a button to your site.</span></div>
    <div class="adbox"><b>Clear label</b><span>Every ad is marked "Sponsored" and links out with rel="sponsored", so readers and search engines can tell it is paid.</span></div>
    <div class="adbox"><b>Your dates</b><span>You choose the start and end date. The ad goes live and comes down on those days.</span></div>
  </div>
  <p>Prices depend on the format and how long the ad runs. Send us your details with the form below and we will reply with a quote by email.</p>

  <h2>What we need from you</h2>
  <ul class="adreq">
    <li><b>Headline:</b> up to 60 characters.</li>
    <li><b>Text:</b> up to 120 characters, plain and honest.</li>
    <li><b>Button text:</b> one to three words, such as "Visit site" or "Try it free".</li>
    <li><b>Link:</b> an https address that opens a working page about what the ad says.</li>
    <li><b>Image:</b> 1200 x 630 pixels as JPG, PNG, WebP or GIF, under 300 KB. A short animated GIF or WebP is welcome. No flashing, and no text that is too small to read.</li>
    <li><b>Who you are:</b> your name or company, a website and an email we can reach you at.</li>
    <li><b>Dates:</b> when the ad should start and for how long.</li>
  </ul>

  <h2>What we do not accept</h2>
  <ul class="adreq">
    <li>Adult content, gambling, weapons, drugs, or anything illegal where our readers live.</li>
    <li>Scams, fake discounts, fake reviews, or claims that cannot be backed up, such as "100% anonymous" or "unhackable".</li>
    <li>Malware, adware, cracked software, or tools made to harm or spy on people.</li>
    <li>Misleading ads that look like articles, system warnings or buttons.</li>
    <li>Privacy or security products that hide who runs them or where to find their policy.</li>
  </ul>
  <p>We may refuse or remove an ad at any time if it breaks these rules or the page it points to changes. We read every ad and the page behind it before it goes live.</p>

  <h2>How it works</h2>
  <ol class="adsteps">
    <li><b>Tell us what you want.</b> Fill in the form below. It opens an email to us with your details.</li>
    <li><b>We reply</b> with a quote, the exact sizes and a date that is free.</li>
    <li><b>You send the image and text.</b> We check them, show you how the ad will look, and agree on dates.</li>
    <li><b>It goes live</b> on the day you chose.</li>
  </ol>

  <h2 id="contact">Get in touch</h2>
  <form class="adform" id="adform" novalidate>
    <div class="adrow"><label>Your name<input name="name" autocomplete="name" required></label><label>Company or brand<input name="company" autocomplete="organization"></label></div>
    <div class="adrow"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Website<input name="website" type="url" inputmode="url" placeholder="https://"></label></div>
    <div class="adrow"><label>What are you advertising?<select name="type"><option>Brand</option><option>Business</option><option>Service</option><option>Product or app</option><option>Event or other</option></select></label><label>Start date (if you know it)<input name="start" type="date"></label></div>
    <label>Tell us about the ad<textarea name="message" rows="5" placeholder="What you offer, who it is for, and the page the ad should link to." required></textarea></label>
    <p class="adnote">Pressing the button opens your email app with the message filled in, addressed to us. Nothing is sent from this page.</p>
    <button type="submit" class="btn primary">Prepare my email</button>
    <div class="adfail" id="adfail" hidden><p>If your email app did not open, copy the text below and send it to <a href="mailto:admin@rapidplusbrowser.online">admin@rapidplusbrowser.online</a>.</p><textarea id="adtext" rows="8" readonly></textarea><button type="button" class="btn sm" id="adcopy">Copy text</button></div>
  </form>
  <div class="contact-card" style="margin-top:22px">
    <div><span class="k">Email</span><a class="email" href="mailto:admin@rapidplusbrowser.online?subject=Advertising%20on%20Rapid%2B%20Blog">admin@rapidplusbrowser.online</a></div>
    <button type="button" class="btn sm" data-copy="admin@rapidplusbrowser.online">Copy address</button>
  </div>
  <p class="adnote">Prefer chat? Message us on <a href="https://t.me/hasanmahmud_dev" target="_blank" rel="noopener">Telegram</a>.</p>
</div></section>
<script src="/ads.js" defer></script>`
}));

// ---------- search index
write(path.join(dir, 'search.json'), JSON.stringify(posts.map(p => ({ slug: p.slug, title: p.title, desc: p.desc, cat: p.cat, cs: p.cs, date: p.date, mins: p.mins, text: p.text }))));

// ---------- keep every other blog page in step (articles, about, contact)
const files = [...fs.readdirSync(dir).filter(f => f.endsWith('.html') && !['index.html', 'search.html'].includes(f)).map(f => path.join(dir, f))];
for (const f of files) {
  let s = read(f); const crlf = s.includes('\r\n'); s = s.split('\r\n').join('\n'); const before = s;
  s = s.replace(/<header class="bnav"[\s\S]*?<\/header>/, () => header(null));
  s = s.replace(/<footer class="bfoot">[\s\S]*?<\/footer>/, () => footer);
  if (!s.includes('application/rss+xml')) s = s.replace('<link rel="stylesheet" href="/style.css">', () => RSS_LINK + '\n<link rel="stylesheet" href="/style.css">');
  const p = posts.find(x => f.endsWith(path.sep + x.slug + '.html'));
  if (p) {
    s = s.replace(/(<header class="post-head">[\s\S]*?)<(?:span|a) class="chip"[^>]*>([^<]+)<\/(?:span|a)>/, (m, a, c) => `${a}<a class="chip" href="/blog/category/${p.cs}">${c}</a>`);
    s = s.replace(/<div class="crumbs"><a href="\/blog\/">Rapid\+ Blog<\/a> \/ (?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/div>/, (m, c) => `<div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / <a href="/blog/category/${p.cs}">${c}</a></div>`);
  }
  if (s !== before) fs.writeFileSync(f, crlf ? s.split('\n').join('\r\n') : s);
}

// ---------- home page: the three newest articles, so every new post is linked from the front page
{
  const hp = path.join(root, 'index.html'); let h = read(hp); const crlfH = h.includes('\r\n'); h = h.split('\r\n').join('\n');
  if (h.includes('<!--latest-posts-->')) {
    const cards = posts.slice(0, 3).map(p => '<div class="card"><h3><a href="/blog/' + p.slug + '">' + esc(p.title) + '</a></h3><p>' + esc(p.desc) + '</p></div>').join('');
    const block = '<!--latest-posts--><section><div class="wrap"><div class="center"><div class="eyebrow">Blog</div><h2 class="title">Latest from the Rapid+ Blog</h2><p class="sub">Researched guides on privacy, security and how the web works.</p></div><div class="grid">' + cards + '</div><div class="center"><a class="more" href="blog/">All articles</a></div></div></section><!--/latest-posts-->';
    h = h.replace(/<!--latest-posts-->[\s\S]*?<!--\/latest-posts-->/, () => block);
    fs.writeFileSync(hp, crlfH ? h.split('\n').join('\r\n') : h);
  }
}

// ---------- sitemap: blog URLs
const smPath = path.join(root, 'sitemap.xml'); let sm = read(smPath); const crlf = sm.includes('\r\n'); sm = sm.split('\r\n').join('\n');
const today = '2026-11-01';
for (const [, s] of usedCats) {
  const loc = `${SITE}/blog/category/${s}`;
  if (!sm.includes(loc)) sm = sm.replace(`  <url><loc>${SITE}/blog/about</loc>`, () => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>\n  <url><loc>${SITE}/blog/about</loc>`);
}
if (!sm.includes(`${SITE}/blog/advertise`)) sm = sm.replace(`  <url><loc>${SITE}/blog/about</loc>`, () => `  <url><loc>${SITE}/blog/advertise</loc><lastmod>${today}</lastmod><priority>0.4</priority></url>\n  <url><loc>${SITE}/blog/about</loc>`);
fs.writeFileSync(smPath, crlf ? sm.split('\n').join('\r\n') : sm);

console.log(`${posts.length} articles, ${usedCats.length} categories; home, category pages, search page, feed and search index written (${Math.round(fs.statSync(path.join(dir, 'search.json')).size / 1024)} KB index)`);
