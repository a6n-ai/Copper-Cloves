# Module: copper-cloves (Next.js app)

## Identity

| Field | Value |
|---|---|
| `name` (package.json) | `softgen-starter` |
| Version | `2.4.4` |
| Framework | Next.js 15.2.8 (Pages Router) |
| Language | TypeScript 5, Node 22 |
| Port (local) | `3000` |

## Key properties

| Property | Value |
|---|---|
| React | 18.3.1 |
| Prisma ORM | 7.8.0 |
| DB engine | `client` (Rust-free, required for Amplify/Lambda) |
| Auth | next-auth 4.24.14 |
| Build | `prisma generate && next build` |

## Dependencies

### Framework
| Package | Version | Purpose |
|---|---|---|
| `next` | ^15.2.8 | Framework, routing, SSR |
| `react` / `react-dom` | ^18.3.1 | UI rendering |
| `next-auth` | ^4.24.14 | Auth (JWT credentials) |
| `next-themes` | ^0.4.4 | Dark mode |

### Database
| Package | Version | Purpose |
|---|---|---|
| `prisma` | ^7.8.0 | Schema + migrations CLI |
| `@prisma/client` | ^7.8.0 | Query client |
| `@prisma/adapter-pg` | ^7.8.0 | pg adapter (Rust-free engine) |
| `pg` | ^8.20.0 | PostgreSQL driver |

### Payments
| Package | Version | Purpose |
|---|---|---|
| `razorpay` | ^2.9.6 | INR payment gateway |
| `stripe` | ^17.6.0 | Stripe client (present, not primary) |
| `@stripe/react-stripe-js` | ^3.1.1 | Stripe React components |
| `@stripe/stripe-js` | ^5.5.0 | Stripe.js loader |
| `micro` | ^10.0.1 | Raw body parsing (webhook) |

### Storage / Infra
| Package | Version | Purpose |
|---|---|---|
| `@aws-sdk/client-s3` | ^3.1046.0 | Avatar upload to S3 |
| `@aws-sdk/s3-request-presigner` | ^3.1046.0 | Presigned PUT URLs |

### UI
| Package | Version | Purpose |
|---|---|---|
| `@radix-ui/*` | various | shadcn/ui primitives |
| `tailwindcss` | ^3.4.1 | Styling |
| `tailwind-merge` | ^2.6.0 | Class merging |
| `class-variance-authority` | ^0.7.1 | Variant styles |
| `lucide-react` | ^0.474.0 | Icons |
| `framer-motion` | ^12.0.6 | Animations |
| `embla-carousel-react` | ^8.5.2 | Carousels |

### Forms / Validation
| Package | Version | Purpose |
|---|---|---|
| `react-hook-form` | ^7.54.2 | Form state |
| `@hookform/resolvers` | ^3.10.0 | Zod integration |
| `zod` | ^3.24.1 | Schema validation |

### Email / Notifications
| Package | Version | Purpose |
|---|---|---|
| `nodemailer` | ^7.0.13 | Gmail SMTP |
| `bcryptjs` | ^3.0.3 | Password hashing |

### Utilities
| Package | Version | Purpose |
|---|---|---|
| `date-fns` | ^3.6.0 | Date manipulation |
| `xlsx` | ^0.18.5 | Finance report export |
| `formidable` | ^3.5.4 | Multipart form parsing |
| `clsx` | ^2.1.1 | Conditional classnames |

### Dev
| Package | Purpose |
|---|---|
| `tsx` | Run TypeScript scripts directly (`tsx scripts/`) |
| `@types/node` @22 | Node type defs |
| `eslint` + `eslint-config-next` | Linting |
| `@softgenai/element-tagger` | Softgen UI element tagging (optional loader) |

## External runtime dependencies

| System | Env vars | Purpose |
|---|---|---|
| PostgreSQL 16 | `DATABASE_URL` / `STUDIO_DATABASE_URL` | Primary DB |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET` | INR payments |
| Gmail SMTP | `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Transactional email |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Email fallback |
| WhatsApp Cloud API | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PACKAGE_TEMPLATE_NAME` | Template notifications |
| AWS S3 | `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Avatar storage |

## Deployment targets

| Target | Config |
|---|---|
| AWS Amplify | `amplify.yml` — requires Rust-free Prisma engine (`engineType = "client"`) |
| Vercel | `vercel.json` |
| PM2 | `ecosystem.config.js` |
| Docker (local DB only) | `docker-compose.yml` — Postgres 16-alpine on host port 5433 |

## Notable constraints

- Prisma `engineType = "client"` mandatory — default engine breaks Amplify/Lambda.
- `STUDIO_DATABASE_URL` takes precedence over `DATABASE_URL` in `src/lib/database-url.ts` — Windows workaround.
- `next.config.mjs` silences TS build errors (`ignoreBuildErrors: true`) — intentional for dev speed, not production confidence.
- Razorpay amounts always paise (`Int`) — no floats, no rupees in DB.
- Stripe SDK installed but Razorpay is active payment gateway.