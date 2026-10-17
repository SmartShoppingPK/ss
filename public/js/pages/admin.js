import '../lib/layout.js';
import { api } from '../lib/api.js';
import { esc, rs, photos } from '../lib/cards.js';
const root = document.querySelector('#admin');
let list = [], editId = null, msg = '', ok = false, imgs = [];
const $ = s => root.querySelector(s);
const say = (sel, t, good) => { const m = $(sel); m.className = good ? 'ok' : 'err'; m.textContent = t; };

const boot = async () => (await api('/me')).admin ? load() : login();

function login(err = '') {
  root.innerHTML = `<form class="panel" id="lf" style="max-width:420px;margin-top:40px"><h2>Owner login</h2><label>Password<input type="password" name="password" autocomplete="current-password" required></label><p class="err">${esc(err)}</p><button class="btn">Log in</button></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    try { await api('/login', { method: 'POST', body: { password: e.target.password.value } }); boot(); }
    catch (x) { login(x.message); }
  };
}

async function load() { list = await api('/products'); draw(); }

// Shrink uploaded photos in the browser so they stay small
async function shrink(file) {
  const b = await createImageBitmap(file), s = Math.min(1, 900 / Math.max(b.width, b.height));
  const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(b, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85);
}

function drawGal() {
  const g = $('#gal');
  g.innerHTML = imgs.length ? imgs.map((u, i) => `<div class="gi"><img src="${esc(u)}" alt="" referrerpolicy="no-referrer"><span>${i ? 'Photo ' + (i + 1) : 'Cover photo'}</span>${i ? `<button type="button" data-c="${i}">Make cover</button>` : ''}<button type="button" data-x="${i}">Remove</button></div>`).join('') : '<p class="fine">No photos yet.</p>';
  g.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { imgs.unshift(...imgs.splice(+b.dataset.c, 1)); drawGal(); });
  g.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { imgs.splice(+b.dataset.x, 1); drawGal(); });
}

function draw() {
  const p = list.find(x => x.id === editId) || {};
  imgs = [...photos(p)];
  root.innerHTML = `<div class="bar"><h2 style="margin:0">${editId ? 'Edit product' : 'Add a product'}</h2><button class="btn ghost" id="out">Log out</button></div>
  <div class="panel" style="margin-top:16px"><h3>Import from Daraz</h3><p class="fine" style="margin:4px 0 10px">Paste a Daraz product page link to fill in the name, photos, prices, rating and description for you.</p>
    <div class="addrow"><input id="srcurl" type="url" placeholder="https://www.daraz.pk/products/..." aria-label="Daraz product page link"><button type="button" class="btn" id="imp">Import details</button></div><p id="impm" class="ok"></p></div>
  <form class="panel f" id="pf">
    <input type="hidden" name="source" value="${esc(p.source)}">
    <label class="span">Product name<input name="title" required maxlength="200" value="${esc(p.title)}"></label>
    <label class="span">Your Daraz affiliate link (the one that earns you commission)<input name="link" type="url" required placeholder="https://..." value="${esc(p.link)}"></label>
    <label>Price (Rs.)<input name="price" type="number" min="0" step="any" value="${esc(p.price || '')}"></label>
    <label>Old price (Rs.)<input name="old" type="number" min="0" step="any" value="${esc(p.old || '')}"></label>
    <label>Brand<input name="brand" maxlength="60" value="${esc(p.brand)}"></label>
    <label>Category<input name="cat" maxlength="40" value="${esc(p.cat)}"></label>
    <label>Rating (0 to 5)<input name="rating" type="number" min="0" max="5" step="0.1" value="${esc(p.rating || '')}"></label>
    <label>Number of reviews<input name="reviews" type="number" min="0" value="${esc(p.reviews || '')}"></label>
    <div class="span"><b style="font-size:14px">Photos (the first one is the cover, up to 10)</b><div id="gal"></div>
      <div class="addrow"><input id="imgurl" type="url" placeholder="Paste an image link (https://...)" aria-label="Image link"><button type="button" class="btn ghost" id="addurl">Add link</button></div>
      <label style="margin-top:10px">Or upload from your device<input id="files" type="file" accept="image/*" multiple></label><p id="gm" class="ok"></p></div>
    <label class="span">Why you recommend it (short)<textarea name="note" rows="2" maxlength="300">${esc(p.note)}</textarea></label>
    <label class="span">Full description<textarea name="desc" rows="5" maxlength="3000">${esc(p.desc)}</textarea></label>
    <div class="span"><button class="btn orange">${editId ? 'Save changes' : 'Add product'}</button> ${editId ? '<button type="button" class="btn ghost" id="cx">Cancel</button>' : ''}<p class="${ok ? 'ok' : 'err'}" id="m">${esc(msg)}</p></div>
  </form>
  <h2>Your products (${list.length})</h2>
  ${list.map(x => `<div class="row">${photos(x)[0] ? `<img src="${esc(photos(x)[0])}" alt="" referrerpolicy="no-referrer">` : '<span class="th"></span>'}<div><b>${esc(x.title)}</b><br><small>${x.price ? rs(x.price) : 'No price'}</small></div><button class="btn ghost" data-e="${x.id}">Edit</button><button class="btn ghost" data-d="${x.id}">Delete</button></div>`).join('') || '<p class="empty">Nothing here yet. Add your first product above.</p>'}`;
  drawGal();

  $('#out').onclick = async () => { await api('/logout', { method: 'POST' }); login(); };
  $('#cx')?.addEventListener('click', () => { editId = null; msg = ''; draw(); });
  root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { editId = b.dataset.e; msg = ''; draw(); scrollTo(0, 0); });
  root.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (confirm('Delete this product?')) { await api('/products/' + b.dataset.d, { method: 'DELETE' }); load(); } });

  $('#imp').onclick = async e => {
    const b = e.target, f = $('#pf'); b.disabled = true; say('#impm', 'Fetching details from Daraz...', true);
    try {
      const r = await api('/import', { method: 'POST', body: { url: $('#srcurl').value.trim() } });
      for (const k of ['title', 'brand', 'price', 'old', 'rating', 'reviews', 'desc', 'source']) if (r[k]) f.elements[k].value = r[k];
      if (r.cat && !f.elements.cat.value) f.elements.cat.value = r.cat;
      if (r.imgs.length) { imgs = r.imgs; drawGal(); }
      const miss = ['price', 'old', 'rating', 'reviews', 'brand', 'desc'].filter(k => !r[k]).concat(r.imgs.length ? [] : ['photos']);
      say('#impm', 'Imported.' + (r.hint ? ' ' + r.hint : '') + (miss.length ? ' Not on the page (Daraz may not list them): ' + miss.join(', ') + '.' : '') + ' Now paste your own affiliate link below and save.', true);
    } catch (x) { say('#impm', x.message, false); }
    b.disabled = false;
  };
  const addUrl = () => {
    const i = $('#imgurl'), v = i.value.trim();
    if (!/^https:\/\/\S+$/i.test(v)) return say('#gm', 'Image links must start with https://', false);
    if (imgs.length >= 10) return say('#gm', 'You can add up to 10 photos.', false);
    imgs.push(v); i.value = ''; say('#gm', '', true); drawGal();
  };
  $('#addurl').onclick = addUrl;
  $('#imgurl').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } };
  $('#files').onchange = async e => {
    say('#gm', 'Uploading...', true);
    try { for (const f of e.target.files) { if (imgs.length < 10) imgs.push((await api('/upload', { method: 'POST', body: { data: await shrink(f) } })).url); } say('#gm', '', true); }
    catch (x) { say('#gm', x.message, false); }
    e.target.value = ''; drawGal();
  };
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button.orange'); btn.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(f)); body.imgs = imgs;
      await api('/products' + (editId ? '/' + editId : ''), { method: editId ? 'PUT' : 'POST', body });
      msg = 'Saved. It is live on the site.'; ok = true; editId = null; load();
    } catch (x) { msg = x.message; ok = false; btn.disabled = false; say('#m', msg, false); }
  };
}
boot().catch(() => login('Could not reach the server.'));
