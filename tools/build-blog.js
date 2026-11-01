// Rebuilds everything generated from the articles. Run after adding or editing an article:
//   node tools/build-blog.js
// It writes: blog/index.html (home = all posts), blog/category/*.html, blog/search.html, blog/feed.xml,
// blog/search.json, the shared header/footer on every blog page, and the blog URLs in sitemap.xml.
// Adding a new article = drop its HTML in blog/ (copy an existing one), then run this.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'blog'), SITE = 'https://rapidplusbrowser.online';

const CATS = [
  ['Security', 'security', 'News and explainers on breaches, scams and how to stay safe online.'],
  ['Privacy', 'privacy', 'How tracking, proxies and VPNs really work, and what actually protects you.'],
  ['How the web works', 'how-the-web-works', 'Plain-language explanations of the parts of the web you use every day.'],
  ['Productivity', 'productivity', 'Getting more done in your browser without mixing up your accounts.'],
  ['Performance', 'performance', 'What makes pages load fast or slow, and what helps.']
];
const catSlug = name => (CATS.find(c => c[0] === name) || [name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-')])[1];

// ---------- helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = s => s.replace(/&nbsp;/g, ' ').replace(/&mdash;|&ndash;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = h => dec(h.replace(/<(script|style|svg|nav)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/([.!?])\1+/g, '$1').trim();
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const I_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
const I_BURGER = '<svg class="ib-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="ib-close" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

// ---------- read the articles
const SKIP = new Set(['index.html', 'about.html', 'contact.html', 'search.html']);
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
    <a href="/blog/feed.xml">RSS feed${CHEV}</a>
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
    <div class="bfoot-links"><a href="/blog/">All articles</a><a href="/blog/about">About</a><a href="/blog/contact">Contact</a><a href="/blog/feed.xml">RSS feed</a><a href="/">Rapid+ Browser</a><a href="/download">Download</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/privacy#analytics" data-privacy-choice>Privacy choices</a><a href="https://www.facebook.com/rapidplusbrowser" target="_blank" rel="noopener">Facebook</a><a href="mailto:admin@rapidplusbrowser.online">admin@rapidplusbrowser.online</a></div>
  </div>
  <div class="copy">© 2026 HM Dev Studio · Rapid+ Blog</div>
</div></footer>`;
const DLBAR = '<div class="dlbar"><img src="/assets/logo.png" alt=""><div><b>Rapid+ Browser</b>Free, always</div><a class="btn primary" href="/download">Get app</a></div>';
const SCRIPTS = `<script>
if(/\\.html$/.test(location.pathname)){var cp=location.pathname.replace(/index\\.html$/,'').replace(/\\.html$/,'')||'/';history.replaceState(null,'',cp+location.search+location.hash)}
</script>
<script src="/firebase-config.js"></script>
<script type="module" src="/analytics.js"></script>
<script type="module" src="/blog.js"></script>`;
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
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="apple-touch-icon" href="/assets/logo.png">
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
const list = items => `<div class="plist" id="list">${items.map((p, i) => item(p, i >= PAGE)).join('')}</div>${items.length > PAGE ? '<p class="more"><button type="button" class="sbtn loadmore" data-more>Load more articles</button></p>' : ''}`;
const side = current => `<aside class="side" aria-label="Sidebar">
  <form class="side-search" action="/blog/search" method="get" role="search"><input type="search" name="q" placeholder="Search articles…" aria-label="Search articles" autocomplete="off"><button type="submit" aria-label="Search">${I_SEARCH}</button></form>
  <section class="side-card"><h3>Categories</h3><ul class="side-cats">${usedCats.map(([l, s]) => `<li><a href="/blog/category/${s}"${current === s ? ' class="on"' : ''}>${l}<i>${count(s)}</i></a></li>`).join('')}</ul></section>
  <section class="side-card" id="popular"><h3>Popular articles</h3><ol class="side-pop">${posts.slice(0, 5).map(p => `<li data-slug="${p.slug}"><a href="/blog/${p.slug}">${esc(p.title)}</a><span class="sv"></span></li>`).join('')}</ol></section>
  <div data-subscribe="sidebar"></div>
  <section class="side-card"><h3>About Rapid+ Blog</h3><p class="side-about">Plain-language guides on browser privacy, security and speed from the team behind Rapid+ Browser. <a href="/blog/about">More about us</a> · <a href="/blog/feed.xml">RSS</a></p></section>
</aside>`;
const chipsNav = current => `<nav class="cats cats-m" aria-label="Categories"><a href="/blog/"${current ? '' : ' class="on"'}>All<i>${posts.length}</i></a>${usedCats.map(([l, s]) => `<a href="/blog/category/${s}"${current === s ? ' class="on"' : ''}>${l}<i>${count(s)}</i></a>`).join('')}</nav>`;
const crumbLd = (...items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })) });
const publisher = { '@type': 'Organization', name: 'HM Dev Studio', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/logo.png' } };

// ---------- home (all posts)
const top = posts[0];
write(path.join(dir, 'index.html'), shell({
  title: 'Rapid+ Blog: Browser Privacy, Speed and How the Web Works',
  desc: 'Researched guides on proxies and VPNs, browser fingerprinting, user agents, browser profiles, ad blocking and security news, from the team behind Rapid+ Browser.',
  canonical: '/blog/', ogImage: `/assets/blog/${top.slug}.jpg`, ogAlt: top.alt, bodyClass: 'hub',
  ld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Rapid+ Blog', url: SITE + '/blog/', publisher, blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}` })) }, crumbLd(['Home', '/'], ['Blog', '/blog/'])],
  body: `<section class="blogtop"><div class="wrap">
  <h1>Latest articles</h1>
  <p>Long-form guides with the sources linked, from the team behind Rapid+ Browser.</p>
  ${chipsNav(null)}
</div></section>
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

// ---------- sitemap: blog URLs
const smPath = path.join(root, 'sitemap.xml'); let sm = read(smPath); const crlf = sm.includes('\r\n'); sm = sm.split('\r\n').join('\n');
const today = '2026-11-01';
for (const [, s] of usedCats) {
  const loc = `${SITE}/blog/category/${s}`;
  if (!sm.includes(loc)) sm = sm.replace(`  <url><loc>${SITE}/blog/about</loc>`, () => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>\n  <url><loc>${SITE}/blog/about</loc>`);
}
fs.writeFileSync(smPath, crlf ? sm.split('\n').join('\r\n') : sm);

console.log(`${posts.length} articles, ${usedCats.length} categories; home, category pages, search page, feed and search index written (${Math.round(fs.statSync(path.join(dir, 'search.json')).size / 1024)} KB index)`);
