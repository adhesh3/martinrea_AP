# Martinrea Finance AP System
## Comprehensive Project Documentation

**Project:** Martinrea AP Automation Platform — Phase 1: Foundation & Paperless  
**Client:** Martinrea International  
**Vendor:** Netlink Software Group America  
**Version:** 1.0 | June 2026  
**Repository:** `martinrea-ap-frontend`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Problem Statement](#2-business-context--problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Team Structure](#4-team-structure)
5. [Technology Stack](#5-technology-stack)
6. [Architecture Overview](#6-architecture-overview)
7. [Frontend Application Structure](#7-frontend-application-structure)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Invoice Lifecycle & State Machine](#9-invoice-lifecycle--state-machine)
10. [Module Reference](#10-module-reference)
11. [API Reference](#11-api-reference)
12. [Development Tracks & Requirements](#12-development-tracks--requirements)
13. [Deployment & Environment](#13-deployment--environment)
14. [Sprint Deliverables & Quality Gates](#14-sprint-deliverables--quality-gates)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Assumptions & Out-of-Scope](#16-assumptions--out-of-scope)

---

## 1. Executive Summary

Martinrea International operates **40+ manufacturing and processing locations** across North America and faces significant challenges in its Accounts Payable function: decentralized operations, heavy reliance on manual document handling, no centralized visibility into invoice status, and absence of real-time performance metrics. The combination results in processing delays, compliance risk, and high operational cost.

Netlink has been selected to build a **cloud-hosted, AI-driven AP Automation Platform** structured as a 3-Phase delivery:

| Phase | Target | Focus |
|-------|--------|-------|
| Phase 1 | 80% Human-Assisted | Foundation, digitization, OCR, manual match, approvals |
| Phase 2 | 50% Human-Assisted | AI-automated matching, advanced workflows |
| Phase 3 | 20% Human-Assisted | Supplier portal, payment automation, mobile app |

**This document covers Phase 1.** Upon completion, Martinrea's AP team transitions from paper-heavy, email-based, manually-reconciled processes to a digitized, centrally accessible, auditable workflow — reducing manual touchpoints and establishing the foundation for full AI automation.

---

## 2. Business Context & Problem Statement

### 2.1 Current State Challenges

| Challenge | Description |
|-----------|-------------|
| **Decentralized Operations** | 40+ locations in silos with inconsistent AP processes, no shared system of record, varying approval hierarchies per plant |
| **Manual Document Handling** | Invoices, packing slips, CMS receiving reports processed via email, physical mail, shared drives — high human error risk |
| **Processing Delays** | Manual data entry and matching delays vendor payments, causing missed early-payment discounts and strained supplier relationships |
| **Lack of Visibility** | No centralized dashboard or status tracking; AP Managers cannot see invoice location in lifecycle without contacting individual plants |
| **Inefficient Matching** | 2-way and 3-way matching performed manually in spreadsheets; inconsistent execution causes duplicate payments and missed discrepancies |
| **Invoice Type Complexity** | Multiple types (Direct Voucher, Capital, Tooling, CFDI/Mexico) each require different handling rules, none systematically enforced |
| **Lack of Real-Time Metrics** | No SLA tracking, exception rate visibility, or KPI dashboards |
| **Inventory & MRO Gaps** | Min/max inventory levels not frequently reviewed; missing resource IDs create reconciliation failures |

### 2.2 Phase 1 Objectives

- Eliminate paper-based invoice receipt — **100% of invoices enter through digital channels** (email, SFTP, portal)
- Establish a centralized, searchable document repository with full audit trail
- Automate OCR/AI data extraction, **reducing manual keying by >80%**
- Provide structured, UI-driven 3-way matching workbench for AP Clerks
- Implement role-based electronic approval workflows with escalation and SLA enforcement
- Integrate with **Epicor CMS (all 44 instances)** for live PO, Supplier, and Goods Receipt data
- Implement **CFDI validation** for Mexico plants ensuring SAT regulatory compliance
- Capacity: **~450,000 documents/year** (~1,233/day peak)

---

## 3. Solution Overview

The Martinrea AP Automation Platform is a **cloud-agnostic, event-driven microservices architecture** with four scalable layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                                │
│  Next.js 16 SPA / PWA  ←→  React Query  ←→  NestJS REST API          │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                               │
│  Ingestion Service  │  OCR Service  │  Matching Engine  │  Workflow   │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                                 │
│  Epicor CMS (44 sites)  │  MS Graph (Email)  │  SAT CFDI  │  Azure   │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                       │
│  PostgreSQL  │  Azure/OCI Blob Storage  │  Elasticsearch              │
└────────────────────────────────────────────────────────────────────────┘
```

### Invoice Processing Flow (End-to-End)

```
Vendor Invoice
     │
     ├── Email Attachment (MS Graph) ──┐
     ├── SFTP File Drop ───────────────┤
     └── Web Portal Upload ────────────┘
                                       │
                                  Ayush (Ingestion)
                               Format/size validation
                               Blob Storage upload
                                       │
                                  Abhay (OCR)
                            Azure Document Intelligence
                            Confidence scoring
                            CFDI detection
                                       │
                               Roshni (Data/API)
                            PostgreSQL persistence
                            REST API layer
                                       │
                              ┌────────┴────────┐
                              │                 │
                         Dhwaj (UI-A)      Yash (UI-B)
                      Document Viewer    Match Workbench
                       OCR Review         Discrepancy
                        PENDING_REVIEW    PENDING_MATCH
                              │                 │
                              └────────┬────────┘
                                       │
                              Mohd Aman (Workflow)
                          Approval routing engine
                          Email notifications
                          SLA escalation
                                       │
                                  APPROVED
                                       │
                              Treasury/Payment
```

---

## 4. Team Structure

| Developer | Role | Track | Primary Responsibilities |
|-----------|------|-------|-------------------------|
| **Ayush** | Full Stack Dev | Ingestion Epic | Email (MS Graph), SFTP polling, portal file upload REST API, pre-processing & format validation |
| **Abhay** | AI / OCR Engineer | AI & OCR Epic | Azure Document Intelligence, OCR JSON parser, confidence scoring, CFDI language detection |
| **Manav + Eswar** | Integration Engineers | External Integrations Epic | Epicor CMS connectivity (44 sites), PO/Supplier/GR data sync, CFDI XML SAT validation |
| **Roshni** | Backend / Data Engineer | Data & Repository Epic | PostgreSQL schema, core REST APIs, Azure Blob Storage, audit logging, search API |
| **Dhwaj** | Frontend Developer | UI/UX Track A | Next.js dashboard, invoice data table, PDF viewer, OCR form binding, save flow |
| **Yash** | Frontend Developer | UI/UX Track B | 3-Way Match Workbench, discrepancy highlighting, exception flagging, approval submission UI |
| **Mohd Aman** | Backend Developer | Workflow & Approvals Epic | RBAC/auth roles, state machine, sequential routing rules engine, email notifications, escalation cron |
| **Vedant Shrivastava** | Documentation | — | Technical documentation |
| **Aditya** | Project Coordinator | — | Project management |
| **Jack H.** | QA | — | Load testing, regression testing |

### Cross-Team Integration Map

| Source | Downstream 1 | Downstream 2 | Data Flow |
|--------|-------------|-------------|-----------|
| Ayush (Ingestion) | → Roshni (Data) | → Abhay (OCR) | Files validated by Ayush, stored in Blob by Roshni, sent to Azure OCR by Abhay |
| Abhay (OCR) | → Roshni (Data) | → Dhwaj (UI-A) | Parsed OCR JSON written to DB by Roshni, rendered in OCR form by Dhwaj |
| Manav (Integrations) | → Roshni (Data) | → Yash (Matching) | PO/GR data cached via Roshni's DB; Yash fetches for the workbench |
| Yash (Matching) | → Mohd Aman (Workflow) | — | Successful match submission triggers workflow engine |
| Mohd Aman (Workflow) | → Roshni (Data) | → Dashboard (UI) | State changes persisted by Roshni, reflected in dashboard |

---

## 5. Technology Stack

### Approved Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Next.js 16, TypeScript, Tailwind CSS, TanStack React Query v5 | Dashboard, Document Viewer, Matching Workbench, Admin UI |
| **Mobile** | React-based PWA (Hybrid) | Invoice approvals, exception handling (Phase 3 scope) |
| **Backend / API** | NestJS (Node.js), TypeScript, GraphQL, Sequelize | Business logic, workflow orchestration, REST + GraphQL API layer |
| **AI / OCR** | Azure Document Intelligence (Form Recognizer) | Invoice OCR, structured field extraction, confidence scoring |
| **Integrations** | REST APIs, SFTP, Event Queues | Epicor CMS integration (44 sites), email ingestion (MS Graph) |
| **Database** | PostgreSQL | AP transactional data, workflow state, audit logs, master data cache |
| **File Storage** | Azure Blob Storage / OCI Object Storage | Document binaries (PDFs, images) with SAS-URL access control |
| **Search** | PostgreSQL Full-Text + Elasticsearch | Invoice search, KPI reporting, audit queries |
| **Security / IdP** | Keycloak | SSO, JWT authentication, RBAC, Azure AD integration |
| **Infrastructure** | Docker + Kubernetes | Containerized deployment, horizontal scaling, cloud-agnostic |
| **Monitoring** | Datadog + Sentry | Performance monitoring, error tracking, alerting |
| **CI/CD** | GitHub Actions + Argo CD | Automated testing, build, deployment to DEV/QA/UAT/PROD |

### Frontend Dependencies (Current)

```json
{
  "next": "16.x",
  "react": "19.x",
  "@tanstack/react-query": "5.x",
  "axios": "latest",
  "react-hook-form": "latest",
  "zod": "latest",
  "@hookform/resolvers": "latest",
  "recharts": "latest",
  "lucide-react": "latest",
  "sonner": "latest",
  "date-fns": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest",
  "class-variance-authority": "latest"
}
```

---

## 6. Architecture Overview

### Frontend Architecture

```
src/
├── app/                    Next.js App Router (thin route shells)
│   ├── layout.tsx           Root layout: QueryClient, AuthProvider, Toaster
│   ├── page.tsx             Redirect / → /dashboard
│   ├── providers.tsx        Client providers wrapper
│   ├── globals.css
│   ├── not-found.tsx
│   ├── (auth)/
│   │   └── login/page.tsx   Login route
│   └── (app)/               Protected app shell
│       ├── layout.tsx        Sidebar + Topbar + auth/role gate
│       ├── dashboard/
│       ├── invoices/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── ocr/, documents/, match/, approvals/
│       ├── exceptions/, payments/, vendors/
│       ├── search/, analytics/, audit/, admin/
│
├── views/                  Actual page implementations (17 views)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── InvoiceProcessingPage.tsx
│   ├── InvoiceDetailPage.tsx
│   ├── AuditLogsPage.tsx
│   ├── MatchPage.tsx        (scaffold — Yash's target)
│   ├── DocumentViewerPage.tsx (scaffold — Dhwaj's target)
│   └── [other views...]
│
├── components/
│   ├── layout/             Sidebar, Topbar, GlobalSearch, NotificationsMenu
│   ├── invoices/           StatusBadge, CreateInvoiceModal, UploadInvoiceModal
│   ├── auth/               RolePill
│   └── ui/                 shadcn-style primitives
│
├── auth/                   AuthContext, useAuth hook
├── hooks/                  useInvoices, useInvoiceMutations
├── lib/                    api.ts, permissions.ts, constants.ts, utils.ts
├── types/                  invoice.ts, user.ts
└── proxy.ts                Next 16 server-side auth gate
```

### Key Architectural Decisions

1. **Views vs App routes:** `src/app/**/page.tsx` re-exports from `src/views/` — routing stays thin, logic is reusable and testable
2. **No mock data:** Empty states (`ModuleScaffold`) instead of fake data — forces real API integration
3. **TanStack Query:** All server state managed via React Query (30s stale time, query key invalidation on mutations)
4. **Invoice Registry:** `invoice-registry.ts` maintains known invoice IDs in localStorage as fallback when list endpoints are unavailable — warms per-ID caches
5. **OCI Object Storage:** Direct PUT via Pre-Authenticated Request (PAR) URL — browser uploads bypass backend, reducing latency
6. **API Proxy:** `next.config.ts` rewrites `/api/*` → backend URL to avoid CORS in same-origin deployments

---

## 7. Frontend Application Structure

### Routes & Views

| Route | View File | Status | Description |
|-------|-----------|--------|-------------|
| `/` | — | Redirect | Redirects to `/dashboard` |
| `/login` | `LoginPage.tsx` | ✅ Complete | Email/password auth, demo accounts |
| `/dashboard` | `DashboardPage.tsx` | ✅ Complete | KPIs, pipeline chart, recent invoices, approval queue |
| `/invoices` | `InvoiceProcessingPage.tsx` | ✅ Complete | Filterable/sortable invoice table |
| `/invoices/:id` | `InvoiceDetailPage.tsx` | ✅ Complete | Full invoice detail + workflow actions |
| `/invoices/:id/review` | *(pending)* | ❌ Not built | OCR Review (Dhwaj — UI-A-03 to A-05) |
| `/invoices/:id/match` | *(pending)* | ❌ Not built | 3-Way Match Workbench (Yash — UI-B-01 to B-05) |
| `/ocr` | `OcrValidationPage.tsx` | ⚠️ Scaffold | OCR validation queue |
| `/documents` | `DocumentViewerPage.tsx` | ⚠️ Scaffold | Document viewer (Dhwaj's target) |
| `/match` | `MatchPage.tsx` | ⚠️ Scaffold | Match workbench (Yash's target) |
| `/approvals` | `ApprovalsPage.tsx` | ⚠️ Scaffold | Approval queue |
| `/exceptions` | `ExceptionsPage.tsx` | ⚠️ Scaffold | Exception management |
| `/payments` | `PaymentsPage.tsx` | ⚠️ Scaffold | Payment packages |
| `/vendors` | `VendorsPage.tsx` | ⚠️ Scaffold | Vendor management |
| `/search` | `SearchPage.tsx` | ⚠️ Scaffold | Global document search |
| `/analytics` | `AnalyticsPage.tsx` | ⚠️ Scaffold | AP performance metrics |
| `/audit` | `AuditLogsPage.tsx` | ⚠️ Partial | Audit trail (API wired, UI partially built) |
| `/admin` | `AdminPage.tsx` | ⚠️ Scaffold | System admin (Finance Director only) |

### Navigation (Role-filtered)

| Nav Item | Icon | Roles | Route |
|----------|------|-------|-------|
| Dashboard | Home | All | `/dashboard` |
| Invoice Processing | FileText | All | `/invoices` |
| OCR Review | ScanLine | AP Clerk, Finance Director | `/ocr` |
| Documents | FolderOpen | All | `/documents` |
| 2/3-Way Match | GitMerge | AP Clerk, Finance Director | `/match` |
| Approvals | CheckSquare | Plant Manager, Finance Director | `/approvals` |
| Exceptions | AlertTriangle | AP Clerk, Finance Director | `/exceptions` |
| Payments | CreditCard | Finance Director | `/payments` |
| Vendors | Building | All | `/vendors` |
| Repository Search | Search | All | `/search` |
| Analytics | BarChart | Finance Director | `/analytics` |
| Audit Logs | History | Finance Director | `/audit` |
| Admin Panel | Settings | Finance Director | `/admin` |

---

## 8. Authentication & Authorization

### Authentication Flow

```
1. User submits email + password at /login
      │
      ▼
2. POST /auth/login → NestJS API
      │ Response: { accessToken, user }
      ▼
3. AuthProvider (AuthContext.tsx):
   ├── Set cookie: mtr_token (HttpOnly-like, readable by proxy.ts)
   └── Write to localStorage: martinrea.auth.user (user profile only)
      │
      ▼
4. proxy.ts (Next.js server gate):
   ├── No token + protected route → redirect /login
   └── Token present + /login route → redirect /dashboard
      │
      ▼
5. (app)/layout.tsx (client auth gate):
   ├── Reads user from AuthContext
   ├── Calls canAccessPath(user.role, pathname) → redirect if denied
   └── Renders Sidebar + Topbar
      │
      ▼
6. api.ts Axios interceptors:
   ├── Request: Authorization: Bearer {mtr_token from cookie}
   └── Response 401: clear cookie + localStorage → redirect /login
      │
      ▼
7. GET /users/me on app mount → refresh user profile
```

### Demo Accounts

| Email | Role | Password | Approval Cap |
|-------|------|----------|-------------|
| `clerk@martinrea.dev` | AP Clerk | `Password123!` | N/A |
| `pm@martinrea.dev` | Plant Manager | `Password123!` | $50,000 |
| `fd@martinrea.dev` | Finance Director | `Password123!` | Unlimited |

### Role-Based Access Control (RBAC)

RBAC is enforced in three layers:

**1. Navigation** — `nav-items.ts` filters sidebar items:
```typescript
// Items with allowedRoles: ['FINANCE_DIRECTOR'] only appear for FDs
{ label: 'Analytics', roles: ['FINANCE_DIRECTOR'] }
```

**2. Route access** — `canAccessPath()` in `(app)/layout.tsx`:
```typescript
// Redirects to /dashboard if role cannot access path
if (!canAccessPath(user.role, pathname)) router.push('/dashboard');
```

**3. Action buttons** — `lib/permissions.ts`:
```typescript
const PROFILES = {
  AP_CLERK:         { canCreate: true, canEdit: true, canApprove: false, approvalCap: 0 },
  PLANT_MANAGER:    { canCreate: false, canEdit: false, canApprove: true, approvalCap: 50_000 },
  FINANCE_DIRECTOR: { canCreate: false, canEdit: true, canApprove: true, approvalCap: Infinity },
};
```

---

## 9. Invoice Lifecycle & State Machine

### Status Flow

```
RECEIVED → OCR_PROCESSING → PENDING_REVIEW → PENDING_MATCH → MATCHED → PENDING_APPROVAL → APPROVED
                                                    │                          │
                                               EXCEPTION                   REJECTED
```

### Status Definitions

| Status | Owner | Meaning | Trigger |
|--------|-------|---------|---------|
| `RECEIVED` | Ayush (Ingestion) | Document arrived via Email/SFTP/Portal | Automatic on successful file validation |
| `OCR_PROCESSING` | Abhay (OCR) | Document being processed by Azure Document Intelligence | Automatic on queue pickup |
| `PENDING_REVIEW` | Dhwaj (UI-A) | OCR complete; AP Clerk must verify and correct data | Automatic after OCR |
| `PENDING_MATCH` | Yash (UI-B) | Data verified; ready for 3-way match | AP Clerk saves from Document Viewer |
| `MATCHED` | Yash (UI-B) | 3-way match complete; no unresolved discrepancies | AP Clerk submits from Workbench |
| `PENDING_APPROVAL` | Mohd Aman (Workflow) | In approval chain awaiting authorization | Automatic on match submission |
| `APPROVED` | Mohd Aman (Workflow) | All required approvals obtained; ready for payment | Final approver action |
| `REJECTED` | Mohd Aman (Workflow) | Rejected by approver; returned to AP Clerk | Approver rejection action |
| `EXCEPTION` | Yash / Mohd Aman | Discrepancy flagged; in exception queue | Exception flag from Workbench |

### Frontend Action → State Transition Map

| Action Button | Current Status | Resulting Status | Permitted Roles |
|---------------|----------------|-----------------|----------------|
| "Submit for matching" | `PENDING_REVIEW` | `PENDING_MATCH` | AP Clerk, Finance Director |
| "Run match & route" | `PENDING_MATCH` | `PENDING_APPROVAL` | AP Clerk, Finance Director |
| "Flag as exception" | `PENDING_MATCH` | `EXCEPTION` | AP Clerk, Finance Director |
| "Approve" | `PENDING_APPROVAL` | `APPROVED` | Plant Manager (≤$50K), Finance Director |
| "Reject" | `PENDING_APPROVAL` | `REJECTED` | Plant Manager (current approver), Finance Director |

### Approval Routing Rules

| Invoice Total | Approval Chain |
|--------------|----------------|
| ≤ $10,000 | → Finance Director (single approval) |
| $10,001 – $50,000 | → Plant Manager → Finance Director |
| > $50,000 | → Plant Manager → Finance Director → VP Finance |

Rules stored in `Rules_Engine` DB table (not hardcoded — thresholds updatable without code changes).

---

## 10. Module Reference

### Fully Implemented Modules

#### Login (`/login`)
- Branded login page with Martinrea logo
- React Hook Form + Zod validation
- One-click demo account buttons (fills email/password)
- Redirect to `/dashboard` on success
- Redirect to `/login` if already logged out

#### Dashboard (`/dashboard`)
- **KPI tiles:** Open invoices, Awaiting approval, Exceptions, Approved value
- **Invoice pipeline chart:** Recharts bar chart, count per status, color-coded
- **Recent invoices feed:** Last 8 invoices with status, amount, supplier
- **My approval queue:** Invoices where `currentApproverId === user.id`
- **Status legend:** All statuses with color and count
- **Role-aware greeting:** Personalized with role pill and approval cap

#### Invoice Processing (`/invoices`)
- **Status quick-filter chips:** All, Open, and per-status (dynamic)
- **Search bar:** Invoice number, supplier, PO number, supplier ID (debounced)
- **Plant filter:** Dropdown filtering by plant
- **Sortable columns:** Invoice number, amount, last updated (toggle asc/desc)
- **URL-synced filters:** `?q=&status=&plant=` persists across page refreshes
- **Refresh button:** Invalidates React Query cache

#### Invoice Detail (`/invoices/:id`)
- **Header card:** Invoice number, status badge, CFDI badge, supplier, PO, plant, channel, dates, total amount
- **Approval cap notice:** Plant Manager seeing invoice above $50K cap
- **Action toolbar:** Context-sensitive buttons (submit review, run match, approve, reject, flag exception)
- **Next allowed transitions:** Shown inline from `/allowed-transitions` endpoint
- **Rejection reason:** Displayed if invoice is in REJECTED state
- **Lifecycle timeline:** Visual progress through all 7 main statuses
- **Approval chain:** Ordered approver steps with decisions and timestamps
- **Metadata grid:** All invoice fields in a structured grid

#### Audit Logs (`/audit`)
- Fetches `GET /audit-logs`
- Normalizes flexible backend response shapes
- Search and filter by action type
- Styled action chips with color coding
- Finance Director / VP Finance only (RBAC-gated)

### Scaffold Modules (Awaiting Implementation)

All scaffold pages use `ModuleScaffold` component — showing title, description, and icon with a "ready for data" state.

| Module | Route | Responsible | Priority |
|--------|-------|-------------|----------|
| OCR Review Queue | `/ocr` | Dhwaj | High |
| Document Viewer | `/documents` | Dhwaj | High |
| 3-Way Match | `/match` | Yash | High |
| Approval Queue | `/approvals` | Yash | High |
| Exception Queue | `/exceptions` | Yash | High |
| Payment Packages | `/payments` | TBD | Medium |
| Vendor Management | `/vendors` | TBD | Medium |
| Repository Search | `/search` | TBD | Medium |
| Analytics | `/analytics` | TBD | Low |
| Admin Panel | `/admin` | TBD | Low |

---

## 11. API Reference

### Base URL
```
NEXT_PUBLIC_API_BASE_URL=https://bloating-plausibly-ardently.ngrok-free.dev/api
```
(Configurable via environment variable; `next.config.ts` proxies `/api/*` for same-origin deployments)

### Authentication Endpoints

```
POST /auth/login
Body: { email: string; password: string }
Response: { accessToken: string; user: AuthUser }

GET /users/me
Headers: Authorization: Bearer {token}
Response: AuthUser
```

### Invoice Endpoints

```
GET /invoices
Response: Invoice[] | { data: Invoice[]; pagination?: {...} }

GET /invoices/:id
Response: Invoice

POST /invoices
Body: CreateInvoiceDto
Response: Invoice

PATCH /invoices/:id
Body: Partial<Invoice>
Response: Invoice

GET /invoices/:id/allowed-transitions
Response: { allowedTransitions: InvoiceStatus[] }

POST /invoices/:id/submit-review
Response: Invoice   (PENDING_REVIEW → PENDING_MATCH)

POST /invoices/:id/submit-match
Response: Invoice   (PENDING_MATCH → PENDING_APPROVAL)

POST /invoices/:id/approve
Response: Invoice   (PENDING_APPROVAL → APPROVED)

POST /invoices/:id/reject
Body: { reason: string }
Response: Invoice   (PENDING_APPROVAL → REJECTED)

POST /invoices/:id/flag-exception
Body: { reasonCode: string; notes?: string }
Response: Invoice   (PENDING_MATCH → EXCEPTION)

POST /invoices/:id/transitions
Body: { transition: InvoiceStatus }
Response: Invoice   (generic transition override)
```

### Integration Endpoints

```
GET /api/integrations/goods-receipts?po={PONumber}&instance={plantId}
Response: { grNumber: string; receiptDate: string; lineItems: GRLineItem[] }

GET /api/documents/:id/view
Response: { url: string; expiresAt: string }   (time-limited SAS URL, 15 min)

GET /api/invoices/search?q={term}&status={}&dateFrom={}&dateTo={}&supplier={}
Response: { data: Invoice[]; pagination: { total, page, pageSize } }

GET /audit-logs
Response: AuditLog[]

POST /escalation/run-now
Response: { escalated: number }
```

### Response Envelope Convention (Roshni's API standard)
```typescript
{
  success: boolean;
  data: T;
  error?: { message: string; code: string; fields?: Record<string, string> };
  pagination?: { total: number; page: number; pageSize: number; totalPages: number };
}
```

---

## 12. Development Tracks & Requirements

### Track: Ingestion Epic (Ayush)
**User Stories:** ING-01 through ING-06

- **ING-01/05:** Foundation & pre-processing service (NestJS, format validation, file quarantine, health check)
- **ING-02:** Email ingestion via MS Graph API (OAuth 2.0, 5-min polling, mark as read, retry logic)
- **ING-03/04:** SFTP & web portal ingestion (ssh2-sftp-client, `POST /api/ingestion/upload`)
- **ING-06:** End-to-end integration testing (Email, SFTP, Portal channels; CI gate)

**Accepted file types:** PDF, JPG, PNG, TIF  
**Max file size:** 10 MB  

---

### Track: AI & OCR Epic (Abhay)
**User Stories:** OCR-01 through OCR-05

- **OCR-01/02:** Azure Document Intelligence setup and integration (Prebuilt Invoice model, Blob path input, exponential backoff retry)
- **OCR-03:** Data mapping and schema normalization (clean JSON matching Invoice DB schema: Supplier Name, Invoice Number, Date, PO Number, Total, Tax, Line Items)
- **OCR-04/05:** Confidence scoring (<80% triggers `REQUIRES_REVIEW: true`) and language/CFDI detection

**Key output JSON fields:**
```json
{
  "invoiceNumber": "INV-2024-001",
  "supplierName": "Acme Parts Co.",
  "invoiceDate": "2024-01-15",
  "poNumber": "PO-88472",
  "subtotal": 10000.00,
  "taxAmount": 1300.00,
  "totalAmount": 11300.00,
  "currency": "USD",
  "lineItems": [...],
  "REQUIRES_REVIEW": false,
  "CONFIDENCE_SCORE": 94.2,
  "DOCUMENT_TYPE": "STANDARD"
}
```

---

### Track: External Integrations Epic (Manav + Eswar)
**User Stories:** INT-01 through INT-05

- **INT-01/02:** Master data sync — Suppliers and Open POs from Epicor CMS (nightly 2:00 AM per plant, upsert to PostgreSQL cache)
- **INT-03/05:** Goods Receipt fetch and normalization (`GET /api/integrations/goods-receipts`, <3s response)
- **INT-04:** CFDI validation — parse XML, validate SAT fields, call SAT validation webservice, persist result

**Epicor CMS:** 44 instances; SFTP or ODBC/JDBC connectivity per instance

---

### Track: Data & Repository Epic (Roshni)
**User Stories:** DAT-01 through DAT-05

- **DAT-01/03:** PostgreSQL schema + core CRUD APIs (Invoices, Invoice_Lines, Suppliers, Purchase_Orders, Goods_Receipts, Users, Roles, Audit_Logs tables; Flyway migrations)
- **DAT-02:** Azure Blob Storage (containers: invoices-raw, invoices-processed, invoices-rejected; SAS URL generation — 15 min expiry)
- **DAT-04/05:** Audit logging (append-only `Audit_Logs` table) + search API (filter by date, supplier, PO, status, amount, channel; paginated; CSV export)

**Database Indexes:** `invoice_number`, `supplier_id`, `po_number`, `status`, `created_at`

---

### Track: Workflow & Approvals Epic (Mohd Aman)
**User Stories:** WF-01 through WF-05

- **WF-01/02:** RBAC (JWT roles, 3 Phase 1 roles) and lifecycle state machine (409 on invalid transitions, all transitions logged)
- **WF-03:** Sequential approval routing rules engine (stored in `Rules_Engine` table, not hardcoded)
- **WF-04/05:** Email notifications (SMTP/Azure Communication Services, HTML templates, Martinrea branding) + SLA escalation (cron: every hour, >48h → escalate, logged as `SLA_BREACH`)

---

### Track: UI/UX Track A — Dashboard & Document Viewer (Dhwaj)

See [`docs/frontend-prd-dhwaj-yash.md`](./frontend-prd-dhwaj-yash.md) — Section 4 for full requirements.

**User Stories:** UI-A-01 through UI-A-05  
**Completion:** ~40% (Dashboard complete; Document Viewer/OCR form not yet built)

---

### Track: UI/UX Track B — 3-Way Match Workbench (Yash)

See [`docs/frontend-prd-dhwaj-yash.md`](./frontend-prd-dhwaj-yash.md) — Section 5 for full requirements.

**User Stories:** UI-B-01 through UI-B-05  
**Completion:** ~15% (Mutations wired; workbench UI not yet built)

---

## 13. Deployment & Environment

### Environment Variables

```env
# Required
NEXT_PUBLIC_API_BASE_URL=https://your-api-host/api

# Optional (OCI Object Storage upload)
NEXT_PUBLIC_OCI_PAR_URL=https://objectstorage.region.oraclecloud.com/p/...

# API proxy target (server-side, not exposed to client)
API_PROXY_TARGET=https://your-api-host
```

### CI/CD Pipeline

**Trigger:** Push to `main` branch OR Pull Request to `main`  
**Provider:** GitHub Actions → Vercel  
**Config:** `.github/workflows/deploy.yml`

```
Push to main
    │
    ▼
GitHub Actions
    ├── Install dependencies (npm ci)
    ├── Run ESLint
    ├── Run TypeScript type check
    └── Deploy to Vercel
          ├── main branch → Production deployment
          └── PR → Preview deployment (unique URL per PR)
```

### Running Locally

```bash
# Install dependencies
npm install

# Start development server (Next.js, port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

### Environment Configuration

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | `localhost:3000` | Local development |
| Preview | `*.vercel.app` | PR preview deployments |
| Production | `martinrea-ap.vercel.app` (or custom domain) | Production |

---

## 14. Sprint Deliverables & Quality Gates

### Per-Sprint Mandatory Deliverables

Per Dual-Track Agile methodology — each sprint produces deliverables submitted within 2 business days of sprint closure. Martinrea reviews within 10 business days.

| Deliverable | Acceptance Standard |
|-------------|---------------------|
| Figma UI/UX | All screens for sprint; includes mobile-responsive states |
| Physical Data Model | Delta DB schema changes with Flyway migration scripts |
| Technical Design Doc | Updated architecture, API contracts, integration diagrams |
| Source Code | Feature branches merged to `main` via reviewed PRs |
| Unit Tests | >80% code coverage for all new service functions |
| Code Quality Report | SonarQube/ESLint; no critical or blocker issues |
| Test Scenarios | Functional test scenarios mapped to acceptance criteria |
| Test Cases | Step-by-step with expected results |
| Test Results | Pass/fail for Unit, Functional, Integration, NFRs |
| Defects Log | All defects categorized by severity with status |
| Sprint Demo | Live demo recording covering all completed stories |

### SLA Response Matrix

| Severity | Definition | Response SLA | Resolution Goal |
|----------|------------|-------------|-----------------|
| Sev-1: Critical | System down, data corruption, security breach | 2 hours | < 24 hours |
| Sev-2: High | Major feature failure (OCR stalled, workflow fails); workaround difficult | 4 hours | < 48 hours |
| Sev-3: Medium | Functional bug; business process can continue via workaround | 24 hours | Next sprint |
| Sev-4: Low | Cosmetic issues, enhancement requests | N/A | Backlog |

---

## 15. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | API Response Time (read) | 95th percentile < 500ms |
| Performance | Epicor GR Fetch | < 3 seconds |
| Performance | OCR Throughput | 450,000 documents/year (~1,233/day peak) |
| Availability | Uptime | 99.5% during business hours (06:00–22:00 ET, Mon–Fri) |
| Scalability | Architecture | All microservices scale independently via Kubernetes HPA |
| Security | Data at Rest | AES-256 encryption (DB and Blob Storage) |
| Security | Data in Transit | TLS 1.2 or higher for all API communication |
| Security | Authentication | Valid JWT required for all endpoints; tokens expire in 8 hours |
| Compliance | Audit Trail | 100% of state changes and user actions in immutable Audit_Logs |
| Compliance | CFDI / SAT | Mexico plant invoices must pass SAT validation before matching |
| Compliance | Data Retention | Invoice records and documents retained minimum 7 years |
| Reliability | Error Handling | All external API calls implement retry with exponential backoff |
| Observability | Monitoring | All services report to Datadog; PagerDuty alerts for Sev-1 within 2 hours |

---

## 16. Assumptions & Out-of-Scope

### Martinrea Obligations (Pre-Conditions)

- VPN/VDI access to Epicor CMS and email servers provisioned for Netlink team by **Week 1 of Sprint 1**
- Active, authorized credentials for all third-party supplier portals (CFDI Mexico, Xeeva) provided
- Finance SME / Product Owner available for requirement decisions within **24 hours** of request
- DEV, QA/UAT, and PROD cloud environments provisioned by Martinrea on Azure
- Delegation of Authority (DOA) matrix and GL Chart of Accounts logic provided before Workflow development
- UAT feedback consolidated and returned within **2-week feedback window**

### Technical Assumptions

- Epicor CMS integration supports standard database (ODBC/JDBC) or file-based (CSV/XML) integration. Custom API wrappers out of scope for Phase 1.
- Vendor Master and PO data in CMS is reasonably clean. Extensive data cleansing out of scope.
- Architecture sized for ~450K annual documents. Significant spikes may require infrastructure resizing (change request).
- At least 80% of invoices are native digital PDFs. High volumes of handwritten/poorly-scanned paper will increase manual correction effort.
- SAT validation webservice accessible from Martinrea Azure network.

### Out of Scope — Phase 1

| Feature | Phase |
|---------|-------|
| AI/ML automated 2-way and 3-way matching | Phase 2 |
| Automated voucher creation into Epicor CMS | Phase 2 |
| Supplier Self-Service Portal | Phase 3 |
| Daily bank reconciliation and payment automation | Phase 3 |
| Advanced analytics, SLA dashboards, KPI reporting | Phase 2/3 |
| App Store / Google Play Store mobile app deployment | Phase 3 (Martinrea responsibility) |
| RPA bot maintenance and AI model retraining post-deployment | Separate Support contract |

---

## Appendix: Quick Reference

### Keyboard Shortcuts (Frontend)

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open global search |
| `⌘U` / `Ctrl+U` | Open upload invoice modal (if AP Clerk) |
| `Tab` | Navigate between form fields |
| `Escape` | Close modal dialogs |

### Status Badge Quick Reference

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| RECEIVED | Grey | Just arrived |
| OCR_PROCESSING | Blue | AI extracting data |
| PENDING_REVIEW | Amber | Clerk must verify |
| PENDING_MATCH | Indigo | Ready for matching |
| MATCHED | Green | Match complete |
| PENDING_APPROVAL | Orange | Awaiting sign-off |
| APPROVED | Teal | Payment ready |
| REJECTED | Red | Sent back for rework |
| EXCEPTION | Rose | Held for investigation |

---

*Martinrea AP Automation Platform — Phase 1 Documentation*  
*Prepared by Netlink Software Group America | June 2026*  
*For questions, contact the project coordinator (Aditya) or technical lead.*
