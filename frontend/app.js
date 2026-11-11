// Minimal, framework-free client. All user content is inserted with textContent/append
// (never innerHTML) so stored data cannot inject markup.
const main = document.getElementById('main');
const nav = document.getElementById('nav');
const msg = document.getElementById('msg');
const API_URL = (window.API_URL || '').replace(/\/$/, '');

let token = localStorage.getItem('token');
let me = null;
let tab = 'notes';

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids.filter((k) => k != null));
  return n;
}

function say(text, ok = false) {
  msg.textContent = text || '';
  msg.className = ok ? 'ok' : '';
}

async function api(path, method = 'GET', body) {
  const res = await fetch(API_URL + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) logout();
    throw new Error(data?.message || 'Request failed');
  }
  return data;
}

// run an async action and show errors
const run = (fn) => async (e) => {
  e?.preventDefault?.();
  say('');
  try { await fn(e); } catch (err) { say(err.message); }
};

// fields: [{ name, label, type?, options?, value?, required? }]
function form(fields, onSubmit, submitLabel, extra) {
  const f = el('form', { onsubmit: run(async () => {
    const out = {};
    for (const fld of fields) out[fld.name] = f.elements[fld.name].value;
    await onSubmit(out);
  }) });
  for (const fld of fields) {
    let input;
    if (fld.type === 'textarea') input = el('textarea', { name: fld.name, rows: 4 });
    else if (fld.type === 'select')
      input = el('select', { name: fld.name }, ...fld.options.map((o) => el('option', { value: o }, o)));
    else input = el('input', { name: fld.name, type: fld.type || 'text' });
    if (fld.required) input.required = true;
    if (fld.value !== undefined) input.value = fld.value;
    f.append(el('label', {}, fld.label, input));
  }
  f.append(el('button', { type: 'submit' }, submitLabel));
  if (extra) f.append(extra);
  return f;
}

function pager(meta, go) {
  const hasNext = meta.pages !== undefined ? meta.page < meta.pages : meta.hasNext;
  const info = meta.pages !== undefined
    ? `Page ${meta.page} of ${Math.max(meta.pages, 1)} (${meta.total} total)`
    : `Page ${meta.page}`;
  return el('div', { class: 'pager' },
    el('button', { disabled: meta.page <= 1, onclick: () => go(meta.page - 1) }, 'Prev'),
    el('span', {}, info),
    el('button', { disabled: !hasNext, onclick: () => go(meta.page + 1) }, 'Next'));
}

const splitInterests = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const fmt = (d) => new Date(d).toLocaleString();

// ---------- auth ----------
function logout() {
  token = null; me = null;
  localStorage.removeItem('token');
  render();
}

async function onAuth(path, body) {
  const data = await api(path, 'POST', body);
  token = data.token;
  me = data.user;
  localStorage.setItem('token', token);
  tab = 'notes';
  render();
}

function authView() {
  main.replaceChildren(
    el('h2', {}, 'Login'),
    form([
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ], (v) => onAuth('/auth/login', v), 'Login'),
    el('h2', {}, 'Register'),
    form([
      { name: 'name', label: 'Name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password (8+ chars)', type: 'password', required: true },
      { name: 'interests', label: 'Interests (comma separated)' },
    ], (v) => onAuth('/auth/register', { ...v, interests: splitInterests(v.interests) }), 'Register')
  );
}

// ---------- notes ----------
async function notesView(page = 1, editing = null) {
  const data = await api(`/notes?page=${page}&limit=5`);
  main.replaceChildren(
    el('h2', {}, editing ? 'Edit note' : 'New note'),
    form([
      { name: 'title', label: 'Title', required: true, value: editing?.title },
      { name: 'content', label: 'Content', type: 'textarea', value: editing?.content },
    ], async (v) => {
      if (editing) await api('/notes/' + editing._id, 'PATCH', v);
      else await api('/notes', 'POST', v);
      say(editing ? 'Note updated' : 'Note created', true);
      notesView(1);
    }, editing ? 'Save' : 'Add note',
    editing ? el('button', { type: 'button', onclick: () => notesView(page) }, 'Cancel') : null),
    el('h2', {}, 'My notes'),
    ...data.data.map((n) => el('div', { class: 'item' },
      el('h3', {}, n.title),
      el('pre', {}, n.content),
      el('div', { class: 'muted' }, fmt(n.updatedAt)),
      el('button', { onclick: () => notesView(page, n) }, 'Edit'), ' ',
      el('button', { onclick: run(async () => {
        if (!confirm('Delete this note?')) return;
        await api('/notes/' + n._id, 'DELETE');
        notesView(data.data.length === 1 && page > 1 ? page - 1 : page);
      }) }, 'Delete'))),
    data.data.length ? null : el('p', { class: 'muted' }, 'No notes yet.'),
    pager(data.meta, (p) => notesView(p))
  );
}

// ---------- posts ----------
async function postsView(page = 1) {
  const data = await api(`/posts?page=${page}&limit=5`);
  main.replaceChildren(
    el('h2', {}, 'New post'),
    form([
      { name: 'title', label: 'Title', required: true },
      { name: 'content', label: 'Content', type: 'textarea', required: true },
    ], async (v) => { await api('/posts', 'POST', v); say('Post published', true); postsView(1); }, 'Publish'),
    el('h2', {}, 'All posts'),
    ...data.data.map((p) => el('div', { class: 'item' },
      el('h3', {}, p.title),
      el('pre', {}, p.content),
      el('div', { class: 'muted' }, 'by ', el('button', { onclick: run(() => userPostsView(p.author._id)) }, p.author?.name || 'unknown'),
        ' · ', fmt(p.createdAt)))),
    pager(data.meta, (p) => postsView(p))
  );
}

// Uses GET /api/posts/user/:id  (the $lookup aggregation)
async function userPostsView(userId, page = 1) {
  const data = await api(`/posts/user/${userId}?page=${page}&limit=5`);
  main.replaceChildren(
    el('button', { onclick: () => postsView() }, '← All posts'),
    el('h2', {}, `Posts by ${data.user.name}`),
    ...data.posts.map((p) => el('div', { class: 'item' },
      el('h3', {}, p.title), el('pre', {}, p.content), el('div', { class: 'muted' }, fmt(p.createdAt)))),
    data.posts.length ? null : el('p', { class: 'muted' }, 'No posts.'),
    pager(data.meta, (p) => userPostsView(userId, p))
  );
}

// ---------- profile ----------
async function profileView() {
  const { user } = await api('/auth/me');
  main.replaceChildren(
    el('h2', {}, 'My profile'),
    el('p', {}, `${user.email} · role: ${user.role}`),
    form([
      { name: 'name', label: 'Name', required: true, value: user.name },
      { name: 'interests', label: 'Interests (comma separated)', value: user.interests.join(', ') },
      { name: 'password', label: 'New password (leave blank to keep)', type: 'password' },
    ], async (v) => {
      const body = { name: v.name, interests: splitInterests(v.interests) };
      if (v.password) body.password = v.password;
      const res = await api('/auth/me', 'PATCH', body);
      me = res.user;
      say('Profile updated', true);
      render();
    }, 'Save')
  );
}

// ---------- admin: users ----------
async function usersView(page = 1, editing = null) {
  const data = await api(`/users?page=${page}&limit=5`);
  const fields = [
    { name: 'name', label: 'Name', required: true, value: editing?.name },
    { name: 'email', label: 'Email', type: 'email', required: true, value: editing?.email },
    { name: 'password', label: editing ? 'New password (blank = keep)' : 'Password', type: 'password', required: !editing },
    { name: 'role', label: 'Role', type: 'select', options: ['user', 'admin'], value: editing?.role },
    { name: 'interests', label: 'Interests (comma separated)', value: editing?.interests.join(', ') },
  ];
  main.replaceChildren(
    el('h2', {}, editing ? 'Edit user' : 'Add user'),
    form(fields, async (v) => {
      const body = { ...v, interests: splitInterests(v.interests) };
      if (!body.password) delete body.password;
      if (editing) await api('/users/' + editing._id, 'PATCH', body);
      else await api('/users', 'POST', body);
      say(editing ? 'User updated' : 'User created', true);
      usersView(1);
    }, editing ? 'Save' : 'Create',
    editing ? el('button', { type: 'button', onclick: () => usersView(page) }, 'Cancel') : null),
    el('h2', {}, 'All users'),
    ...data.data.map((u) => el('div', { class: 'item' },
      el('h3', {}, `${u.name} (${u.role})`),
      el('div', {}, u.email),
      el('div', { class: 'muted' }, 'Interests: ' + (u.interests.join(', ') || '—')),
      el('button', { onclick: () => usersView(page, u) }, 'Edit'), ' ',
      u._id === me._id ? null : el('button', { onclick: run(async () => {
        if (!confirm(`Delete ${u.name} and all their notes/posts?`)) return;
        await api('/users/' + u._id, 'DELETE');
        usersView(data.data.length === 1 && page > 1 ? page - 1 : page);
      }) }, 'Delete'))),
    pager(data.meta, (p) => usersView(p))
  );
}

// ---------- admin: all notes ----------
async function allNotesView(page = 1) {
  const data = await api(`/notes/all?page=${page}&limit=10`);
  main.replaceChildren(
    el('h2', {}, "Everyone's notes"),
    ...data.data.map((n) => el('div', { class: 'item' },
      el('h3', {}, n.title),
      el('pre', {}, n.content),
      el('div', { class: 'muted' }, `${n.owner?.name || 'deleted user'} (${n.owner?.email || '-'}) · ${fmt(n.updatedAt)}`))),
    data.data.length ? null : el('p', { class: 'muted' }, 'No notes.'),
    pager(data.meta, (p) => allNotesView(p))
  );
}

// ---------- admin: interest groups (aggregation scenario 1) ----------
async function groupsView(page = 1, interest = '') {
  const q = `?page=${page}&limit=5` + (interest ? '&interest=' + encodeURIComponent(interest) : '');
  const data = await api('/users/groups/interests' + q);
  main.replaceChildren(
    el('h2', {}, 'Users grouped by interest'),
    form([{ name: 'interest', label: 'Filter by one interest (optional)', value: interest }],
      (v) => groupsView(1, v.interest.trim()), 'Filter'),
    ...data.data.map((g) => el('div', { class: 'item' },
      el('h3', {}, `${g.interest} (${g.count})`),
      el('div', {}, g.users.map((u) => u.name).join(', ')))),
    data.data.length ? null : el('p', { class: 'muted' }, 'No groups.'),
    pager(data.meta, (p) => groupsView(p, interest))
  );
}

// ---------- shell ----------
const tabs = [
  { id: 'notes', label: 'My notes', view: () => notesView() },
  { id: 'posts', label: 'Posts', view: () => postsView() },
  { id: 'profile', label: 'Profile', view: profileView },
  { id: 'users', label: 'Users', view: () => usersView(), admin: true },
  { id: 'allnotes', label: 'All notes', view: () => allNotesView(), admin: true },
  { id: 'groups', label: 'Interest groups', view: () => groupsView(), admin: true },
];

async function render() {
  nav.replaceChildren();
  if (!token) return authView();
  if (!me) {
    try { me = (await api('/auth/me')).user; } catch { return; }
  }
  for (const t of tabs.filter((t) => !t.admin || me.role === 'admin'))
    nav.append(el('button', {
      class: t.id === tab ? 'active' : '',
      onclick: () => { tab = t.id; say(''); render(); },
    }, t.label));
  nav.append(el('span', { class: 'muted' }, ` ${me.name} (${me.role}) `), el('button', { onclick: logout }, 'Logout'));
  try { await tabs.find((t) => t.id === tab).view(); } catch (err) { say(err.message); }
}

render();
