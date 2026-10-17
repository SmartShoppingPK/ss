const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

// Load .env (no packages needed)
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
} } catch {}

const PASS = process.env.ADMIN_PASSWORD;
if (!PASS || PASS.length < 8) { console.error('Set ADMIN_PASSWORD (8+ characters) in .env'); process.exit(1); }
const SECRET = process.env.SECRET || crypto.createHash('sha256').update('dp:' + PASS).digest('hex');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public'), DB = path.join(__dirname, 'data', 'products.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

// Session cookie: expiry + HMAC signature
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const mkToken = () => { const e = Date.now() + 7 * 864e5; return e + '.' + sign('' + e); };
const okToken = t => {
  if (!t) return false; const [e, s] = t.split('.'); if (!e || !s || +e < Date.now()) return false;
  const x = sign(e); return s.length === x.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(x));
};
const isAdmin = req => okToken(((req.headers.cookie || '').match(/(?:^|; )adm=([^;]+)/) || [])[1]);

const read = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')).map(p => ({ ...p, imgs: p.imgs || (p.img ? [p.img] : []) })); } catch { return []; } };
const write = l => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB + '.tmp', JSON.stringify(l, null, 2)); fs.renameSync(DB + '.tmp', DB); };
const send = (res, code, obj, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(obj)); };
const body = (req, max = 6e6) => new Promise((ok, no) => {
  let b = '', n = 0;
  req.on('data', c => { n += c.length; if (n > max) { no(new Error('File too big.')); req.destroy(); } else b += c; });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } });
});
const URLRE = /^(\/uploads\/[\w.-]+|https:\/\/[^\s"'<>]{4,480})$/;
const num = v => Math.max(0, +v || 0);
const clean = b => ({
  title: String(b.title || '').trim().slice(0, 200), link: String(b.link || '').trim(), source: String(b.source || '').trim().slice(0, 500),
  imgs: (Array.isArray(b.imgs) ? b.imgs : []).map(String).slice(0, 10), cat: String(b.cat || '').trim().slice(0, 40), brand: String(b.brand || '').trim().slice(0, 60),
  note: String(b.note || '').trim().slice(0, 300), desc: String(b.desc || '').trim().slice(0, 3000),
  price: num(b.price), old: num(b.old), rating: Math.min(5, num(b.rating)), reviews: Math.round(num(b.reviews))
});
const check = c => !c.title ? 'Add a product name.' : !/^https?:\/\//i.test(c.link) ? 'Add a link that starts with https://' : c.imgs.some(u => !URLRE.test(u)) ? 'A photo link is not valid. Image links must start with https://' : '';

// ---- Import product details from a Daraz product page (best effort) ----
const DARAZ = /(^|\.)daraz\.(pk|com\.bd|lk|com\.np|com)$/i;
const unent = s => String(s || '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
async function getPage(url) {
  for (let i = 0; i < 5; i++) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !DARAZ.test(u.hostname)) throw new Error('Paste a product link from daraz.pk (or another Daraz site).');
    const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), u).href; continue; }
    if (!r.ok) throw new Error('Daraz answered with error ' + r.status + '.');
    return (await r.text()).slice(0, 4e6);
  }
  throw new Error('Too many redirects.');
}
async function importDaraz(url) {
  let u; try { u = new URL(url); } catch { throw new Error('Paste the full product link, starting with https://'); }
  const html = await getPage(u.href), ld = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1]); ld.push(...(Array.isArray(j) ? j : j['@graph'] || [j])); } catch {}
  }
  const type = x => [].concat(x['@type'] || []).join();
  const prod = ld.find(x => /Product/.test(type(x))) || {};
  const crumbs = ((ld.find(x => /BreadcrumbList/.test(type(x))) || {}).itemListElement || []).map(i => unent(i.name || (i.item && i.item.name)));
  const meta = n => unent((html.match(new RegExp('<meta[^>]+(?:property|name)="' + n + '"[^>]+content="([^"]*)"', 'i')) || [])[1]);
  const rx = re => (html.match(re) || [])[1];
  const offer = [].concat(prod.offers || [])[0] || {}, agg = prod.aggregateRating || {};
  const gi = html.indexOf('"skuGalleries"');
  const gal = gi < 0 ? [] : [...html.slice(gi, gi + 8000).matchAll(/"src"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const imgs = [...new Set([...gal, ...[].concat(prod.image || []), meta('og:image')]
    .filter(x => typeof x === 'string').map(x => x.replace(/\\\//g, '/').replace(/^\/\//, 'https://').replace(/(\.(?:jpe?g|png|webp))_.*$/i, '$1'))
    .filter(x => /^https:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)$/i.test(x)))].slice(0, 10);
  const title = unent(prod.name || meta('og:title') || rx(/<title[^>]*>([^<]*)/i)).replace(/\s*[|\-–]\s*Daraz.*$/i, '');
  if (!title || (!prod.name && /captcha|punish|unusual traffic/i.test(html))) throw new Error('Daraz did not return the product details (it may have blocked the request). Fill the form by hand, or try again later.');
  // Daraz keeps its data in different places on different pages, so try several, also in escaped form
  const flat = html.replace(/\\"/g, '"').replace(/\\u002F/gi, '/');
  const first = (...res) => { for (const re of res) for (const t of [html, flat]) { const m = t.match(re); const v = m && +String(m[1]).replace(/,/g, ''); if (v > 0) return v; } return 0; };
  const fm = re => (flat.match(re) || [])[1];
  let brand = unent(typeof prod.brand === 'string' ? prod.brand : (prod.brand || {}).name);
  if (!brand) brand = unent(fm(/"brand"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/) || fm(/"brand(?:Name|_name)"\s*:\s*"([^"]+)"/));
  const price = +(offer.price ?? offer.lowPrice) || first(
    /"salePrice"\s*:\s*\{[^}]*?"value"\s*:\s*"?([\d,.]+)/, /"salePrice"\s*:\s*\{[^}]*?"text"\s*:\s*"[^"\d]*([\d,]+(?:\.\d+)?)"/, /"salePrice"\s*:\s*"?([\d,.]+)/,
    /"(?:discountPrice|promotionPrice|specialPrice|currentPrice|finalPrice)"\s*:\s*"?([\d,.]+)/,
    /<meta[^>]+(?:product|og):price:amount"[^>]+content="([\d,.]+)"/i, /itemprop="price"[^>]+content="([\d,.]+)"/i,
    /"price"\s*:\s*"?([\d,.]+)"?\s*,\s*"priceCurrency"/, /"priceCurrency"\s*:\s*"[A-Z]{3}"\s*,\s*"price"\s*:\s*"?([\d,.]+)/,
    /"(?:priceShow|priceText|displayPrice|salePriceText)"\s*:\s*"[^"\d]*([\d,]+(?:\.\d+)?)"/);
  let old = first(
    /"originalPrice"\s*:\s*\{[^}]*?"value"\s*:\s*"?([\d,.]+)/, /"originalPrice"\s*:\s*\{[^}]*?"text"\s*:\s*"[^"\d]*([\d,]+(?:\.\d+)?)"/, /"originalPrice"\s*:\s*"?([\d,.]+)/,
    /"(?:listPrice|marketPrice|retailPrice|priceBefore|beforePrice|oldPrice)"\s*:\s*"?([\d,.]+)/, /"originalPriceText"\s*:\s*"[^"\d]*([\d,]+(?:\.\d+)?)"/);
  if (old <= price) old = 0;
  let hint = '';
  if (!price) {
    hint = 'The price was not in the page Daraz sent, so enter it by hand. What Daraz sent was saved to data/last-import.txt in case it needs fixing.';
    try { fs.writeFileSync(path.join(__dirname, 'data', 'last-import.txt'), [...flat.matchAll(/price/gi)].slice(0, 25).map(m => flat.slice(Math.max(0, m.index - 80), m.index + 120).replace(/\s+/g, ' ')).join('\n---\n')); } catch {}
  }
  return {
    title, source: u.href, imgs, brand: /^no ?brand$/i.test(brand) ? '' : brand, price, old, hint,
    rating: +agg.ratingValue || first(/"ratingScore"\s*:\s*"?([\d.]+)/, /"ratings"\s*:\s*\{[^}]*?"average"\s*:\s*"?([\d.]+)/),
    reviews: +(agg.reviewCount ?? agg.ratingCount) || first(/"ratings"\s*:\s*\{[^}]*?"(?:rateCount|reviewCount|ratingCount|count)"\s*:\s*"?(\d+)/, /"(?:reviewCount|ratingCount|reviewTotal|totalReviews)"\s*:\s*"?(\d+)/),
    desc: unent(prod.description || meta('og:description') || meta('description')).slice(0, 3000),
    cat: crumbs.length > 2 ? crumbs[crumbs.length - 2] : ''
  };
}

const tries = {};
async function api(req, res, u) {
  const m = req.method, p = u.pathname;
  if (p === '/api/products' && m === 'GET') return send(res, 200, read());
  const one = p.match(/^\/api\/products\/([\w-]+)$/);
  if (one && m === 'GET') { const x = read().find(y => y.id === one[1]); return x ? send(res, 200, x) : send(res, 404, { error: 'Product not found.' }); }
  if (p === '/api/me') return send(res, 200, { admin: isAdmin(req) });
  if (p === '/api/logout') return send(res, 200, { ok: 1 }, { 'Set-Cookie': 'adm=; HttpOnly; Path=/; Max-Age=0' });
  if (p === '/api/login' && m === 'POST') {
    const ip = req.socket.remoteAddress, t = tries[ip] || (tries[ip] = { n: 0, at: Date.now() });
    if (Date.now() - t.at > 6e5) { t.n = 0; t.at = Date.now(); }
    if (t.n >= 5) return send(res, 429, { error: 'Too many attempts. Try again in 10 minutes.' });
    const { password = '' } = await body(req, 1e4), h = s => crypto.createHash('sha256').update(String(s)).digest();
    if (!crypto.timingSafeEqual(h(password), h(PASS))) { t.n++; return send(res, 401, { error: 'Wrong password.' }); }
    return send(res, 200, { ok: 1 }, { 'Set-Cookie': `adm=${mkToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` + (process.env.NODE_ENV === 'production' ? '; Secure' : '') });
  }
  if (!isAdmin(req)) return send(res, 401, { error: 'Log in first.' });

  if (p === '/api/upload' && m === 'POST') {
    const mm = String((await body(req)).data || '').match(/^data:image\/(png|jpeg|webp|gif);base64,(.+)$/);
    if (!mm) return send(res, 400, { error: 'Use a PNG, JPG, WebP or GIF image.' });
    const name = crypto.randomBytes(8).toString('hex') + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]);
    fs.mkdirSync(path.join(PUB, 'uploads'), { recursive: true });
    fs.writeFileSync(path.join(PUB, 'uploads', name), Buffer.from(mm[2], 'base64'));
    return send(res, 200, { url: '/uploads/' + name });
  }
  if (p === '/api/import' && m === 'POST') {
    try { return send(res, 200, await importDaraz(String((await body(req, 1e4)).url || '').trim())); }
    catch (e) { return send(res, 422, { error: e.message }); }
  }
  const id = (p.match(/^\/api\/products\/([\w-]+)$/) || [])[1];
  if (p === '/api/products' && m === 'POST') {
    const c = clean(await body(req)), e = check(c); if (e) return send(res, 400, { error: e });
    const item = { id: Date.now().toString(36), ...c }, l = read(); l.unshift(item); write(l); return send(res, 200, item);
  }
  if (id && m === 'PUT') {
    const c = clean(await body(req)), e = check(c); if (e) return send(res, 400, { error: e });
    const l = read(), i = l.findIndex(x => x.id === id); if (i < 0) return send(res, 404, { error: 'Product not found.' });
    l[i] = { ...l[i], ...c }; write(l); return send(res, 200, l[i]);
  }
  if (id && m === 'DELETE') { write(read().filter(x => x.id !== id)); return send(res, 200, { ok: 1 }); }
  send(res, 404, { error: 'Not found.' });
}

function serve(req, res, u) {
  let f = path.normalize(path.join(PUB, decodeURIComponent(u.pathname)));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!u.pathname.endsWith('/')) { res.writeHead(301, { Location: u.pathname + '/' }); return res.end(); }
    f = path.join(f, 'index.html');
  }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>Page not found</h1><a href="/">Back to the homepage</a>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); res.end(d);
  });
}

http.createServer(async (req, res) => {
  try { const u = new URL(req.url, 'http://x'); u.pathname.startsWith('/api/') ? await api(req, res, u) : serve(req, res, u); }
  catch (e) { send(res, 500, { error: e.message || 'Something went wrong.' }); }
}).listen(PORT, () => console.log('Smart Shopping running at http://localhost:' + PORT));
