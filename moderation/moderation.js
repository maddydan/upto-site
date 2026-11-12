let session, base, apiKey;
const $ = (id) => document.getElementById(id);
const message = (text) => { $('message').textContent = text; };
async function call(action) {
  const response = await fetch(`${base}/functions/v1/moderation`, { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, apikey: apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(action), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function node(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
function button(card, label, action, danger = false) {
  const el = node('button', label); if (danger) el.className = 'reject';
  el.onclick = async () => { const buttons = [...card.querySelectorAll('button')]; buttons.forEach((b) => b.disabled = true); try { await action(); await load(); } catch (e) { message(e.message); } finally { buttons.forEach((b) => b.disabled = false); } };
  card.append(el);
}
async function load() {
  message('Loading queue…');
  const data = await call({ action: 'queue' });
  $('photos').replaceChildren(); $('reports').replaceChildren();
  $('photo-count').textContent = `(${data.photos.length})`; $('report-count').textContent = `(${data.reports.length})`;
  for (const photo of data.photos) {
    const card = node('article', ''); card.append(node('h3', photo.display_name || 'Profile image'));
    if (photo.url) { const img = document.createElement('img'); img.src = photo.url; img.alt = 'Profile photo awaiting review'; img.referrerPolicy = 'no-referrer'; card.append(img); } else card.append(node('p', 'Image unavailable. Refresh before making a decision.'));
    card.append(node('p', new Date(photo.updated_at).toLocaleString()));
    if (photo.url) button(card, 'Approve image', () => call({ action: 'photo', id: photo.id, path: photo.avatar_path, version: photo.updated_at, decision: 'approved' }));
    button(card, 'Reject image', () => call({ action: 'photo', id: photo.id, path: photo.avatar_path, version: photo.updated_at, decision: 'rejected' }), true);
    $('photos').append(card);
  }
  for (const report of data.reports) {
    const card = node('article', ''); card.append(node('h3', `${report.target_type} · ${report.reason}`), node('p', `${report.status} · ${new Date(report.created_at).toLocaleString()}`), node('pre', report.content_snapshot), node('p', report.details || 'No additional details'), node('p', `Content ID: ${report.target_id}`));
    const label = node('label', 'Review notes (required)'); const notes = document.createElement('textarea'); notes.maxLength = 2000; label.append(notes); card.append(label);
    for (const [title, decision] of [['Start review', 'reviewing'], ['Keep content / dismiss report', 'dismissed'], [report.target_type === 'profile' ? 'Remove profile text / resolve' : 'Remove content / resolve', 'remove'], ...(report.target_type === 'profile' ? [['Reject reported photo / resolve', 'reject_photo']] : [])]) button(card, title, () => { if (!notes.value.trim()) throw new Error('Add review notes before saving.'); if (['remove', 'reject_photo'].includes(decision) && !window.confirm(`${title}? This changes the reported content and records your decision.`)) return; return call({ action: 'report', id: report.id, version: report.status, decision, notes: notes.value }); });
    $('reports').append(card);
  }
  if (!data.photos.length) $('photos').append(node('p', 'No images awaiting review.'));
  if (!data.reports.length) $('reports').append(node('p', 'No open reports.'));
  const history = await call({ action: 'history' });
  $('history').replaceChildren(...history.reports.map((r) => { const card = node('article', ''); card.append(node('h3', `${r.target_type} · ${r.status}`), node('pre', r.content_snapshot), node('p', r.reviewer_notes || 'No notes recorded'), node('p', r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : '')); return card; }));
  message('Queue updated. Image previews expire after five minutes.');
}
$('login').onsubmit = async (event) => {
  event.preventDefault(); const submit = event.target.querySelector('button'); submit.disabled = true;
  try {
    const url = new URL(window.UPTO_MODERATION.url); if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('Enter your HTTPS Supabase project URL.');
    base = url.origin; apiKey = window.UPTO_MODERATION.key;
    const response = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...($('email').value.trim().startsWith('+') ? { phone: $('email').value.trim().replace(/[\s()-]/g, '') } : { email: $('email').value.trim() }), password: $('password').value }) });
    const data = await response.json(); if (!response.ok) throw new Error('Sign in failed. Check your credentials.'); session = data; $('password').value = '';
    await load(); $('login').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
  } catch (e) { session = null; message(e.message); } finally { submit.disabled = false; }
};
$('refresh').onclick = () => load().catch((e) => message(e.message));
$('logout').onclick = async () => { try { await fetch(`${base}/auth/v1/logout`, { method: 'POST', headers: { apikey: apiKey, authorization: `Bearer ${session.access_token}` } }); } finally { session = null; $('photos').replaceChildren(); $('reports').replaceChildren(); $('history').replaceChildren(); $('workspace').hidden = true; $('logout').hidden = true; $('login').hidden = false; message('Signed out.'); } };
