// Builds a finished blog article from a text file and a hero picture.
//   node tools/new-post.js spec.json
// spec.json: { "slug", "title", "dek", "description", "category", "date" (YYYY-MM-DD), "heroAlt",
//              "body" (path to the article HTML: the <p>, <h2 id=..>, tables, FAQ <details>, Sources <ol class="sources">),
//              "hero" (path to a 1200x630 .jpg, or a .svg that is rendered to one with sharp) }
// It writes blog/<slug>.html and assets/blog/<slug>.jpg, adds the sitemap line, runs tools/build-blog.js (home, category
// pages, feed, search index) and checks the text for filler words and dashes. It exits with an error if the checks fail.
// Needs "sharp" only when the hero is an SVG:  npm i --no-save sharp
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), blogDir = path.join(root, 'blog'), SITE = 'https://rapidplusbrowser.online';
const CATEGORIES = { 'Security': 'security', 'Privacy': 'privacy', 'How the web works': 'how-the-web-works', 'Productivity': 'productivity', 'Performance': 'performance' };
const FILLER = ['delve', 'landscape', 'ever-evolving', 'in today\'s', 'it\'s important to note', 'it is important to note', 'navigate the', 'leverage', 'robust', 'seamless', 'unlock', 'game-changer', 'game changer', 'tapestry', 'realm of', 'crucial', 'comprehensive', 'moreover', 'furthermore', 'testament', 'embark', 'empower', 'harness', 'cutting-edge', 'revolutioniz', 'in conclusion', 'dive into', 'deep dive', 'at the end of the day', 'treasure trove', '—', '–'];

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node tools/new-post.js spec.json'); process.exit(2); }
const specDir = path.dirname(path.resolve(specPath));
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const fail = m => { console.error('ERROR: ' + m); process.exit(1); };
for (const k of ['slug', 'title', 'dek', 'description', 'category', 'date', 'heroAlt', 'body', 'hero']) if (!spec[k]) fail('spec is missing "' + k + '"');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(spec.slug) || spec.slug.length > 80) fail('slug must be lowercase words joined by hyphens');
if (!CATEGORIES[spec.category]) fail('category must be one of: ' + Object.keys(CATEGORIES).join(', '));
if (!/^\d{4}-\d{2}-\d{2}$/.test(spec.date)) fail('date must be YYYY-MM-DD');
if (fs.existsSync(path.join(blogDir, spec.slug + '.html'))) fail('an article with this slug already exists');
if (spec.description.length < 90 || spec.description.length > 175) fail('description should be 90-175 characters (is ' + spec.description.length + ')');
const rel = p => (path.isAbsolute(p) ? p : path.resolve(specDir, p));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonSafe = s => JSON.stringify(s).replace(/</g, '\\u003c');
const body = fs.readFileSync(rel(spec.body), 'utf8').replace(/\r\n/g, '\n').trim();

// ---- checks on the text
const visible = body.replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const lower = visible.toLowerCase();
const words = (visible.match(/\b[\w'’-]+\b/g) || []).length;
const problems = [];
const hits = FILLER.filter(w => lower.includes(w) || (spec.title + ' ' + spec.dek).toLowerCase().includes(w));
if (hits.length) problems.push('filler words or dashes found: ' + hits.map(h => JSON.stringify(h)).join(', '));
if (words < 900) problems.push('article is only ' + words + ' words; aim for 1,300 to 2,000');
if (!/<h2 id="sources">/.test(body)) problems.push('missing <h2 id="sources"> section');
if (!/<ol class="sources">[\s\S]*<a href="https?:/.test(body)) problems.push('the sources list needs real links');
if (!/<h2 id="faq">/.test(body)) problems.push('missing <h2 id="faq"> section');
if ((body.match(/<details><summary>/g) || []).length < 3) problems.push('FAQ needs at least 3 questions as <details><summary>..</summary><p>..</p></details>');
if ((body.match(/<h2 id="/g) || []).length < 5) problems.push('use at least 5 <h2 id=".."> sections');
if (/\b(lorem|TODO|TBD|XXX)\b/i.test(visible)) problems.push('placeholder text found');
if (problems.length) { problems.forEach(p => console.error('PROBLEM: ' + p)); fail('fix the text and run again (nothing was written)'); }

// ---- hero picture
const heroSrc = rel(spec.hero), heroOut = path.join(root, 'assets', 'blog', spec.slug + '.jpg');
fs.mkdirSync(path.dirname(heroOut), { recursive: true });
(async () => {
  if (/\.svg$/i.test(heroSrc)) {
    let sharp; try { sharp = require('sharp'); } catch (e) { fail('the hero is an SVG, so install sharp first:  npm i --no-save sharp'); }
    await sharp(fs.readFileSync(heroSrc)).resize(1200, 630).jpeg({ quality: 88 }).toFile(heroOut);
  } else fs.copyFileSync(heroSrc, heroOut);
  const st = fs.statSync(heroOut); if (st.size < 8000) fail('the hero picture looks empty (' + st.size + ' bytes)');

  // ---- page, built from the newest existing article so the header, footer and structured data match
  const tpl = fs.readFileSync(path.join(blogDir, 'binance-hack.html'), 'utf8').replace(/\r\n/g, '\n');
  const mins = Math.max(1, Math.round(words / 210));
  const toc = [...body.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)].map(m => `<a href="#${m[1]}">${m[2].replace(/^Frequently asked questions$/, 'FAQ')}</a>`).join('');
  const faq = [...body.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(m => ({ q: m[1].replace(/<[^>]+>/g, ''), a: m[2].replace(/<[^>]+>/g, '') }));
  const catSlug = CATEGORIES[spec.category], IMG = `/assets/blog/${spec.slug}.jpg`, URL = `${SITE}/blog/${spec.slug}`;
  const dateHuman = new Date(spec.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  // related cards from the three newest other articles
  const meta = f => {
    const h = fs.readFileSync(path.join(blogDir, f), 'utf8'), slug = f.replace(/\.html$/, '');
    const m = re => { const x = h.match(re); return x ? x[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; };
    const by = m(/<div class="byline">[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const d = h.match(/<meta property="article:published_time" content="([^"]+)"/);
    return { slug, title: m(/<h1[^>]*>([\s\S]*?)<\/h1>/), dek: m(/<p class="dek">([\s\S]*?)<\/p>/), cat: m(/<header class="post-head">[\s\S]*?<a class="chip"[^>]*>([^<]+)</), alt: (h.match(/<figure class="post-hero">[\s\S]*?alt="([^"]*)"/) || [, ''])[1], mins: (by.match(/(\d+) min read/) || [, '8'])[1], date: d ? d[1] : '1970-01-01', human: (by.match(/\d{1,2} \w{3} \d{4}/) || [''])[0] };
  };
  const others = fs.readdirSync(blogDir).filter(f => f.endsWith('.html') && !['index.html', 'about.html', 'contact.html', 'search.html', 'rss.html', spec.slug + '.html'].includes(f)).map(meta).filter(p => p.title).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const cards = others.map(p => `<a class="postcard" href="/blog/${p.slug}"><div class="thumb"><img src="/assets/blog/${p.slug}.jpg" width="1200" height="630" alt="${esc(p.alt)}" loading="lazy"></div><div class="txt"><span class="chip">${esc(p.cat)}</span><h3>${esc(p.title)}</h3><p>${esc(p.dek)}</p><div class="postmeta"><span>${esc(p.human)}</span><span class="dot">·</span><span>${p.mins} min read</span></div></div></a>`).join('');

  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(spec.title)} | Rapid+ Blog</title>
<meta name="description" content="${esc(spec.description)}">
<meta name="theme-color" content="#ff6b00">
<link rel="canonical" href="${URL}">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="apple-touch-icon" href="/assets/logo.png">
<meta property="og:type" content="article"><meta property="og:site_name" content="Rapid+ Blog">
<meta property="og:title" content="${esc(spec.title)} | Rapid+ Blog"><meta property="og:description" content="${esc(spec.description)}">
<meta property="og:url" content="${URL}"><meta property="og:image" content="${SITE}${IMG}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(spec.heroAlt)}"><meta property="og:locale" content="en_US">
<meta property="article:published_time" content="${spec.date}"><meta property="article:section" content="${esc(spec.category)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(spec.title)} | Rapid+ Blog"><meta name="twitter:description" content="${esc(spec.description)}"><meta name="twitter:image" content="${SITE}${IMG}">
<meta name="robots" content="index, follow, max-image-preview:large">
`;
  const tplObj = JSON.parse(tpl.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"Article"[\s\S]*?)<\/script>/)[1]);
  const article = { ...tplObj, headline: spec.title, description: spec.description, image: SITE + IMG, datePublished: spec.date, dateModified: spec.date };
  if (article.mainEntityOfPage) article.mainEntityOfPage = { ...article.mainEntityOfPage, '@id': URL };
  if (article.articleSection) article.articleSection = spec.category;
  if (article.wordCount) article.wordCount = words;
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' }, { '@type': 'ListItem', position: 3, name: spec.title, item: URL }] };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const ld = [article, crumbs, faqLd].map(o => `<script type="application/ld+json">${jsonSafe(o)}</script>`).join('\n') + '\n';
  const afterLd = tpl.slice(tpl.indexOf('<link rel="preconnect"'), tpl.indexOf('<main>'));
  const header = `<main>
<article>
<header class="post-head">
  <div class="crumbs"><a href="/blog/">Rapid+ Blog</a> / <a href="/blog/category/${catSlug}">${esc(spec.category)}</a></div>
  <a class="chip" href="/blog/category/${catSlug}">${esc(spec.category)}</a>
  <h1>${esc(spec.title)}</h1>
  <p class="dek">${esc(spec.dek)}</p>
  <div class="byline"><img src="/assets/logo.png" alt=""><div><span><b>Rapid+ Team</b> · ${dateHuman} · ${mins} min read</span></div></div>
</header>
<figure class="post-hero"><img src="${IMG}" width="1200" height="630" alt="${esc(spec.heroAlt)}" fetchpriority="high"></figure>
<div class="post-layout">
  <nav class="post-toc" aria-label="On this page"><h4>On this page</h4>${toc}</nav>
  <div class="prose">
`;
  const end = `<div class="post-end"><img src="/assets/logo.png" alt=""><p><b>Written by the Rapid+ Team</b>. We build Rapid+ Browser for Android and Windows. Spotted a mistake or have a question? Email us at <a href="mailto:admin@rapidplusbrowser.online">admin@rapidplusbrowser.online</a>.</p></div>

  </div>
</div>
</article>
<section class="alt"><div class="wrap">
  <h2 class="title">Keep reading</h2>
  <div class="postgrid">${cards}</div>
</div></section>
`;
  fs.writeFileSync(path.join(blogDir, spec.slug + '.html'), head + ld + afterLd + header + body + '\n' + end + tpl.slice(tpl.indexOf('</main>')));

  // ---- sitemap line, then home / categories / feed / search
  const smPath = path.join(root, 'sitemap.xml'); let sm = fs.readFileSync(smPath, 'utf8'); const crlf = sm.includes('\r\n'); sm = sm.split('\r\n').join('\n');
  const anchor = sm.match(/( *)<url><loc>https:\/\/rapidplusbrowser\.online\/blog\/binance-hack<\/loc>[^\n]*\n/);
  if (anchor && !sm.includes(`/blog/${spec.slug}<`)) {
    sm = sm.replace(anchor[0], anchor[0] + anchor[0].replace('binance-hack', spec.slug).replace(/\d{4}-\d{2}-\d{2}/, spec.date));
    fs.writeFileSync(smPath, crlf ? sm.split('\n').join('\r\n') : sm);
  }
  console.log(cp.execFileSync(process.execPath, [path.join(__dirname, 'build-blog.js')], { cwd: root, encoding: 'utf8' }).trim());
  console.log(`OK: blog/${spec.slug}.html (${words} words, ${mins} min read), assets/blog/${spec.slug}.jpg (${Math.round(st.size / 1024)} KB)`);
})().catch(e => fail(e.message));
