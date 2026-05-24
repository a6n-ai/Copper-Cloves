## Learned User Preferences

- Frequently requests "restart the server" and "push the changes" — execute directly when asked.
- When pushing: commit uncommitted project code first, then push to `origin/main`.
- Before commit/push when asked: summarize what will be committed; user may want to approve first.
- Never commit dummy/demo finance seed data; keep real financial records untouched.
- Do not commit unless explicitly asked: `.idea/`, `public/uploads/`, `.cursor/`, `.agents/`, `.claude/`, and other local tooling artifacts.
- When Docker is down, use `npm run dev:next` (not `npm run dev`); dev server runs on port 3000 or 3001.
- Use Razorpay MCP for Razorpay integration patterns when relevant.

## Learned Workspace Facts

- Next.js app for The Studio by Copper + Cloves (member portal, admin, instructor, partner).
- `npm run dev`: Docker Postgres + Next; `npm run dev:next`: Next only — use when Docker is off.
- Local Postgres via Docker: host `127.0.0.1`, port **5433** (`STUDIO_DATABASE_URL` in `.env.local`).
- Production: AWS Amplify; set **STUDIO_DATABASE_URL** to remote RDS — not localhost (Amplify builds fail on localhost URLs).
- Default branch `main`; GitHub remote `ranga768/Copper-Cloves`.
- Prisma uses `db push` / `npm run ci:db-push` on Amplify, not checked-in migration SQL; client in `src/generated/prisma/`.
- Amplify env minimum: `STUDIO_DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (custom domain thestudiobycopperandcloves.in), Razorpay keys + `RAZORPAY_WEBHOOK_SECRET`.
- Razorpay webhook endpoint: `/api/razorpay/webhook`; amounts stored in paise.
- Production RDS: `copper-cloves` Postgres in ap-south-1.
- Repo context docs in `.llm/` — `/llm` slash command lists topics.
