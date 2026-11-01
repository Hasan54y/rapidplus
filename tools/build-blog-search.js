// Rebuilds blog/search.json (title, summary, category and full text of every article) for the blog's search box.
// Run after adding or editing an article:  node tools/build-blog-search.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'blog');
const dec = s => s.replace(/&nbsp;/g, ' ').replace(/&mdash;|&ndash;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = h => dec(h.replace(/<(script|style|svg|nav)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/([.!?])\1+/g, '$1').trim();
const posts = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html')) {
  const h = fs.readFileSync(path.join(dir, f), 'utf8');
  const slug = f.replace(/\.html$/, '');
  const m = (re) => { const x = h.match(re); return x ? strip(x[1]) : ''; };
  const title = m(/<h1[^>]*>([\s\S]*?)<\/h1>/), desc = m(/<p class="dek">([\s\S]*?)<\/p>/), cat = m(/<span class="chip">([\s\S]*?)<\/span>/);
  const body = h.match(/<div class="post-layout">([\s\S]*?)<\/article>/);
  const meta = m(/<div class="byline">[\s\S]*?<span>([\s\S]*?)<\/span>/);
  if (!title || !body) { console.warn('skipped', f); continue; }
  const date = (meta.match(/\d{1,2} \w{3} \d{4}/) || [''])[0], mins = (meta.match(/(\d+) min read/) || [, ''])[1];
  posts.push({ slug, title, desc, cat, date, mins: mins ? +mins : 0, text: strip(body[1]) });
}
posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.title.localeCompare(b.title));
fs.writeFileSync(path.join(dir, 'search.json'), JSON.stringify(posts));
console.log(posts.length + ' articles indexed, ' + Math.round(fs.statSync(path.join(dir, 'search.json')).size / 1024) + ' KB');
