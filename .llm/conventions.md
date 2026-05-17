# Conventions

## Project structure

```
src/
  pages/          # Next.js Pages Router — UI pages + API routes under pages/api/
  components/     # Shared UI components; admin/ subdir for admin-specific
  components/ui/  # shadcn/ui primitives — do NOT edit directly
  lib/            # Server + shared utilities
  services/       # Client-side fetch wrappers (not server-only)
  contexts/       # React context providers
  hooks/          # Custom React hooks
  generated/prisma/ # Prisma client output — do NOT edit directly
```

## Prisma / database

- Schema: `prisma/schema.prisma`. Engine: `client` (Rust-free) — required for Amplify/Lambda.
- Client output: `src/generated/prisma/` — import as `import prisma from "@/lib/prisma"`.
- After schema changes: `npm run db:generate` then `npm run db:push`.
- All model names use `snake_case` column names. Table names explicitly set via `@@map`.
- Monetary fields use `Decimal @db.Decimal(10,2)` — never `Float`. Razorpay amounts in paise (`Int`).
- `STUDIO_DATABASE_URL` overrides `DATABASE_URL` for local dev on Windows (NextJS doesn't always propagate host env). See `src/lib/database-url.ts`.

## Auth / session access

- Server pages: `getStudioServerSession()` from `src/lib/getStudioServerSession.ts`.
- Admin guard: `requireAdmin(session)` from `src/lib/requireAdmin.ts`.
- Never call `getServerSession()` directly in pages — always use wrapper.
- JWT contains: `id`, `email`, `name`, `role`.
- Roles: `"user"` (default), `"admin"`.

## API route patterns

- All routes in `src/pages/api/`. Method dispatch via `if (req.method === "GET") ...`.
- Session check early; return 401 if unauthenticated.
- Return JSON. Use `res.status(N).json({ error: "..." })` for errors.
- No OpenAPI/Swagger — not Spring app.
- Admin-only routes import `requireAdmin`, check before any data op.

## Payments (Razorpay)

- Amounts always in **paise** (`Int`). Never store rupees.
- `razorpayConfigured()` check before constructing client — many routes skip gracefully if keys unset.
- `persistRazorpayOrderOnCreate` → `persistVerifiedRazorpayPayment` → `linkRazorpayOrderToBookingTx` / `linkRazorpayOrderToUserPackageTx` = canonical fulfillment chain.
- Webhook (`/api/payments/razorpay/webhook`) idempotent — calls `upsert` everywhere.
- Webhook URL (HTTPS) must be configured in Razorpay Dashboard; subscribe to `payment.authorized`, `payment.captured`, `payment.failed`.

## Notifications

- Email: `sendEmail` (Gmail SMTP primary) → `resendEmail` fallback. Both in `src/lib/notifications/`.
- WhatsApp: `sendWhatsAppTemplateMessage` — approved templates only. `toDigits` must be digits only (no `+`). Normalize with `normalizeForWhatsApp`.
- `notifyPackagePurchase` wraps both channels after confirmed purchase.

## S3 / uploads

- Avatar uploads only use S3. Gate with `isS3Configured()` before presigning.
- Presign via `presignAvatarUpload()` (60s expiry). Client PUT directly to S3.
- `AWS_S3_PUBLIC_URL` overrides default bucket CDN URL construction.

## Environment variables

- All env access server-side. Never expose secrets in `NEXT_PUBLIC_*` (only key ID for Razorpay).
- `.env.local` for local dev. `.env.example` documents all vars — keep current.

## UI / frontend

- shadcn/ui components in `src/components/ui/` — generated, do not modify.
- Tailwind CSS only. No inline styles.
- Dark mode via `next-themes` (`ThemeProvider`).
- `framer-motion` for animations.
- Forms via `react-hook-form` + `zod` schema validation + `@hookform/resolvers`.

## Code style

- TypeScript strict (`tsconfig.json`). Build has `ignoreBuildErrors: true` — don't rely on it.
- ESLint rules: `no-unescaped-entities` off, `no-explicit-any` warn, `no-unused-vars` warn.
- No Prettier. Match surrounding code style.
- Imports use `@/` alias for `src/`.

## Prisma client import (important)

```ts
import prisma from "@/lib/prisma";           // singleton, server-only
import type { Prisma } from "@/generated/prisma/client"; // types
```

Never instantiate `new PrismaClient()` outside `src/lib/prisma.ts`.

## Seed scripts

Run with `tsx scripts/<name>.ts`. Each script connects to DB, seeds, disconnects. Use `npm run db:seed:*` aliases.

## New endpoint checklist

1. Add handler in `src/pages/api/`
2. Check session / role early
3. Handle each HTTP method explicitly; 405 on unknown
4. Use Prisma transactions for multi-step writes
5. Return typed JSON
6. Never log PII (email, phone, password hash) at info level