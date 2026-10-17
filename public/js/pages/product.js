import '../lib/layout.js';
import { api } from '../lib/api.js';
import { esc, rs, stars, photos, show } from '../lib/cards.js';
const box = document.querySelector('#item');
const id = new URLSearchParams(location.search).get('id');
const arrow = right => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${right ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}"/></svg>`;
const titleCase = s => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// Turn "ANTI-SHATTER: ... PERFECT FIT - ..." style text into small feature cards
function features(text) {
  const parts = text.split(/(?=\b[A-Z][A-Z\-' ]{3,}[A-Z]\s*(?::|-\s))/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return `<p style="white-space:pre-line;margin:0">${esc(text)}</p>`;
  return `<div class="feats">${parts.map(s => {
    const m = s.match(/^([A-Z][A-Z\-' ]+[A-Z])\s*(?::|-)\s*([\s\S]*)$/);
    return `<div class="feat">${m ? `<b>${esc(titleCase(m[1]))}</b><p>${esc(m[2])}</p>` : `<p>${esc(s)}</p>`}</div>`;
  }).join('')}</div>`;
}

api('/products/' + encodeURIComponent(id)).then(async p => {
  const imgs = photos(p), link = /^https?:\/\//i.test(p.link) ? p.link : '#';
  const off = p.old > p.price && p.price > 0 ? Math.round(100 - p.price / p.old * 100) : 0;
  const meta = (p.brand ? `<span>Brand: <b>${esc(p.brand)}</b></span>` : '') + stars(p);
  document.title = p.title + ' | Smart Shopping';
  box.innerHTML = `<div class="pd">
    <div class="box"><div class="stage" id="stage" tabindex="0" aria-label="Product photos. Use the left and right arrow keys to browse.">
      ${imgs.length ? `<img id="main" src="${esc(imgs[0])}" alt="${esc(p.title)}" referrerpolicy="no-referrer">` : `<b>${esc(p.title[0])}</b>`}
      ${imgs.length > 1 ? `<button class="arrow l" data-d="-1" aria-label="Previous photo">${arrow(0)}</button><button class="arrow r" data-d="1" aria-label="Next photo">${arrow(1)}</button><span class="count" id="count">1 / ${imgs.length}</span>` : ''}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button class="th2" aria-label="Show photo ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(u)}" alt="" referrerpolicy="no-referrer"></button>`).join('')}</div>` : ''}</div>
    <div class="box info">${p.cat ? `<span class="chip2">${esc(p.cat)}</span>` : ''}<h1>${esc(p.title)}</h1>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      ${p.price ? `<div class="pricebox"><div class="pr">${rs(p.price)}${p.old > p.price ? `<s>${rs(p.old)}</s>` : ''}</div>${off ? `<span class="save">Save ${off}%</span>` : ''}</div>` : ''}
      ${p.note ? `<p class="pick">${esc(p.note)}</p>` : ''}
      <a class="btn orange" href="${esc(link)}" target="_blank" rel="sponsored nofollow noopener">Buy on Daraz</a>
      <p class="fine">Affiliate link: I earn a small commission if you buy, at no extra cost to you. Check the final price on Daraz.</p></div></div>
    ${p.desc ? `<section class="about"><div class="box"><h2>About this product</h2>${features(p.desc)}</div></section>` : ''}
    <section class="more" id="more"></section>`;

  if (imgs.length > 1) {
    let cur = 0;
    const main = box.querySelector('#main'), count = box.querySelector('#count'), stage = box.querySelector('#stage'), ths = [...box.querySelectorAll('.th2')];
    const go = i => {
      cur = (i + imgs.length) % imgs.length; main.src = imgs[cur]; count.textContent = `${cur + 1} / ${imgs.length}`;
      ths.forEach((t, k) => t.setAttribute('aria-pressed', k === cur)); ths[cur].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    box.querySelectorAll('.arrow').forEach(b => b.onclick = () => go(cur + +b.dataset.d));
    ths.forEach((t, k) => t.onclick = () => go(k));
    stage.onkeydown = e => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); };
    let x0 = null;
    stage.onpointerdown = e => { x0 = e.clientX; };
    stage.onpointerup = e => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(cur + (e.clientX < x0 ? 1 : -1)); x0 = null; };
  }

  const all = await api('/products').catch(() => []);
  const rel = all.filter(x => x.id !== p.id).sort((a, b) => (b.cat === p.cat) - (a.cat === p.cat)).slice(0, 4);
  if (rel.length) { const m = box.querySelector('#more'); m.innerHTML = '<h2>More finds</h2><div class="grid"></div>'; show(rel, m.querySelector('.grid')); }
}).catch(() => { box.innerHTML = '<p class="empty">This product was not found.</p>'; });
