# Mock Epicor CMS

In-memory simulator of Martinrea's 44 plant Epicor instances.

## Why this exists

We don't have real Epicor credentials yet — Martinrea hasn't provisioned VPN
access or per-plant ODBC / SFTP creds, and the production AP application is
already due for a Sprint-1 demo. This module fills that gap:

- Holds realistic supplier / PO / GR fixtures in their **native** US and
  Mexico Epicor shapes (the same field names the real ODBC clients will see).
- Simulates per-instance network behaviour — latency, occasional flakiness,
  and one deliberately-slow instance — so the integrations layer can exercise
  its normalisation, error-isolation, and timeout paths against something
  that *behaves* like real Epicor.
- Exposes a tiny read-only HTTP view (`/mock-epicor/*`) so engineers and
  reviewers can inspect the simulated data directly.

When real Epicor lands, the entire `src/mock-epicor/` folder gets deleted.

## Data summary

| Type            | US records      | Mexico records  |
| --------------- | --------------- | --------------- |
| Suppliers       | 25 (21 active)  | 15 (12 active)  |
| Purchase Orders | 40 (30 open)    | 20 (15 open)    |
| Goods Receipts  | 60              | 30              |

All companies and part numbers are realistic for an automotive
metal-stampings manufacturer:

- **Steel & raw metal** — hot-rolled coil, cold-rolled coil, HSLA, stainless,
  aluminium.
- **Tooling & die** — progressive dies, welding fixtures, punch / die-insert
  sets.
- **Lubricants & chemicals** — drawing lubricants, coolants, degreasers,
  rust inhibitors.
- **Packaging** — corrugated cardboard, pallets, returnable steel containers,
  ESD foam.
- **MRO** — fasteners, cutting inserts, band-saw blades, way oil.
- **Forklift parts & PPE** — forks, polyurethane wheels, cut-resistant gloves.
- **Freight** — LTL/FCL line items.

The goods-receipt rows include the realistic mix the matching workbench
needs to test against:

- Fully received (`receivedQty === orderedQty`)
- Partially received (`receivedQty < orderedQty`) — most common
- Slight over-receipt within 2% tolerance
- Multi-line receipts (3-4 lines)
- Multiple receipts per PO (split deliveries)
- Open POs that have **no** receipts yet (ordered but not delivered)

## Simulated behaviours

`MockEpicorService.simulateConnectionDelay(instanceId)` is called by every
sync worker before it pulls data, and emulates these per-instance profiles:

| Instance range | Profile  | Behaviour |
| -------------- | -------- | --------- |
| 1 – 15         | Fast     | 200 – 400 ms |
| 16 – 30        | Medium   | 500 – 900 ms |
| 31 – 38        | Slow     | 1000 – 1500 ms |
| 39 – 44        | Flaky    | ~30 % chance of `CONNECTION_REFUSED`, else ~800 ms |

In addition, `getUSGoodsReceipts` / `getMexicoGoodsReceipts` always sleep
for **2.8 seconds** when `instanceId === 7`. Combined with any other
upstream latency, this reliably trips the 3-second SLA in INT-03 and proves
the timeout handling in `goods-receipts.service.ts`.

## Inspect endpoints (for demo / debugging)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/mock-epicor/suppliers?instance=N&region=US\|MEXICO` | List active suppliers in their native shape. |
| `GET`  | `/mock-epicor/purchase-orders?instance=N&region=US\|MEXICO` | List open POs in their native shape (line items included). |
| `GET`  | `/mock-epicor/goods-receipts?po=PO-2024-00142&instance=N` | List receipts for a PO. Region auto-detected (`OC-…` → MEXICO). |

Every response is wrapped in an envelope that loudly flags it as fake:

```json
{
  "_warning": "MOCK DATA — Not real Epicor CMS. For demo and testing only.",
  "_instance": 1,
  "_region": "US",
  "data": [ ... ]
}
```

## How to replace with real Epicor

1. Inside each integration service that injects `MockEpicorService`, swap
   the call for the real ODBC / SFTP client:
   - `src/integrations/sync/suppliers-sync.service.ts` → `fetchSuppliersFromEpicor`
   - `src/integrations/sync/purchase-orders-sync.service.ts` → `fetchPOsFromEpicor`
   - `src/integrations/goods-receipts/goods-receipts.service.ts` → `fetchFromEpicor`
2. Drop the `simulateConnectionDelay` call from each worker (real network
   latency replaces it naturally).
3. Populate the per-instance creds in `.env`
   (`EPICOR_INSTANCE_<N>_HOST`, `…_USER`, `…_PASSWORD`, `…_DATABASE`,
   `…_PORT`).
4. Remove `MockEpicorModule` from `IntegrationsModule.imports`.
5. Delete the entire `src/mock-epicor/` folder.

## Field-name mapping reference

The integration layer collapses three regional formats onto one canonical
DTO. The mapping table below is the single source of truth.

### Suppliers

| US Epicor       | Mexico Epicor       | Canonical (`SupplierDto`) |
| --------------- | ------------------- | ------------------------- |
| `VendorNum`     | `CodigoProveedor`   | `supplierCode`            |
| `Name`          | `NombreProveedor`   | `supplierName`            |
| `VendorId`      | `RFC`               | `taxId`                   |
| `Country`       | `Pais`              | `country`                 |
| `InActive===false` | `Activo===true` | `status === 'ACTIVE'`     |

### Purchase Orders

| US Epicor      | Mexico Epicor      | Canonical (`PurchaseOrderDto`) |
| -------------- | ------------------ | ------------------------------ |
| `PONum`        | `NumOrden`         | `poNumber`                     |
| `VendorNum`    | `CodigoProveedor`  | `supplierId` (canonicalised)   |
| `OpenOrder===true` | `OrdenAbierta===true` | `status === 'OPEN'`     |
| `LineDesc`     | `Descripcion`      | `lineItems[i].description`     |
| `OrderQty`     | `CantidadPedida`   | `lineItems[i].orderedQty`      |
| `UnitCost`     | `CostoUnitario`    | `lineItems[i].unitPrice`       |
| `UOM`          | `UnidadMedida`     | `lineItems[i].unitOfMeasure`   |
| `Plant`        | `Planta`           | `plantId`                      |
| `CurrencyCode` | `Moneda`           | `currency`                     |

### Goods Receipts

| US Epicor             | Mexico Epicor         | Canonical (`GoodsReceiptDto`)   |
| --------------------- | --------------------- | ------------------------------- |
| `ReceiptNum`          | `NumRecepcion`        | `grNumber`                      |
| `PONum`               | `OrdenCompra`         | `poNumber`                      |
| `ReceiptDate`         | `FechaRecepcion`      | `receivedDate`                  |
| `PartDescription`     | `DescripcionArticulo` | `lineItems[i].description`      |
| `OrderQty`            | `CantidadOrdenada`    | `lineItems[i].orderedQty`       |
| `OurJobReceivedQty`   | `CantidadRecibida`    | `lineItems[i].receivedQty`      |
| `UnitCost`            | `CostoUnitario`       | `lineItems[i].unitPrice`        |
| `Plant`               | `Planta`              | (not on DTO; instance-scoped)   |
