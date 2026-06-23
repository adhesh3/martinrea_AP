# Martinrea — AP Automation Frontend

Production-grade **Next.js 16** application for the **Martinrea Accounts Payable Automation Suite**.  
Connects to a NestJS backend and supports the full invoice lifecycle: capture → OCR → review → 3-way match → approval → payment.

> **Docs:** For full technical documentation and PRD details, see [`docs/`](./docs/).
>
> - [`docs/project-documentation.md`](./docs/project-documentation.md) — Comprehensive project documentation
> - [`docs/frontend-prd-dhwaj-yash.md`](./docs/frontend-prd-dhwaj-yash.md) — Combined frontend PRD (Track A + B)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Routing | Next.js App Router — `src/app/` (thin shells) + `src/views/` (implementations) |
| Data Fetching | TanStack React Query v5 + Axios |
| Forms | React Hook Form + Zod + `@hookform/resolvers` |
| Styling | Tailwind CSS (custom Martinrea brand tokens) |
| UI Primitives | shadcn-style locally-vendored components in `src/components/ui/` |
| Charts | Recharts (dashboard pipeline bar chart) |
| Icons | Lucide React |
| Toasts | Sonner |
| Utilities | date-fns, clsx, tailwind-merge, class-variance-authority |
| Uploads | OCI Object Storage via Pre-Authenticated Request (PAR) URL |
| CI/CD | GitHub Actions → Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+ (developed on 22.x)
- NestJS backend running (see backend repo)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Backend API base URL (required)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api

# OCI Object Storage PAR URL for file uploads (optional)
NEXT_PUBLIC_OCI_PAR_URL=https://objectstorage.region.oraclecloud.com/p/...

# Server-side proxy target (optional, for same-origin deployments)
API_PROXY_TARGET=http://localhost:3001
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Sign in

| Role | Email | Password |
|------|-------|----------|
| AP Clerk | `clerk@martinrea.dev` | `Password123!` |
| Plant Manager | `pm@martinrea.dev` | `Password123!` |
| Finance Director | `fd@martinrea.dev` | `Password123!` |

The login page has one-click demo account buttons.

---

## Scripts

```bash
npm run dev     # Start Next.js dev server on port 3000
npm run build   # TypeScript type-check + production build
npm start       # Serve production build
npm run lint    # ESLint
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router (thin route shells)
│   ├── layout.tsx           # Root layout: QueryClient, AuthProvider, Toaster
│   ├── page.tsx             # Redirect / → /dashboard
│   ├── providers.tsx        # Client providers
│   ├── (auth)/login/        # Login route
│   └── (app)/               # Protected app routes (sidebar + topbar)
│       ├── layout.tsx        # Auth gate + role check
│       ├── dashboard/
│       ├── invoices/[id]/
│       ├── match/, documents/, ocr/
│       ├── approvals/, exceptions/, payments/
│       ├── vendors/, search/, analytics/
│       ├── audit/, admin/
│
├── views/                  # Page implementations (actual logic lives here)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── InvoiceProcessingPage.tsx
│   ├── InvoiceDetailPage.tsx
│   ├── AuditLogsPage.tsx
│   └── [other views — mostly ModuleScaffold placeholders]
│
├── components/
│   ├── layout/             # Sidebar, Topbar, GlobalSearch, NotificationsMenu
│   ├── invoices/           # StatusBadge, CreateInvoiceModal, UploadInvoiceModal
│   ├── auth/               # RolePill
│   └── ui/                 # shadcn-style primitives
│
├── auth/                   # AuthContext, useAuth hook
├── hooks/                  # useInvoices, useInvoiceMutations
├── lib/
│   ├── api.ts              # Axios client + endpoint wrappers
│   ├── permissions.ts      # Frontend RBAC matrix
│   ├── constants.ts        # Status metadata, plants, pipeline order
│   ├── storage.ts          # localStorage + cookie helpers
│   ├── object-storage.ts   # OCI upload via PAR URL
│   ├── invoice-registry.ts # Client-side ID registry (localStorage)
│   ├── query-client.ts     # TanStack Query config + query keys
│   └── utils.ts            # cn, formatCurrency, formatDate, initials
├── types/
│   ├── invoice.ts          # Invoice, InvoiceStatus, approval types
│   └── user.ts             # Role, AuthUser, LoginResponse
└── proxy.ts                # Next.js server-side auth gate
```

---

## What's Built

### Fully Implemented

| Page | Route | Description |
|------|-------|-------------|
| **Login** | `/login` | JWT auth, demo accounts, Zod-validated form |
| **Dashboard** | `/dashboard` | KPI tiles, pipeline chart, recent invoices, approval queue |
| **Invoice List** | `/invoices` | Status chips, search, plant filter, sortable columns, URL-synced filters |
| **Invoice Detail** | `/invoices/:id` | Full workflow actions, lifecycle timeline, approval chain, metadata |
| **Audit Logs** | `/audit` | Action log, search/filter (Finance Director only) |

### Partially Implemented

| Page | Route | Status |
|------|-------|--------|
| Global Search | ⌘K anywhere | UI complete, no backend search integration |
| Notifications | Topbar bell | Derived from invoice data, no push notifications |

### Scaffold (ModuleScaffold placeholder)

All sidebar routes exist but render a placeholder: `/ocr`, `/documents`, `/match`, `/approvals`, `/exceptions`, `/payments`, `/vendors`, `/search`, `/analytics`, `/admin`.

**In Progress:**
- **Dhwaj** (UI/UX Track A): Split-screen Document Viewer (`/documents`) + OCR form
- **Yash** (UI/UX Track B): 3-Way Match Workbench (`/match`) + exception handling

---

## Authentication

- JWT token stored in a cookie (`mtr_token`) readable by `proxy.ts` server-side gate
- User profile cached in `localStorage` for instant hydration
- `proxy.ts` redirects unauthenticated requests to `/login` at the server level
- Axios interceptor attaches `Authorization: Bearer {token}` on every request
- 401 response: clears token + redirects to `/login`

## Role-Based Access

| Role | Access Cap | Key Permissions |
|------|-----------|----------------|
| `AP_CLERK` | — | Create invoices, submit for review, flag exceptions |
| `PLANT_MANAGER` | $50,000 | Approve invoices within cap |
| `FINANCE_DIRECTOR` | Unlimited | Approve all, force transitions, access analytics/admin/audit |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open global search |
| `⌘U` / `Ctrl+U` | Open invoice upload modal |

---

## Invoice Lifecycle

```
RECEIVED → OCR_PROCESSING → PENDING_REVIEW → PENDING_MATCH → MATCHED → PENDING_APPROVAL → APPROVED
                                                    ↘ EXCEPTION        ↘ REJECTED
```

All state transitions are enforced by the backend NestJS state machine. The frontend mirrors the rules for UI gating only — the backend remains the source of truth.

---

## Invoice Registry

The frontend maintains a `localStorage`-backed registry of known invoice IDs (`invoice-registry.ts`). This allows list-style pages to enumerate invoices via parallel `GET /invoices/:id` requests when a `GET /invoices` list endpoint is unavailable. When `GET /invoices` is added to the backend, `useInvoicesList` can be updated to call it directly — nothing else needs to change.

---

## Deployment

Deployed automatically via GitHub Actions to **Vercel** on every push to `main` and on every PR (preview deployments).

See `.github/workflows/deploy.yml` for the CI/CD pipeline.
