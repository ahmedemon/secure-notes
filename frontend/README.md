# Secure Notes: Frontend

Plain HTML/CSS/JS client (no framework, no build step) for the Secure Notes API.

- **Live site:** <add your Netlify/Vercel URL>
- **Backend repo:** <add link> · **Live API:** <add link>

## Configure

Edit `config.js` and set the backend URL (no trailing slash):

```js
window.API_URL = 'https://your-backend.onrender.com';
```

## Run locally

```bash
npx serve -l 3001 .     # http://localhost:3001
```

The backend must allow this origin via its `FRONTEND_URL` env var.

## Features

Login / register, notes CRUD with pagination, posts feed, a user's posts, profile (name, interests, password).
Admin tabs: users CRUD, everyone's notes, users grouped by interest.

All user content is rendered with `textContent` (no `innerHTML`).
