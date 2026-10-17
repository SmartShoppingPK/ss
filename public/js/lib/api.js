export async function api(path, opt = {}) {
  const r = await fetch('/api' + path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json' }, body: opt.body && JSON.stringify(opt.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
