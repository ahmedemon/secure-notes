# Secure Notes: Backend API

Express + MongoDB (Mongoose) + JWT, with role-based access (user / admin).

- **Live API:** <add your Render URL>
- **Frontend repo:** <add link> · **Live frontend:** <add link>
- **Demo admin:** <email> / <password>

## Run locally

```bash
npm install
cp .env.example .env      # set MONGODB_URI, JWT_SECRET (32+ chars), FRONTEND_URL
npm run seed:admin        # creates/updates the admin from ADMIN_* in .env
npm start                 # http://localhost:3000
```

Requires Node 18+ and MongoDB 5.0+ (the `$lookup` uses `localField`/`foreignField` with a sub-pipeline).

| Env var | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | 32+ char secret for signing tokens |
| `JWT_EXPIRES_IN` | token lifetime (default `1h`) |
| `FRONTEND_URL` | allowed CORS origin(s), comma-separated, no trailing slash |
| `ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD` | used by `npm run seed:admin` |

## Roles

| Role  | Can do |
|-------|--------|
| user  | Create / update / delete / list **own** notes; edit own profile; write posts |
| admin | Everything a user can, plus add / update / delete / list users, view **everyone's** notes, interest groups |

Public `/register` always creates a `user`. Admins come from the seed script or another admin.

## API (all lists take `?page=1&limit=10`, limit max 100)

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET / PATCH | `/api/auth/me` | any user |
| GET / POST | `/api/notes` (own list / create) | any user |
| GET / PATCH / DELETE | `/api/notes/:id` | read: owner or admin; write: owner |
| GET | `/api/notes/all?owner=<id>` | admin |
| GET / POST | `/api/users` | admin |
| GET / PATCH / DELETE | `/api/users/:id` | admin |
| GET | `/api/users/groups/interests?interest=chess` | admin (aggregation 1) |
| GET / POST | `/api/posts` | read: public, create: auth |
| GET | `/api/posts/user/:userId` | public (aggregation 2, `$lookup`) |

Send the JWT as `Authorization: Bearer <token>`.

## Indexes (4 custom, each justified in its model file)

| Collection | Index | Why |
|-----------|-------|-----|
| users | `{ email: 1 }` unique | login lookup + uniqueness |
| users | `{ interests: 1 }` | `$match` at the start of the group-by-interests pipeline |
| notes | `{ owner: 1, _id: -1 }` | user's notes list (equality + sort), admin owner filter, counts, cascade delete |
| posts | `{ author: 1, _id: -1 }` | `$lookup` join + sort for a user's posts, cascade delete |

Everything else uses the default `_id` index: get-by-id reads, the admin users list, the admin all-notes list and the public posts feed all sort by `_id` descending (ObjectIds are time-ordered), so no `createdAt` indexes are needed.

## Aggregations

1. **Group by interests** (`src/routes/users.js`): one `User.aggregate()` call: `$match` → `$unwind` → `$group` → `$sort` → `$facet` (paginated groups + total).
2. **User posts** (`src/routes/posts.js`): one pipeline: `$match` user → `$lookup` into `posts` (sorted and paginated inside the sub-pipeline) → `$project`.

## Security notes

- Passwords hashed with bcrypt (cost 12); never returned by the API.
- JWT (HS256); the user is reloaded on every request so deleted users and role changes apply immediately.
- Inputs must be strings (blocks NoSQL operator injection), ids validated, `helmet`, body size limit, CORS allow-list, rate limit on login/register.
- Login compares against a dummy hash for unknown emails to avoid user enumeration by timing.
