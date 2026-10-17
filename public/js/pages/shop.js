import '../lib/layout.js';
import { api } from '../lib/api.js';
import { show, esc } from '../lib/cards.js';
const grid = document.querySelector('#grid'), chips = document.querySelector('#chips'), q = document.querySelector('#q');
let all = [], cat = new URLSearchParams(location.search).get('cat') || 'All';

function draw() {
  const cats = ['All', ...new Set(all.map(p => p.cat).filter(Boolean))];
  if (!cats.includes(cat)) cat = 'All';
  chips.innerHTML = cats.map(c => `<button class="chip" aria-pressed="${c === cat}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  const t = q.value.toLowerCase();
  const list = all.filter(p => (cat === 'All' || p.cat === cat) && (p.title + ' ' + p.note).toLowerCase().includes(t));
  show(list, grid, all.length ? 'Nothing matches. Try another search or category.' : 'No products yet. New finds are coming soon.');
}
chips.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; draw(); } };
q.oninput = draw;
api('/products').then(l => { all = l; draw(); }).catch(() => show([], grid, 'Could not load products. Refresh the page.'));
