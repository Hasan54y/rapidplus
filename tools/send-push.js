// Sends a browser notification for every article that is new since the last run.
//   node tools/send-push.js            send for new articles
//   node tools/send-push.js --dry      show what would be sent, change nothing
//   node tools/send-push.js --baseline mark every current article as already announced (no notifications)
//   node tools/send-push.js --test     send one test notification to every subscriber, change no state
// Needs: npm i --no-save web-push
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_BOT_EMAIL, PUSH_BOT_PASSWORD (the Firebase account that may read the
// subscriber list). The Firebase web key and project id are read from firebase-config.js.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), SITE = 'https://rapidplusbrowser.online';
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry'), BASE = args.has('--baseline'), TEST = args.has('--test');
const cfg = fs.readFileSync(path.join(root, 'firebase-config.js'), 'utf8');
const API_KEY = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1], PROJECT = (cfg.match(/projectId:\s*"([^"]+)"/) || [])[1];
const need = k => { if (!process.env[k]) { console.error('missing env ' + k); process.exit(2); } return process.env[k]; };
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- articles, newest first, from the RSS feed that build-blog.js writes
const feed = fs.readFileSync(path.join(root, 'blog', 'feed.xml'), 'utf8');
const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const posts = [...feed.matchAll(/<item><title>([\s\S]*?)<\/title><link>[^<]*\/blog\/([a-z0-9-]+)<\/link>[\s\S]*?<category>([\s\S]*?)<\/category><description>([\s\S]*?)<\/description><\/item>/g)]
  .map(m => ({ title: dec(m[1]), slug: m[2], cat: dec(m[3]), desc: dec(m[4]) }));
if (!posts.length) { console.error('no articles found in blog/feed.xml'); process.exit(1); }

async function jfetch(url, init, token) {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(init && init.headers) } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) { const err = new Error(`HTTP ${r.status} ${url.split('?')[0]} ${t.slice(0, 200)}`); err.status = r.status; throw err; }
  return j;
}

(async () => {
  const email = need('PUSH_BOT_EMAIL'), password = need('PUSH_BOT_PASSWORD');
  const auth = await jfetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, { method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const token = auth.idToken;

  // state: the slugs that were already announced
  let known = null;
  try { const d = await jfetch(`${DOCS}/push_meta/state`, {}, token); known = new Set(((d.fields.slugs || {}).arrayValue || {}).values ? d.fields.slugs.arrayValue.values.map(v => v.stringValue) : []); }
  catch (e) { if (e.status !== 404) throw e; }
  const saveState = () => jfetch(`${DOCS}/push_meta/state?updateMask.fieldPaths=slugs&updateMask.fieldPaths=updated`, { method: 'PATCH', body: JSON.stringify({ fields: { slugs: { arrayValue: { values: posts.map(p => ({ stringValue: p.slug })) } }, updated: { stringValue: new Date().toISOString() } } }) }, token);

  if (BASE || (known === null && !TEST)) {
    console.log(`${BASE ? 'baseline requested' : 'no saved state yet'}: marking ${posts.length} articles as announced, sending nothing`);
    if (!DRY) await saveState(); return;
  }
  let fresh = TEST ? [{ title: 'Test notification', slug: '', desc: 'If you can read this, article alerts work in this browser.', cat: 'Rapid+ Blog' }] : posts.filter(p => !known.has(p.slug)).reverse();
  if (!fresh.length) { console.log('nothing new'); return; }
  console.log('new:', fresh.map(p => p.slug || '(test)').join(', '));

  // let GitHub Pages finish publishing before anyone is sent a link
  if (!TEST && !DRY) for (const p of fresh) {
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { try { const r = await fetch(`${SITE}/blog/${p.slug}`, { method: 'HEAD' }); ok = r.status === 200; } catch (e) {} if (!ok) await sleep(15000); }
    if (!ok) { console.error('article is not live yet, stopping so it is retried next run:', p.slug); process.exit(1); }
  }

  // subscribers
  const subs = []; let pageToken = '';
  do {
    const d = await jfetch(`${DOCS}/push_subscribers?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, {}, token);
    for (const doc of d.documents || []) { const f = doc.fields || {}; subs.push({ id: doc.name.split('/').pop(), endpoint: (f.endpoint || {}).stringValue, p256dh: (f.p256dh || {}).stringValue, auth: (f.auth || {}).stringValue }); }
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  console.log(subs.length + ' subscribers');

  const messages = !TEST && fresh.length > 3
    ? [{ title: `${fresh.length} new articles on Rapid+ Blog`, body: fresh.slice(-3).reverse().map(p => p.title).join(' | ').slice(0, 200), url: '/blog/', tag: 'rapid-blog-batch' }]
    : fresh.map(p => ({ title: p.title, body: p.desc, url: p.slug ? `/blog/${p.slug}` : '/blog/', image: p.slug ? `/assets/blog/${p.slug}.jpg` : undefined, tag: 'rapid-blog-' + (p.slug || 'test') }));
  if (DRY) { console.log('dry run, would send:', JSON.stringify(messages, null, 1)); return; }

  const webpush = require('web-push');
  webpush.setVapidDetails('mailto:admin@rapidplusbrowser.online', need('VAPID_PUBLIC_KEY'), need('VAPID_PRIVATE_KEY'));
  let sent = 0, gone = 0, failed = 0;
  for (const msg of messages) {
    const payload = JSON.stringify(msg);
    for (let i = 0; i < subs.length; i += 20) await Promise.all(subs.slice(i, i + 20).map(async s => {
      if (!s.endpoint || !s.p256dh || !s.auth) return;
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 172800, urgency: 'normal' }); sent++; }
      catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { gone++; s.dead = true; try { await jfetch(`${DOCS}/push_subscribers/${s.id}`, { method: 'DELETE' }, token); } catch (x) {} }
        else { failed++; console.error('push failed', e.statusCode || e.message); }
      }
    }));
  }
  console.log(`sent ${sent}, removed ${gone} expired, failed ${failed}`);
  if (!TEST) await saveState();
})().catch(e => { console.error(e.message || e); process.exit(1); });
