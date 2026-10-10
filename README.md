# RM Nails Suite — website + admin panel

## Run it
```
npm install
node server.js
```
- Website: http://localhost:5178
- Admin panel: http://localhost:5178/admin/

Needs Node.js 18 or newer.

## Settings (.env)
Copy `.env.example` to `.env` and fill in what you need. Every value is optional.

| Variable | What it does |
|---|---|
| `PORT` | Port of the server (default 5178). |
| `DATABASE_URL` | PostgreSQL connection URL, e.g. `postgres://user:password@host:5432/dbname`. Empty = files on disk. |
| `DATABASE_SSL` | Empty = verified SSL for remote databases, no SSL for localhost. `false` turns SSL off, `no-verify` keeps SSL but skips certificate checks (only for hosts with self-signed certificates). |
| `ADMIN_PASSWORD` | Admin password used only the first time (when no password exists yet). |

`.env` is in `.gitignore`: never commit it.

## Structure
- `public/`: the website and the admin panel (HTML, CSS, JS, photos). On Vercel these are served directly by the CDN.
- `server.js`, `storage.js`: the server for `/api/*` (admin), `/data/content.json` (content) and `/media/*` (photos uploaded in the admin).
- `data/content.json`: starting content, copied into the database on first start.

## Storage
- **Without `DATABASE_URL`**: content in `data/content.json`, password hash and backups in `private/`, photos in `public/images/`.
- **With `DATABASE_URL`**: everything the admin changes (content, password hash, last 30 backups, uploaded photos) is stored in PostgreSQL.
  The tables `rm_settings`, `rm_content_backups` and `rm_images` are created automatically on first start,
  and the current `data/content.json` is copied into the database once.
  Photos not uploaded through the admin are served from `public/images/`.

## Admin password
If `ADMIN_PASSWORD` is not set, a password is generated on first start and written to `private/ADMIN-PASSWORD.txt`.
Change it in **Siguria**; the file is then deleted.

## Hosting
Any Node.js host works (Render, Railway, a VPS…). Set the variables above in the host's environment settings.
With `DATABASE_URL` set, admin changes survive restarts and redeploys even on hosts without a persistent disk.
