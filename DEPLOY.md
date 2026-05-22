# Deployment notes

## Environment variables (AWS Amplify → App settings → Environment variables)

The app already needs the vars in `.env.example`. The scheduled-email work adds **one new required var**:

| Var | New? | Purpose |
|---|---|---|
| `CRON_SECRET` | **YES — add this** | Shared secret guarding the cron endpoints. Matched against the `x-cron-secret` request header. |
| `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | existing | Gmail SMTP (primary email transport) |
| `RESEND_API_KEY` | existing | Resend fallback transport |
| `NEXTAUTH_URL` | existing | Base URL used for links inside emails |
| `NEXTAUTH_SECRET` | existing | Signs `/57` + instructor portal cookies |

`CRON_SECRET` is a string **you choose** — any long random value, e.g. `openssl rand -hex 32`.
Set the same value in Amplify and in the scheduler's `x-cron-secret` header.

## Cron endpoints (must be scheduled externally on Amplify)

Amplify SSR runs on Lambda (ephemeral), so the app can't run its own scheduler there.
`ecosystem.config.js` / `npm run scheduler` are for a **persistent host (PM2)** only — ignore them on Amplify.

Instead, point an external scheduler at these endpoints on a recurring schedule:

| Endpoint | Frequency | What it does |
|---|---|---|
| `GET /api/cron/class-emails` | every ~5 min | Sends ~1h member class reminders + ~6h instructor rosters (idempotent) |
| `GET /api/cron/reconcile-no-shows` | every ~15 min | Marks past-due bookings as `no_show` |

Each request must include the header: `x-cron-secret: <CRON_SECRET>`

### Option A — AWS EventBridge Scheduler (recommended on Amplify)
1. EventBridge Scheduler → Create schedule → rate `5 minutes`.
2. Target = API destination (HTTP) → URL `https://<your-app>/api/cron/class-emails`, method GET,
   header `x-cron-secret: <CRON_SECRET>` (store the secret in a connection).
3. Repeat for `/api/cron/reconcile-no-shows` at `15 minutes`.

(Alternatively, a tiny scheduled Lambda that does `fetch(url, { headers: { 'x-cron-secret': secret } })`.)

### Option B — any external cron
cron-job.org, a GitHub Actions scheduled workflow, etc., hitting the same URLs with the header.

### Persistent host (not Amplify)
If running under PM2 on a long-lived server, the bundled scheduler is the app's own cron:
```
pm2 start ecosystem.config.js     # runs scripts/scheduler.ts every 5 min
```

## Database
Schema is managed with `prisma db push` against the hosted DB. Recent additions
(`reminder_sent_at`, `roster_sent_at`, `updated_at` defaults) are already applied to prod.
CRM templates/triggers are seeded with:
```
npm run db:seed:crm-system     # templates (incl. class_reminder, instructor_roster)
npm run db:seed:crm-triggers   # triggers
```
(both already run against prod; re-running preserves admin edits to template bodies.)
