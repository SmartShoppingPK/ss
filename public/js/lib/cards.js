export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rs = n => 'Rs. ' + Number(n).toLocaleString('en-PK');
const safe = u => /^https?:\/\//i.test(u) ? u : '#';
export const photos = p => p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
export const stars = p => p.rating > 0 ? `<span class="rt">★ ${(+p.rating).toFixed(1)}${p.reviews ? ` (${Number(p.reviews).toLocaleString('en-PK')})` : ''}</span>` : '';

export function card(p) {
  const off = p.old > p.price && p.price > 0 ? `<span class="off">-${Math.round(100 - p.price / p.old * 100)}%</span>` : '';
  const c = photos(p)[0], href = '/product/?id=' + encodeURIComponent(p.id);
  const pic = c ? `<img src="${esc(c)}" alt="${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer">` : `<b>${esc((p.title || '?')[0])}</b>`;
  const price = p.price ? `<div class="pr">${rs(p.price)}${p.old > p.price ? `<s>${rs(p.old)}</s>` : ''}</div>` : '';
  return `<article class="card"><a class="pic" href="${href}" aria-label="${esc(p.title)}">${pic}${off}</a><div class="bd">${p.cat ? `<small>${esc(p.cat)}</small>` : ''}<h3><a href="${href}">${esc(p.title)}</a></h3>${stars(p)}${p.note ? `<p>${esc(p.note)}</p>` : ''}${price}<a class="btn orange" href="${esc(safe(p.link))}" target="_blank" rel="sponsored nofollow noopener">Buy on Daraz</a></div></article>`;
}
export const show = (list, box, empty) => { box.innerHTML = list.length ? list.map(card).join('') : `<p class="empty">${empty}</p>`; };
