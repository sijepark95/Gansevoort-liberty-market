# Commercial Multi-Tenant Restaurant Inventory & Kitchen POS Architecture

A comprehensive redesign blueprint for transforming the prototype into an enterprise-grade, multi-tenant B2B SaaS platform engineered for multi-unit restaurant groups, franchises, and commercial hospitality operators.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed selections in Phase 1, the system is designed from the ground up for commercial multi-tenant SaaS operation with outside clients, backed by a relational PostgreSQL double-entry inventory ledger, an offline-first high-speed tablet POS, automated distributor invoice ingestion, and enterprise audit compliance.

- **Scale & Tenancy**: Multi-tenant SaaS with strict `tenant_id` and Row-Level Security (RLS) policies, supporting multi-brand restaurant groups and multi-location hierarchies.
- **Data Integrity Model**: PostgreSQL double-entry inventory ledger (immutable transactions: `inflow`, `consumption`, `waste`, `reconciliation_variance`) replacing mutable quantity counters to guarantee audit compliance and food-cost reconciliation.
- **Offline-First Kitchen POS**: Client-side IndexedDB local cache with vector clock / optimistic sync engine, tactile kitchen-grade numpad/unit interface, and background websocket reconnection.
- **Distributor Ingestion Pipeline**: Dual-track pipeline supporting direct EDI (810/850/856) distributor feeds (Sysco, US Foods, Gordon Food Service) plus AI-assisted optical document parsing with human-in-the-loop review.
- **Security & RBAC**: Fine-grained permission matrices (Organization Owner, District Manager, Store Manager, Executive Chef, Kitchen Prep Cook, External Auditor) backed by cryptographic audit logging.

---

## 1. Overview & Core Concept

### What It Does
The platform is an end-to-end Restaurant Operations & Food-Cost Intelligence Suite. It connects the receiving dock (automated invoice ingestion and supplier price tracking) to the prep line and cold stations (touch-optimized tablet POS for logging ingredient consumption, yield loss, and prep batches) and the back-office (theoretical vs. actual variance analysis, automated purchase orders, and multi-location P&L reporting).

### Target Audience & Personas
1. **Kitchen Staff & Line Cooks**: Need zero-friction, tactile, glove-friendly tablet interfaces to record raw ingredient usage, batch prep, and spoilage in seconds without waiting for network spinners.
2. **Executive Chefs & Kitchen Managers**: Need recipe yield management, live inventory depletion tracking, and real-time alerts when prep costs or vendor contract prices breach variance thresholds.
3. **Multi-Unit Operators & CFOs**: Need multi-location margin visibility, centralized vendor purchasing consolidation, automated invoice approval workflows, and audit-grade financial data exports.
4. **Platform Administrators**: Need self-service tenant onboarding, subscription license billing, SSO integration (SAML/Okta), and tenant usage governance.

### Key Value Delivered
- **Eliminate Food Waste & Shrinkage**: Real-time comparison of Theoretical Usage (based on POS menu sales & recipes) versus Actual Consumption (logged on kitchen tablets and weekly stock counts).
- **Automate Accounts Payable**: Instant digital extraction and item-level matching of distributor delivery receipts, flagging unit-price creep and short shipments before checks are cut.
- **Guaranteed Kitchen Uptime**: Zero POS downtime during peak dinner rush or Wi-Fi dropouts through resilient local offline persistence.

---

## 2. User Experience & Visual Design

Following the strict **SaaS & Enterprise Dashboard Constitution**, the interface avoids generic AI aesthetics, candy pill boxes, and decorative clutter, favoring dense, legible, and tactile interfaces tailored for both the stainless-steel kitchen environment and executive desktop suites.

### Key User Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Reception & Invoicing Flow                                               │
│    Vendor Delivers ──► Scan / EDI Drop ──► Line-Item Auto-Match ──► Approved│
│                                                                             │
│ 2. Prep Line Consumption Flow (Tablet POS)                                  │
│    Station Login (PIN) ──► Category / Item ──► Tactile Numpad ──► Instant ✓ │
│                                                (Offline Queue)              │
│ 3. Nightly Reconciliation & Reporting Flow                                  │
│    Theoretical Depletion ◄── Sales Sync ──► Physical Count ──► Cost Variance│
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Kitchen POS (High-Speed Tablet Workspace)**:
   - High-contrast, large touch targets ($\ge 48\text{px}$) engineered for wet hands and tablet screens.
   - 2-zone workflow: Left catalog grid with instant category filtering; Right active editor with adaptive unit buttons (`lb`, `pc`, `oz`, `case`, `kg`) and numeric keypad.
   - Direct batch addition upon entering quantity or unit, with single-tap cancel/toggle and zero modal dialogs during active kitchen service.
   - Persistent offline status indicator (`Local Active` / `Syncing [n]` / `Synced`) with background sync indicators.

2. **Manager & Operator Console (1440px Desktop SaaS)**:
   - Fixed 260px collapsible workspace navigation sidebar with organization/location switcher.
   - Contextual breadcrumb bar with tenant switcher and role indicator.
   - High-density data tables ($36\text{px}$–$40\text{px}$ rows) with monospace tabular numerals (`font-mono tabular-nums`) for prices, pack sizes, yields, and variance percentages.
   - Clean segmented filter controls for department/status filtering with zero-pill metadata discipline.

### Visual Identity & Theme Tokens
- **Canvas & Surfaces**:
  - Light mode: Pure `#FFFFFF` card surfaces against `#F8FAFC` slate canvas with subtle `1px border-slate-200`.
  - Tablet Dark Mode (Kitchen optimized): Deep carbon `#0B0F17` canvas with `#161F2E` tactile pads to reduce glare under bright kitchen fluorescent lights.
- **Color Discipline (60-30-10)**:
  - 60% Canvas / Neutral slate background.
  - 30% Structural surfaces, hairline borders, and legible typography (`#0F172A`).
  - 10% High-intent accents: Emerald (`#059669`) for positive stock movements, Indigo (`#4F46E5`) for primary actions, Amber (`#D97706`) for cost variances $>3\%$, Crimson (`#DC2626`) for critical stockouts or missing invoices.
- **Typography**:
  - Display / Navigation: `Cabinet Grotesk` or `Plus Jakarta Sans` (bold, tight tracking).
  - Body & UI: `Plus Jakarta Sans` (400 regular, 600 semibold).
  - Numeric & Telemetry: Monospace tabular numerals (`JetBrains Mono` / `tabular-nums`) for all prices, inventory counts, pack multipliers, and timestamps.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Relational PostgreSQL with Double-Entry Ledger vs. Mutable Document DB
- **Chosen Approach**: PostgreSQL with an immutable `inventory_ledger` table. Stock on hand is computed as `SUM(quantity_delta)` or cached via daily snapshot tables.
- **Why**: In inventory management, mutably updating an `in_stock_qty` column leads to race conditions, untraceable shrinkage, and zero auditability when multiple tablets log simultaneously. A ledger records every receiving slip, prep batch, line consumption, and manual count as a balanced journal entry.
- **Alternatives Considered**: Document-based Firestore/MongoDB. While easy to prototype, they struggle with cross-table relational joins, transactional ACID guarantees during reconciliation, and strict foreign key integrity across organizations.

### Decision 2: Multi-Tenancy Isolation Strategy
- **Chosen Approach**: Hybrid Multi-Tenancy — Single shared PostgreSQL database with Tenant-Level Row-Level Security (RLS) enforced at the database session level via `tenant_id`, paired with automated tenant migration pipelines.
- **Why**: Provides optimal operational efficiency and cost scaling for thousands of restaurant clients while guaranteeing strict cryptographic data isolation through PostgreSQL `ENABLE ROW LEVEL SECURITY`.
- **Alternatives Considered**: Database-per-tenant (costly to manage schema migrations across 10,000 tenants) or simple application-level `WHERE tenant_id = ?` (vulnerable to developer query omissions).

### Decision 3: Offline-First Kitchen Architecture
- **Chosen Approach**: Progressive Web App (PWA) with client-side IndexedDB ledger replica and a local write-ahead log (WAL). Operations are committed locally in $<5\text{ms}$ and synced via bi-directional WebSockets/HTTPS with exponential backoff and server-side idempotent keys (`idempotency_key = uuidv4`).
- **Why**: Kitchen internet connections in commercial walk-in freezers or busy basements routinely drop. The cook must never encounter a loading spinner or lost entry.
- **Alternatives Considered**: Online-only REST calls (unacceptable latency and failure rate in kitchen environments).

### Decision 4: Automated Distributor Invoicing Pipeline
- **Chosen Approach**: Asynchronous ingestion worker supporting standard EDI 810 (Electronic Invoice) / 856 (Advance Ship Notice) for enterprise distributors (Sysco, US Foods, Performance Food Group) combined with a fallback OCR / multimodal document parser for local artisan purveyors.
- **Why**: Eliminates manual 10-key data entry by store managers, automatically flags price discrepancies against negotiated contract sheets, and auto-updates ingredient replacement costs.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT VIEWPORT TIER                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│       Desktop SaaS Admin / Manager   │       Kitchen Tablet POS (PWA)       │
│  - Multi-Unit Dashboard & Analytics  │  - Tactile Consumption POS           │
│  - Invoice Ingestion & Price Audit   │  - Offline IndexedDB Local Store     │
│  - Recipe Engineering & Menu Margins │  - Web Worker Background Sync Engine │
└──────────────────┬───────────────────┴──────────────────┬───────────────────┘
                   │ HTTPS / WSS                          │ Offline WAL Sync
                   ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY & AUTH TIER                           │
│  - Reverse Proxy & Edge Rate Limiting (Cloudflare / Cloud Run)              │
│  - Session Token Validation & JWT Claims (`tenant_id`, `role`, `stores`)     │
│  - Tenant Context Middleware (Sets PostgreSQL `SET LOCAL app.current_tenant`)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
┌──────────────────────────────────────┐┌─────────────────────────────────────┐
│        CORE BACKEND SERVICES         ││         BACKGROUND WORKERS          │
│  - Inventory Ledger & Stock Engine   ││  - EDI / Invoicing Parser Worker    │
│  - Recipe Explosion & Variance Svc   ││  - Daily Snapshot Materializer      │
│  - Purchasing & Purchase Order Svc   ││  - Out-of-Stock / Variance Alerter  │
│  - Staff PIN & RBAC Governance Svc   ││  - Nightly Sales POS Ingestion      │
└──────────────────┬───────────────────┘└──────────────────┬──────────────────┘
                   │                                       │
                   ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL DATA PERSISTENCE                         │
│  - Row-Level Security (RLS) Enforced on all Tables (`tenant_id`, `store_id`) │
│  - Immutable `inventory_ledger` with Foreign Key Cascades & Strict Check Con │
│  - Real-time Read-Replica for Analytics & Reporting Queries                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relational Schema Blueprint (PostgreSQL DDL Core)

```sql
-- 1. TENANCY & ACCESS CONTROL
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'commercial_pro',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'America/Los_Angeles',
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'store_manager', 'chef', 'line_cook', 'auditor')),
    pin_hash VARCHAR(255), -- Fast 4-digit tablet unlock
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MASTER CATALOG & INGREDIENT REGISTRY
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Meat, Produce, Dairy, Dry Goods, Beverage
    base_unit VARCHAR(50) NOT NULL, -- lb, oz, kg, g, liter, pc, bunch
    par_level NUMERIC(12, 4) DEFAULT 0,
    reorder_point NUMERIC(12, 4) DEFAULT 0,
    current_cost_per_unit NUMERIC(12, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. IMMUTABLE INVENTORY TRANSACTION LEDGER
CREATE TABLE inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN ('PURCHASE_RECEIPT', 'KITCHEN_CONSUMPTION', 'BATCH_PREP_INPUT', 'BATCH_PREP_OUTPUT', 'WASTE_SPOILAGE', 'COUNT_VARIANCE_ADJUSTMENT')
    ),
    quantity_delta NUMERIC(14, 4) NOT NULL, -- Negative for consumption/waste, positive for receipts
    unit_of_measure VARCHAR(50) NOT NULL,
    normalized_delta NUMERIC(14, 4) NOT NULL, -- Converted strictly to ingredient base_unit
    unit_cost_at_time NUMERIC(12, 4) NOT NULL,
    total_value_delta NUMERIC(14, 4) NOT NULL,
    recorded_by_user_id UUID REFERENCES users(id),
    department VARCHAR(100), -- Prep Kitchen, Sushi Bar, Grill, Bakery
    idempotency_key UUID UNIQUE NOT NULL, -- Prevents duplicate tablet sync entries
    source_reference_id VARCHAR(255), -- Links to invoice_id, pos_shift_id, count_sheet_id
    notes TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DISTRIBUTOR INVOICES & PRICE INTELLIGENCE
CREATE TABLE vendor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    vendor_id VARCHAR(100) NOT NULL, -- Sysco, US Foods, etc.
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    tax NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'DISPUTED', 'PAID')),
    raw_document_url TEXT,
    ingestion_source VARCHAR(50) CHECK (ingestion_source IN ('EDI_FEED', 'OCR_SCAN', 'MANUAL_ENTRY')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Offline Sync Engine Specification
1. **Client Persistence**:
   - The Kitchen Tablet maintains an IndexedDB database `KitchenOpsLocalDB` storing:
     - `cached_catalog`: Active ingredients, units, standard yields, and departments.
     - `pending_ledger_queue`: Unsynced transactions with generated `idempotency_key`, timestamp, cook ID, and department.
2. **Sync Lifecycle**:
   - When online, the background Service Worker broadcasts `pending_ledger_queue` to `POST /api/v1/sync/ledger-batch`.
   - The server wraps the batch in a single database transaction, checks for previously committed `idempotency_key`s, inserts new ledger records, and returns the newly minted server sequence IDs.
   - The tablet marks items as synced and clears them from the local write queue.

### Granular RBAC Permission Matrix

| Role | Kitchen Tablet POS | Recipe Costing | Invoices & Approvals | Count Reconciliation | Multi-Unit Reporting |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Line Cook / Prep** | Log Usage Only | View Only | No Access | Blind Count Entry | No Access |
| **Executive Chef** | Full POS / Adjust | Edit Recipes | View Invoices | Approve Kitchen Counts | Single Store |
| **Store Manager** | Full POS | View Recipes | Approve Invoices | Full Reconcile & Variance | Single Store |
| **District / Ops VP**| Full POS | Global Recipes | Vendor Contract Audit| Cross-Store Audit | Multi-Store Group |
| **External Auditor** | Audit Log View | Audit View | Read-Only Financials | Read Ledger Log | Read-Only Export |

---

## 5. Phased Implementation Roadmap

1. **Phase 1: Multi-Tenant Data Core & Ledger Engine**: Provision PostgreSQL schema with RLS, ledger triggers, and transaction isolation tests.
2. **Phase 2: Offline-First Kitchen POS Client**: Build PWA tablet workspace with IndexedDB queue, tactile numeric pad, zero-delay unit switcher, and automated sync worker.
3. **Phase 3: Automated Invoice & EDI Processing**: Deploy webhook receiver and asynchronous parser worker for distributor invoices with item-matching reconciliation.
4. **Phase 4: Theoretical vs. Actual Variance Engine**: Connect POS sales menu item depletion recipes to raw consumption ledger, calculating daily variance percentages and financial leakage.
5. **Phase 5: Enterprise Multi-Location Console**: Roll out organization management, custom role builder, blind inventory count workflows, and exportable audit trail logs.
