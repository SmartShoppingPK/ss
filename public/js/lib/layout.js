// Shared header, ticker and footer so every page stays in sync
const links = [['/', 'Home'], ['/shop/', 'Shop'], ['/about/', 'About']];
const here = location.pathname.replace(/index\.html$/, '');
const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
set('top', `<a class="logo" href="/" aria-label="Smart Shopping home"><img src="/img/logo.svg" alt="" width="46" height="46"></a><nav>${links.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`);
const t = '<span>*New Daraz finds*</span>'.repeat(8);
set('ticker', `<div>${t}${t}</div>`);
set('foot', `<p>Affiliate disclosure: I earn a small commission when you buy through links on this site, at no extra cost to you. Prices and stock on Daraz can change.</p><nav><a href="/about/">About</a></nav>`);
