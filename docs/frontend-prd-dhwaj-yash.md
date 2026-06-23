# Frontend Product Requirements Document
## Martinrea Finance AP System — UI/UX Track A & B
### Combined PRD: Dhwaj (Track A) + Yash (Track B)

**Project:** Martinrea AP Automation Platform — Phase 1  
**Document Owner:** Netlink Software Group America  
**Version:** 1.0 | June 2026  
**Developers:** Dhwaj (UI/UX Track A) · Yash (UI/UX Track B)  
**Framework:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · TanStack Query v5

---

## Table of Contents

1. [Overview & Objectives](#1-overview--objectives)
2. [Developer Track Assignments](#2-developer-track-assignments)
3. [Cross-Track Integration Map](#3-cross-track-integration-map)
4. [Track A — Dashboard & Document Viewer (Dhwaj)](#4-track-a--dashboard--document-viewer-dhwaj)
   - 4.1 [UI-A-01: Frontend Boilerplate](#41-ui-a-01-frontend-boilerplate--project-setup)
   - 4.2 [UI-A-02: Command Center Dashboard](#42-ui-a-02-command-center-dashboard)
   - 4.3 [UI-A-03: Split-Screen Document Viewer Shell](#43-ui-a-03-split-screen-document-viewer-shell)
   - 4.4 [UI-A-04: OCR Data Binding](#44-ui-a-04-ocr-data-binding)
   - 4.5 [UI-A-05: Manual Editing & Validation UI](#45-ui-a-05-manual-editing--validation-ui)
5. [Track B — 3-Way Match Workbench (Yash)](#5-track-b--3-way-match-workbench-yash)
   - 5.1 [UI-B-01: Workbench UI Layout](#51-ui-b-01-workbench-ui-layout)
   - 5.2 [UI-B-02: CMS Data Integration](#52-ui-b-02-cms-data-integration)
   - 5.3 [UI-B-03: Visual Discrepancy Highlighting](#53-ui-b-03-visual-discrepancy-highlighting)
   - 5.4 [UI-B-04: Exception Handling UI](#54-ui-b-04-exception-handling-ui)
   - 5.5 [UI-B-05: Submit to Approval](#55-ui-b-05-submit-to-approval)
6. [Invoice Lifecycle — Frontend Perspective](#6-invoice-lifecycle--frontend-perspective)
7. [Shared Component Library](#7-shared-component-library)
8. [API Contracts](#8-api-contracts)
9. [RBAC & Permission Model](#9-rbac--permission-model)
10. [Implementation Status](#10-implementation-status)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Acceptance Checklist](#12-acceptance-checklist)

---

## 1. Overview & Objectives

The Martinrea AP Automation Platform replaces a paper-heavy, manually-reconciled Accounts Payable process across **40+ manufacturing plants** with a digitized, centrally accessible workflow. Phase 1 targets **80% human-assisted** processing — operators retain control but are guided by AI and automation.

The frontend is the primary interface for three core user roles:

| Role | Primary Actions |
|------|----------------|
| **AP Clerk** | Receive invoices, verify OCR data, trigger matching, flag exceptions |
| **Plant Manager** | Review approval queue, approve/reject invoices ≤ $50K |
| **Finance Director** | Approve any amount, force transitions, trigger escalation |

### Frontend Scope (Phase 1)

The two frontend tracks collectively own the **entire user-facing surface** of the AP platform:

- **Track A (Dhwaj):** Invoice intake visibility, data verification/correction UI, OCR form binding
- **Track B (Yash):** 3-way match reconciliation workbench, discrepancy detection, exception management, approval submission

---

## 2. Developer Track Assignments

| Track | Developer | User Story IDs | Core Deliverable |
|-------|-----------|---------------|-----------------|
| UI/UX Track A | **Dhwaj** | UI-A-01 through UI-A-05 | Dashboard, Invoice List, Split-Screen Document Viewer, OCR Form |
| UI/UX Track B | **Yash** | UI-B-01 through UI-B-05 | 3-Way Match Workbench, Discrepancy Highlighter, Exception Modal, Approval Submission |

---

## 3. Cross-Track Integration Map

```
Ayush (Ingestion)
    │ Uploads validated files to Blob Storage
    ▼
Abhay (OCR)
    │ Produces OCR JSON (confidence score, REQUIRES_REVIEW flag)
    ▼
Roshni (Data/API)
    │ Stores in PostgreSQL; exposes GET /invoices, GET /invoices/:id
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND BOUNDARY                            │
│                                                                 │
│  DHWAJ (Track A)                    YASH (Track B)              │
│  ───────────────────                ─────────────────────────   │
│  Dashboard (invoice list)           3-Way Match Workbench       │
│  Document Viewer (PDF + OCR form)   Discrepancy Highlighting    │
│  Save & Proceed → PENDING_MATCH     Exception Flagging          │
│                                     Submit for Approval         │
│                        │                         │              │
└────────────────────────┼─────────────────────────┼─────────────┘
                         │                         │
                         ▼                         ▼
              Manav (Integrations)      Mohd Aman (Workflow)
              PO / GR data from        State machine, approval
              Epicor CMS (44 sites)    routing, email notifications
```

**Data flow between tracks:**
- Dhwaj's "Save & Proceed" from the Document Viewer transitions invoice status to `PENDING_MATCH`, making it available in Yash's match workbench queue.
- Yash's "Submit for Approval" triggers Mohd Aman's workflow engine which builds the approval chain and routes to the correct approver tier.
- Both tracks read from Roshni's unified REST API layer.

---

## 4. Track A — Dashboard & Document Viewer (Dhwaj)

### Objective
Build the primary daily-use interface for AP Clerks and managers. This includes the **Command Center Dashboard** for invoice queue management and the **split-screen Document Viewer** that allows users to verify OCR-extracted data against the original invoice PDF — correcting errors before the invoice proceeds to 3-way matching.

---

### 4.1 UI-A-01: Frontend Boilerplate & Project Setup

**Story ID:** UI-A-01  
**As:** System Architect  
**I want:** A well-structured Next.js application repository with all necessary tooling configured  
**So that:** All frontend developers can work from a consistent, linted, typed base with no setup friction

#### Acceptance Criteria

- [x] Next.js 16 project with TypeScript, ESLint, Tailwind CSS initialized
- [x] TanStack React Query v5 configured with shared `QueryClient` (stale time: 30s)
- [x] Global layout: Root `layout.tsx` wraps all pages with `QueryClientProvider`, `AuthProvider`, Sonner `Toaster`
- [x] Routing architecture: `src/app/` holds thin route shells; `src/views/` holds actual page implementations
- [x] TypeScript path alias `@/*` → `src/*` configured in `tsconfig.json`
- [x] Tailwind theme extended with Martinrea brand tokens: `brand`, `sidebar`, `canvas`, `ink`, `ink-muted`, `ink-subtle`, `line`
- [x] Sidebar navigation with role-filtered items from `nav-items.ts`
- [x] Topbar with global search (⌘K), notifications menu, and user avatar
- [x] `proxy.ts` server gate: unauthenticated users redirected to `/login`; authenticated users on `/login` redirected to `/dashboard`
- [x] CI/CD: GitHub Actions workflow deploys to Vercel on push to `main` and on PRs

#### Current Status: **COMPLETE**

---

### 4.2 UI-A-02: Command Center Dashboard

**Story ID:** UI-A-02  
**As:** AP Clerk / Plant Manager / Finance Director  
**I want:** A real-time centralized dashboard showing invoice status across all plants  
**So that:** I can prioritize my workload and immediately see which invoices need my attention

#### Acceptance Criteria

- [x] Authentication gate on all pages — unauthenticated users redirected to `/login`
- [x] **KPI tiles (4):**
  - Open Invoices (count of non-terminal, non-exception invoices)
  - Awaiting Approval (count of `PENDING_APPROVAL` invoices)
  - Exceptions (count of `EXCEPTION` invoices, "Need clerk review")
  - Approved Value (sum of `APPROVED` invoice amounts; sub-label shows outstanding value)
- [x] **Invoice pipeline bar chart** (Recharts): Count per status, color-coded matching status badge colors, updates without full page reload
- [x] **Recent invoices feed** (8 most recent): Invoice number, supplier, ingestion channel, relative timestamp, amount, status badge; clickable → `/invoices/:id`
- [x] **My approval queue** (approver-specific): Shows invoices where `currentApproverId === user.id` (max 6); empty state "You're all caught up" if none
- [x] **Status legend card**: All statuses with color dot and count
- [x] **Role-aware greeting**: Personalized header with user's first name and role pill with approval cap
- [x] **Empty state**: Shown when no invoices exist in the system (`EmptyInvoicesState` component)
- [x] Loading skeletons while data fetches
- [ ] Auto-refresh every 60 seconds without full page reload *(PRD requirement — implement via `refetchInterval: 60_000` in `useInvoicesList`)*

#### Dashboard Routes
- Route: `/dashboard`
- View: `src/views/DashboardPage.tsx`
- App shell: `src/app/(app)/dashboard/page.tsx`

#### API Dependencies
```
GET /invoices  →  Roshni's list endpoint (returns array or wrapped envelope)
```

#### Current Status: **COMPLETE** (auto-refresh pending)

---

### 4.3 UI-A-03: Split-Screen Document Viewer Shell

**Story ID:** UI-A-03  
**As:** AP Clerk  
**I want:** A split-screen view with the original invoice PDF on the left and extracted data on the right  
**So that:** I can visually verify OCR accuracy and correct mistakes without switching between screens

#### Acceptance Criteria

- [ ] Route: `/invoices/:id/review` (separate route from invoice detail `/invoices/:id`)
- [ ] **Left panel — PDF Viewer:**
  - Renders original invoice document using SAS URL from `GET /api/documents/:id/view`
  - Supports zoom in/out (minimum: 50%, maximum: 200%, step: 10%)
  - Supports multi-page scroll
  - Renders **inside the panel** — no download or new tab opening
  - Loading state while SAS URL is fetched
  - Error state with "Document unavailable" message if SAS URL fetch fails
- [ ] **Right panel — OCR Data Form:**
  - Pre-populated from `GET /api/invoices/:id` OCR JSON payload
  - **Header fields:** Supplier Name, Invoice Number, Invoice Date, PO Number, Subtotal, Tax Amount, Total Amount, Currency
  - **Line items grid:** Description (editable), Quantity (numeric), Unit Price (numeric), Line Total (auto-calculated)
  - All fields editable by AP Clerk; read-only for approvers
- [ ] Responsive split: 50/50 on desktop; stacked on mobile (PDF top, form bottom)
- [ ] Keyboard shortcut: Tab/Shift+Tab navigates between form fields

#### Design Reference
Two-panel split layout matching Netlink's proposed UI in the RFQ response deck (slide 11 — "Document Viewer Screen").

#### Current Status: **NOT IMPLEMENTED** (scaffold at `/documents` — `ModuleScaffold` placeholder)

---

### 4.4 UI-A-04: OCR Data Binding

**Story ID:** UI-A-04  
**As:** AP Clerk  
**I want:** OCR-extracted data to be auto-populated in the review form  
**So that:** I only need to correct mistakes rather than re-entering all data manually

#### Acceptance Criteria

- [ ] On load, fetch `GET /api/invoices/:id` and populate form fields with OCR JSON values
- [ ] Fields not detected by OCR (null values) display as empty/blank — not hidden
- [ ] **Low confidence banner:** If `REQUIRES_REVIEW: true` in OCR JSON, display a prominent amber banner:
  > ⚠️ OCR Confidence Low — Please Verify All Fields
- [ ] Confidence score (0–100%) shown next to the banner if available
- [ ] Individual field-level confidence: Fields with confidence < 70% highlighted with amber border
- [ ] **CFDI badge:** If `DOCUMENT_TYPE: 'CFDI'` in OCR JSON, display a Mexico/CFDI indicator in the panel header
- [ ] Form state tracks which fields were manually modified (dirty state) for audit purposes

#### Current Status: **NOT IMPLEMENTED** (Invoice detail page at `/invoices/:id` shows metadata but not the split-screen OCR form)

---

### 4.5 UI-A-05: Manual Editing & Validation UI

**Story ID:** UI-A-05  
**As:** AP Clerk  
**I want:** To manually correct OCR errors with proper validation and then save the verified data  
**So that:** No bad data propagates to the matching engine downstream

#### Acceptance Criteria

- [ ] **Field validations:**
  - Invoice Date: Must be a valid past or present date (ISO 8601)
  - Amounts (Subtotal, Tax, Total): Must be numeric; Total must equal Subtotal + Tax (±0.01 tolerance)
  - PO Number: Must match format validation rule (alphanumeric, configurable length)
  - Line Item Quantity: Must be a positive number
  - Line Item Unit Price: Must be a positive number
  - Line Item Line Total: Auto-computed; displayed read-only as `Quantity × Unit Price`
- [ ] Validation errors displayed inline below each field (not alert/toast)
- [ ] **"Save & Proceed" button:**
  - Calls `PATCH /api/invoices/:id` with corrected data payload
  - Transitions invoice status to `PENDING_MATCH`
  - On success: shows success toast + navigates to invoice list or workbench
  - Disabled and shows spinner during API call (prevent double-submit)
  - Disabled if any validation error exists
- [ ] **"Flag for Manual Review" button:**
  - Opens modal requiring a comment (mandatory)
  - Routes invoice to supervisor exception queue
  - Creates audit log entry
- [ ] Unsaved changes warning: If user navigates away with unsaved form changes, show browser `beforeunload` prompt

#### Current Status: **NOT IMPLEMENTED**

---

## 5. Track B — 3-Way Match Workbench (Yash)

### Objective
Build the **complex reconciliation interface** where AP Clerks manually perform 3-way matching. The workbench displays Invoice, PO, and Goods Receipt data side-by-side, automatically highlights discrepancies with tolerance-based logic, enables formal exception flagging with reason codes, and submits confirmed matches to the approval workflow engine.

---

### 5.1 UI-B-01: Workbench UI Layout

**Story ID:** UI-B-01  
**As:** AP Clerk  
**I want:** Invoice, Purchase Order, and Goods Receipt displayed side-by-side in a structured workbench  
**So that:** I can verify we received what we are being billed for with all data in one view — no toggling between systems

#### Acceptance Criteria

- [ ] **Access:** Workbench accessible from invoice list via "Match" action button (only enabled for invoices with `status === 'PENDING_MATCH'`)
- [ ] **Route:** `/match?invoiceId=:id` or `/invoices/:id/match`
- [ ] **Three-column layout:**
  - **Left — Invoice Details (read-only):** Supplier name, invoice number, invoice date, currency, subtotal, tax, total, line items
  - **Center — Purchase Order Details:** PO Number, PO Date, buyer, line items (Description, Ordered Qty, Unit Price, Line Total)
  - **Right — Goods Receipt Details:** GR Number, receipt date, plant, line items (Description, Received Qty, Unit Price, Line Total)
- [ ] **Panel headers clearly labeled:** "Invoice (Vendor)" | "Purchase Order (CMS)" | "Goods Receipt (CMS)"
- [ ] Line items from all three sources displayed as **aligned rows** for visual comparison
- [ ] Loading skeleton shown while GR data fetches from Manav's integration API
- [ ] Responsive: on tablet/mobile, panels stack vertically with collapsible sections
- [ ] **Workbench header:** Invoice number, supplier, amount, current status badge, discrepancy count badge

#### Current Status: **NOT IMPLEMENTED** (scaffold at `/match` — `ModuleScaffold` placeholder)

---

### 5.2 UI-B-02: CMS Data Integration

**Story ID:** UI-B-02  
**As:** AP Clerk  
**I want:** PO and Goods Receipt data fetched automatically when I open the workbench  
**So that:** I don't need to manually look up data in Epicor — the system retrieves it for me

#### Acceptance Criteria

- [ ] On workbench load, fetch PO data from: `GET /api/invoices/:id` (PO details embedded or linked)
- [ ] **Auto-fetch GR data:** When PO Number is confirmed in invoice panel, automatically call:
  ```
  GET /api/integrations/goods-receipts?po={PONumber}&instance={instanceId}
  ```
- [ ] GR data response rendered in right panel within 3 seconds (NFR target)
- [ ] **404 handling:** If no GR found for the PO, right panel shows: "No Goods Receipt found for PO {PONumber}" with option to proceed as 2-way match
- [ ] **Loading state:** Right panel shows skeleton rows while fetching GR data
- [ ] **Error state:** Network error shows retry button; API error shows error message
- [ ] Pagination for POs with >50 GR line items (load more / paginate)
- [ ] PO data fetched from Roshni's cached DB (not directly from Epicor)

#### API Dependencies
```
GET /api/invoices/:id                                           → Invoice + embedded PO info
GET /api/integrations/goods-receipts?po={PO}&instance={plant} → Live GR data from Manav
```

#### Current Status: **NOT IMPLEMENTED**

---

### 5.3 UI-B-03: Visual Discrepancy Highlighting

**Story ID:** UI-B-03  
**As:** AP Clerk  
**I want:** The system to automatically highlight quantity and price mismatches  
**So that:** I can immediately see which line items have problems without manual calculation

#### Acceptance Criteria

- [ ] **Comparison logic runs** after all three panels are loaded and data is non-empty
- [ ] **Line-item discrepancy rules:**

  | Condition | Visual Treatment | Tooltip Text |
  |-----------|-----------------|--------------|
  | Invoice Qty > GR Qty | Row background: red (`rose-50`), border: `rose-200` | "Quantity Overbilled" |
  | Invoice Unit Price > PO Unit Price by >2% | Row background: amber (`amber-50`), border: `amber-200` | "Price Variance: {X}% above PO" |
  | Invoice Line Total ≠ Qty × Unit Price | Cell highlight: `rose-100` | "Line total calculation mismatch" |

- [ ] **Header-level alert:** If Invoice Total > PO Total, display alert banner at top of workbench:
  > ⚠️ Invoice Total ({amount}) exceeds PO Total ({poAmount})

- [ ] **Discrepancy count badge:** In workbench header — "X discrepancies detected" (badge turns red if > 0, green if 0)
- [ ] Exact match rows show no highlighting (clean white background)
- [ ] Discrepancy tooltips show on hover (not click)
- [ ] All comparison logic runs **client-side** (no additional API call needed)

#### Tolerance Configuration
- Price variance tolerance: ±2% (configurable — read from a constants file, will become DB-configurable in Phase 2)

#### Current Status: **NOT IMPLEMENTED**

---

### 5.4 UI-B-04: Exception Handling UI

**Story ID:** UI-B-04  
**As:** AP Clerk  
**I want:** To formally flag a discrepancy as an exception with a reason code  
**So that:** No invoice with unresolved discrepancies can accidentally proceed to payment — every exception is documented

#### Acceptance Criteria

- [ ] **"Flag Exception" button** visible in workbench action bar at all times (not just when discrepancies exist)
- [ ] Clicking opens a **modal dialog** with:
  - **Reason Code dropdown (required):**
    - Price Variance
    - Quantity Mismatch
    - Duplicate Invoice
    - Missing PO
    - CFDI Validation Failure
    - Other
  - **Notes textarea (required if "Other" selected, optional otherwise):** Min 10 characters when required
  - **File attachment** (optional): Upload supporting document (PDF, image, max 5MB)
  - Cancel button, "Flag Exception" confirm button
- [ ] On confirm:
  - Calls `POST /api/invoices/:id/flag-exception` with reason code and notes
  - Invoice status → `EXCEPTION`
  - Exception enters **Exception Queue** (visible to AP Supervisors/Finance Director)
  - Audit log entry created
  - Success toast: "Invoice flagged as exception. AP Supervisor notified."
  - Modal closes; user returned to invoice list
- [ ] Confirm button disabled and shows spinner during API call
- [ ] "Other" reason requires notes before confirm button is enabled

#### Current Status: **PARTIALLY IMPLEMENTED** — `flagException` mutation exists in `useInvoiceMutations.ts` and is wired to the "Flag as exception" button on the Invoice Detail page (`/invoices/:id`). The full modal with reason codes and the workbench integration are pending.

---

### 5.5 UI-B-05: Submit to Approval

**Story ID:** UI-B-05  
**As:** AP Clerk  
**I want:** To finalize a successful 3-way match and submit the invoice to the approval workflow  
**So that:** Approved matches move into the authorization chain without manual handoff

#### Acceptance Criteria

- [ ] **"Submit for Approval" button** enabled **only when:**
  - No unresolved discrepancies exist (discrepancy count badge = 0), OR
  - All discrepancies have been individually acknowledged/overridden with a comment
  - All three panels (Invoice, PO, GR) have data loaded
  - Invoice is not CFDI-flagged with `cfdiValid: false`
- [ ] Clicking opens **confirmation modal** displaying:
  - Invoice Number
  - Supplier Name
  - Invoice Amount (formatted)
  - Next approver in chain (fetched from `GET /api/invoices/:id/allowed-transitions` or routing logic)
  - Approval routing tier (Plant Manager, Finance Director based on amount threshold)
- [ ] On confirmation:
  - Calls `POST /api/invoices/:id/submit-match` (or `POST /api/workflow/submit-match`)
  - Invoice status → `PENDING_APPROVAL`
  - Mohd Aman's workflow engine handles all downstream routing from this point
  - Success toast: "Invoice submitted for approval. {ApproverName} has been notified."
  - Navigate to invoice list
- [ ] Submit button disabled and shows spinner during API call (prevent double-submission)
- [ ] If `cfdiValid === false`, button is disabled with tooltip: "CFDI invalid — cannot route to approval"

#### Routing Thresholds (for display purposes only — enforced by backend)
| Invoice Total | Approval Chain |
|--------------|----------------|
| ≤ $10,000 | → Finance Director (single approval) |
| $10,001 – $50,000 | → Plant Manager → Finance Director |
| > $50,000 | → Plant Manager → Finance Director → VP Finance |

#### Current Status: **PARTIALLY IMPLEMENTED** — `submitMatch` mutation exists and is wired to "Run match & route" button on Invoice Detail page. The full workbench with the confirmation modal showing next approver is pending.

---

## 6. Invoice Lifecycle — Frontend Perspective

The following state machine governs every invoice. No state can be skipped. Dhwaj owns the UI for states 1–4; Yash owns states 4–7.

```
     ┌──────────────┐
     │   RECEIVED   │  ← Ayush's ingestion pipeline
     └──────┬───────┘
            │ Automatic (file validated)
     ┌──────▼───────┐
     │ OCR_PROCESS  │  ← Abhay's AI/OCR pipeline
     └──────┬───────┘
            │ Automatic (OCR complete)
     ┌──────▼───────┐
     │PENDING_REVIEW│  ← 📍 DHWAJ — Document Viewer + OCR Form
     └──────┬───────┘
            │ AP Clerk: "Save & Proceed"
     ┌──────▼───────┐
     │PENDING_MATCH │  ← 📍 YASH — Match Workbench opens here
     └──────┬───────┘      │
            │              └─── "Flag Exception" → EXCEPTION ←──┐
     ┌──────▼───────┐                                            │
     │   MATCHED    │  ← Yash: all panels loaded, 0 discrepancies│
     └──────┬───────┘                                            │
            │ "Submit for Approval"                             │
     ┌──────▼───────┐                                            │
     │PENDING_APPR. │  ← Mohd Aman's workflow + Approver UI      │
     └──────┬───────┘       │                                    │
            │               └── Rejected → REJECTED ────────────┘
     ┌──────▼───────┐
     │   APPROVED   │  ← Ready for payment processing
     └──────────────┘
```

### Status Badge Color Map

| Status | Color | Hex |
|--------|-------|-----|
| RECEIVED | Grey | `#6B7280` |
| OCR_PROCESSING | Blue | `#3B82F6` |
| PENDING_REVIEW | Amber | `#F59E0B` |
| PENDING_MATCH | Indigo | `#6366F1` |
| MATCHED | Green | `#10B981` |
| PENDING_APPROVAL | Orange | `#F97316` |
| APPROVED | Teal | `#14B8A6` |
| REJECTED | Red | `#EF4444` |
| EXCEPTION | Rose | `#F43F5E` |

---

## 7. Shared Component Library

Both tracks share a common component set. These should not be duplicated.

### Layout Components
| Component | Location | Used By |
|-----------|----------|---------|
| `Sidebar` | `components/layout/Sidebar.tsx` | Both |
| `Topbar` | `components/layout/Topbar.tsx` | Both |
| `GlobalSearch` | `components/layout/GlobalSearch.tsx` | Both |
| `NotificationsMenu` | `components/layout/NotificationsMenu.tsx` | Both |
| `ModuleScaffold` | `components/layout/ModuleScaffold.tsx` | Placeholder for unbuilt views |

### Invoice Components
| Component | Location | Used By |
|-----------|----------|---------|
| `StatusBadge` | `components/invoices/StatusBadge.tsx` | Both |
| `CreateInvoiceModal` | `components/invoices/CreateInvoiceModal.tsx` | Dhwaj |
| `UploadInvoiceModal` | `components/invoices/UploadInvoiceModal.tsx` | Dhwaj |
| `EmptyInvoicesState` | `components/invoices/EmptyInvoicesState.tsx` | Dhwaj |

### UI Primitives (shadcn-style)
`Button`, `Card`, `Dialog`, `Input`, `Select`, `Textarea`, `Label`, `Skeleton`, `Tabs`, `Tooltip`, `Badge`

All primitives in `src/components/ui/`.

### Hooks
| Hook | Location | Purpose |
|------|----------|---------|
| `useInvoicesList` | `hooks/useInvoices.ts` | Fetch all invoices with ID registry |
| `useInvoice` | `hooks/useInvoices.ts` | Fetch single invoice by ID |
| `useAllowedTransitions` | `hooks/useInvoices.ts` | Fetch allowed next states for an invoice |
| `useSubmitReview` | `hooks/useInvoiceMutations.ts` | PENDING_REVIEW → PENDING_MATCH |
| `useSubmitMatch` | `hooks/useInvoiceMutations.ts` | PENDING_MATCH → PENDING_APPROVAL |
| `useApprove` | `hooks/useInvoiceMutations.ts` | Approve an invoice |
| `useReject` | `hooks/useInvoiceMutations.ts` | Reject with reason |
| `useFlagException` | `hooks/useInvoiceMutations.ts` | Flag as EXCEPTION |

---

## 8. API Contracts

### Endpoints consumed by Track A (Dhwaj)

```typescript
// Fetch invoice list
GET /api/invoices
Response: Invoice[] | { data: Invoice[] }

// Fetch single invoice (includes OCR data)
GET /api/invoices/:id
Response: Invoice

// Fetch allowed next transitions
GET /api/invoices/:id/allowed-transitions
Response: { allowedTransitions: InvoiceStatus[] }

// Update invoice (save OCR corrections)
PATCH /api/invoices/:id
Body: Partial<Invoice>
Response: Invoice

// Get time-limited SAS URL for PDF viewing
GET /api/documents/:id/view
Response: { url: string; expiresAt: string }

// Submit for matching (PENDING_REVIEW → PENDING_MATCH)
POST /api/invoices/:id/submit-review
Response: Invoice
```

### Endpoints consumed by Track B (Yash)

```typescript
// Fetch live Goods Receipt data for a PO
GET /api/integrations/goods-receipts?po={PONumber}&instance={plantId}
Response: {
  grNumber: string;
  receiptDate: string;
  plantId: string;
  lineItems: {
    description: string;
    receivedQty: number;
    unitPrice: number;
    lineTotal: number;
  }[]
}

// Flag invoice as exception
POST /api/invoices/:id/flag-exception
Body: {
  reasonCode: 'PRICE_VARIANCE' | 'QUANTITY_MISMATCH' | 'DUPLICATE' | 'MISSING_PO' | 'CFDI_FAILURE' | 'OTHER';
  notes?: string;
  attachmentPath?: string;
}
Response: Invoice

// Submit matched invoice to approval workflow
POST /api/invoices/:id/submit-match
Response: Invoice

// Generic state transition (fallback)
POST /api/invoices/:id/transitions
Body: { transition: InvoiceStatus }
Response: Invoice
```

### Invoice Type (TypeScript)

```typescript
interface Invoice {
  id: string;                        // UUID
  invoiceNumber: string;
  supplierName: string;
  supplierId?: string;
  poNumber?: string;
  plantId?: string;
  totalAmount: number | string;
  currency: string;                  // 'USD' | 'CAD' | 'MXN'
  status: InvoiceStatus;
  ingestionChannel?: 'EMAIL' | 'SFTP' | 'PORTAL' | 'MANUAL';
  cfdiValid?: boolean | null;        // null = not applicable (non-Mexico)
  currentApproverId?: string;
  approvalChain?: string[];          // ordered array of approver user IDs
  approvalsCompleted?: ApprovalRecord[];
  rejectionReason?: string;
  pendingApprovalSince?: string;     // ISO datetime
  lastEscalatedAt?: string;         // ISO datetime
  // OCR fields (Track A):
  ocrConfidenceScore?: number;       // 0–100
  requiresReview?: boolean;
  documentType?: 'STANDARD' | 'CFDI';
  invoiceDate?: string;
  subtotal?: number;
  taxAmount?: number;
  lineItems?: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

type InvoiceStatus =
  | 'RECEIVED'
  | 'OCR_PROCESSING'
  | 'PENDING_REVIEW'
  | 'PENDING_MATCH'
  | 'MATCHED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXCEPTION';
```

---

## 9. RBAC & Permission Model

Frontend permissions are enforced in two layers:
1. **Navigation** — `nav-items.ts` filters sidebar items by role
2. **Action buttons** — `lib/permissions.ts` + invoice status + `currentApproverId`

```typescript
// lib/permissions.ts
const PROFILES = {
  AP_CLERK: {
    canCreate: true,
    canEdit: true,       // drives showSubmitReview, showSubmitMatch, showFlagException
    canApprove: false,
    approvalCap: 0,
    tagline: "Review and process invoices assigned to you."
  },
  PLANT_MANAGER: {
    canCreate: false,
    canEdit: false,
    canApprove: true,
    approvalCap: 50_000,  // $50K cap
    tagline: "Approve invoices up to $50,000."
  },
  FINANCE_DIRECTOR: {
    canCreate: false,
    canEdit: true,        // can force transitions
    canApprove: true,
    approvalCap: Infinity, // no cap
    tagline: "Full approval authority. Manage exceptions and escalations."
  }
}
```

### Action Visibility Matrix

| Action | AP Clerk | Plant Manager | Finance Director | Condition |
|--------|----------|--------------|-----------------|-----------|
| Submit for matching | ✅ | ❌ | ✅ | status === PENDING_REVIEW |
| Run match & route | ✅ | ❌ | ✅ | status === PENDING_MATCH |
| Flag exception | ✅ | ❌ | ✅ | status === PENDING_MATCH |
| Approve | ❌ | ✅ (≤$50K) | ✅ | status === PENDING_APPROVAL AND isCurrentApprover |
| Reject | ❌ | ✅ | ✅ | status === PENDING_APPROVAL AND isCurrentApprover |

---

## 10. Implementation Status

### Track A — Dhwaj

| Story | Feature | Status | Notes |
|-------|---------|--------|-------|
| UI-A-01 | Frontend boilerplate & project setup | ✅ Complete | Next.js 16, auth gate, CI/CD, routing |
| UI-A-02 | Command Center Dashboard | ✅ Complete (95%) | Missing: 60s auto-refresh |
| UI-A-03 | Split-screen Document Viewer shell | ❌ Not started | `/documents` is a ModuleScaffold placeholder |
| UI-A-04 | OCR data binding | ❌ Not started | Depends on UI-A-03 + SAS URL endpoint |
| UI-A-05 | Manual editing & validation UI | ❌ Not started | Depends on UI-A-03 & UI-A-04 |

**Track A completion: ~40%**

### Track B — Yash

| Story | Feature | Status | Notes |
|-------|---------|--------|-------|
| UI-B-01 | 3-Way Match Workbench layout | ❌ Not started | `/match` is a ModuleScaffold placeholder |
| UI-B-02 | CMS data integration (GR fetch) | ❌ Not started | Depends on Manav's GR API |
| UI-B-03 | Visual discrepancy highlighting | ❌ Not started | Depends on UI-B-01 & UI-B-02 |
| UI-B-04 | Exception handling UI | ⚠️ Partial | Mutation wired on Invoice Detail; full modal with reason codes + workbench integration pending |
| UI-B-05 | Submit to approval | ⚠️ Partial | Mutation wired on Invoice Detail; workbench integration + confirmation modal pending |

**Track B completion: ~15%**

### Already Implemented (Shared Infrastructure)

These elements were built as part of the project foundation and are available to both tracks:

| Feature | Status |
|---------|--------|
| Authentication (login, JWT, cookies) | ✅ Complete |
| Auth context & `useAuth` hook | ✅ Complete |
| Server-side route gate (`proxy.ts`) | ✅ Complete |
| Role-based navigation (`nav-items.ts`) | ✅ Complete |
| Invoice list page (`/invoices`) | ✅ Complete |
| Invoice detail page (`/invoices/:id`) | ✅ Complete |
| Approval chain visualization | ✅ Complete |
| Lifecycle timeline visualization | ✅ Complete |
| All invoice mutations (submit-review, submit-match, approve, reject, flag-exception) | ✅ Complete |
| OCI Object Storage upload (PDF/image) | ✅ Complete |
| Audit log page (`/audit`) | ⚠️ Partially complete |
| Global search (⌘K) | ✅ Complete |
| Notifications menu | ✅ Complete |

---

## 11. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Initial page load (LCP) | < 2.5 seconds |
| Performance | Dashboard data fetch | < 500ms (95th percentile) |
| Performance | GR data fetch in workbench | < 3 seconds |
| Availability | UI uptime during business hours | 99.5% (06:00–22:00 ET, Mon–Fri) |
| Accessibility | WCAG compliance | Level AA |
| Browser Support | Minimum supported browsers | Chrome 118+, Edge 118+, Safari 17+, Firefox 119+ |
| Responsiveness | Breakpoints | Mobile (320px+), Tablet (768px+), Desktop (1280px+) |
| Security | No tokens in URL params or localStorage in plain text | Token in HttpOnly cookie (`mtr_token`) |
| Security | SAS URLs | Time-limited (15 min), never stored permanently |
| UX | Loading states | Skeleton loaders for all async data, never blank screens |
| UX | Error states | User-friendly error messages with retry options |
| UX | Empty states | Illustrated empty states (not blank pages) |

---

## 12. Acceptance Checklist

### Track A (Dhwaj) — Definition of Done

- [ ] Dashboard auto-refreshes every 60 seconds
- [ ] Document Viewer route exists at `/invoices/:id/review`
- [ ] PDF renders in left panel using SAS URL (zoom in/out, scroll)
- [ ] OCR form fields auto-populated from API response
- [ ] Low-confidence banner shown when `requiresReview: true`
- [ ] CFDI badge shown when `documentType: 'CFDI'`
- [ ] Form validation: dates, amounts, PO format
- [ ] "Save & Proceed" calls `PATCH /api/invoices/:id` and transitions to `PENDING_MATCH`
- [ ] "Flag for Manual Review" requires a comment, routes to exception queue
- [ ] Unsaved changes prompt before navigation
- [ ] All fields tab-navigable
- [ ] Loading skeleton in both panels while data fetches
- [ ] Mobile-responsive (stacked panels on small screens)

### Track B (Yash) — Definition of Done

- [ ] Match Workbench accessible from invoice list for `PENDING_MATCH` invoices
- [ ] Three-column layout: Invoice | PO | Goods Receipt
- [ ] GR data auto-fetched when PO number is confirmed
- [ ] GR 404 handled gracefully ("No GR found — proceed as 2-way match?")
- [ ] Row-level discrepancy highlighting (red = qty overbilled, amber = price variance)
- [ ] Price variance tolerance ±2% applied correctly
- [ ] Header-level alert banner when invoice total > PO total
- [ ] Discrepancy count badge in workbench header
- [ ] "Flag Exception" modal with reason code dropdown and notes
- [ ] Exception flagging calls API, transitions to `EXCEPTION`, shows toast
- [ ] "Submit for Approval" enabled only when 0 discrepancies + all panels loaded
- [ ] Submit confirmation modal shows invoice number, supplier, amount, next approver
- [ ] Submit calls API, transitions to `PENDING_APPROVAL`, shows toast
- [ ] Submit button disabled during API call (no double-submit)
- [ ] CFDI-invalid invoices cannot be submitted (button disabled with tooltip)

---

*Document prepared by Netlink Software Group America | June 2026*  
*For technical questions, contact the project architect.*
