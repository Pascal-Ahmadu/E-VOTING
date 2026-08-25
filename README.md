# Ballotry

A white-label online election platform. One deployment serves one organisation,
which configures its own identity — logo, name, colour, terminology — from the
admin UI. Nothing about the organisation is baked into the codebase.

Ballotry is the platform name; it is never shown to voters. Voters only ever see
the branding of the organisation running the election.

Built with Next.js (App Router), Prisma/PostgreSQL, and Tailwind CSS. The admin
UI is based on the TailAdmin dashboard template.

## Features

- Voter roll with encrypted PII, individual entry or CSV bulk import
- Credentials generated per voter and delivered by email (SMTP) and optionally WhatsApp (Infobip)
- Elections with positions and candidates, draft → open → closed lifecycle
- One ballot per voter, results tallied per position
- CSV export of results and the full participation list
- Printable result sheet
- Append-only audit log with actor, IP, device and geo enrichment
- Multiple admins with rotatable passcodes

## Branding it for your organisation

Sign in as an admin and open **Settings → Branding**. Everything there takes
effect immediately across the app — no rebuild, no code edit:

| Setting | Where it shows |
|---|---|
| Logo | Sign-in screens, admin sidebar, browser tab icon |
| Organisation name | Printed result sheets, credential emails |
| Short name / wordmark | Sidebar, sign-in screen, page title |
| Tagline | Sub-heading under the wordmark |
| Brand colour | Buttons, links and highlights — one seed colour generates the full palette |
| Voter ID label | Form labels, CSV export header, accepted bulk-import column names |
| Email sender name | Display name on credential emails |
| Support email | Shown to voters who cannot sign in |

Until it is configured, the platform runs on neutral defaults ("Election
Platform", no logo) — a fresh install is fully usable before anyone touches
Settings.

The logo is stored in Vercel Blob, so `BLOB_READ_WRITE_TOKEN` must be set for
uploads to work. Candidate photos use the same storage.

## Getting started

### Prerequisites

- Node.js 20.x or later
- A PostgreSQL database
- pnpm (the repo ships a `pnpm-lock.yaml`)

### Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:push                 # create the schema
pnpm db:seed                 # seed the first admin
pnpm dev
```

The seeded admin credentials are printed by the seed script and shown on the
admin sign-in page in development. Change the passcode after first sign-in.

### Environment

See `.env.example` for the full list. The essentials:

- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — pooled and direct PostgreSQL connections
- `SESSION_SECRET` — iron-session cookie secret
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob, for logo and candidate photo uploads
- `SMTP_USER` / `SMTP_PASS` — Gmail account and App Password for credential emails
- `NEXT_PUBLIC_APP_URL` — public URL used in the links sent to voters

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Generate client, push schema, seed, build |
| `pnpm start` | Production server |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Apply the Prisma schema |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:seed` | Seed the first admin |

## License

Released under the MIT License. The underlying TailAdmin Next.js Free Version is
also MIT licensed.
