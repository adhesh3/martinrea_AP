import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

/**
 * Permitted state transitions for the invoice lifecycle.
 *
 * PRD WF-02 (Section 4.7) acceptance criterion:
 *   "State machine strictly governs transitions ...
 *    Any transition not in the permitted list returns a 409 Conflict."
 *
 * Happy path (PRD Section 5.2):
 *   RECEIVED -> OCR_PROCESSING -> PENDING_REVIEW -> PENDING_MATCH
 *            -> MATCHED -> PENDING_APPROVAL -> APPROVED
 *
 * Off-ramps:
 *   - EXCEPTION can be raised from PENDING_MATCH (PRD UI-B-04)
 *     and can be resolved either back to PENDING_MATCH or to REJECTED.
 *   - REJECTED returns to PENDING_REVIEW (PRD WF-03) so the clerk can fix
 *     the issue and resubmit through the chain.
 *
 * APPROVED is terminal (a paid voucher cannot re-enter the workflow).
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<InvoiceStatus, ReadonlyArray<InvoiceStatus>>> =
  Object.freeze({
    [InvoiceStatus.RECEIVED]: [InvoiceStatus.OCR_PROCESSING],
    [InvoiceStatus.OCR_PROCESSING]: [
      InvoiceStatus.PENDING_REVIEW,
      InvoiceStatus.EXCEPTION,
    ],
    [InvoiceStatus.PENDING_REVIEW]: [
      InvoiceStatus.PENDING_MATCH,
      InvoiceStatus.EXCEPTION,
    ],
    [InvoiceStatus.PENDING_MATCH]: [
      InvoiceStatus.MATCHED,
      InvoiceStatus.EXCEPTION,
    ],
    [InvoiceStatus.MATCHED]: [InvoiceStatus.PENDING_APPROVAL],
    [InvoiceStatus.PENDING_APPROVAL]: [
      InvoiceStatus.APPROVED,
      InvoiceStatus.REJECTED,
    ],
    [InvoiceStatus.APPROVED]: [],
    [InvoiceStatus.REJECTED]: [InvoiceStatus.PENDING_REVIEW],
    [InvoiceStatus.EXCEPTION]: [
      InvoiceStatus.PENDING_MATCH,
      InvoiceStatus.REJECTED,
    ],
  });

/**
 * Per-transition guards. These run AFTER the transition map check.
 *
 * PRD compliance NFR (Section 5.3):
 *   "Mexico plant invoices must pass SAT validation before matching."
 * PRD INT-04: Non-compliant CFDIs are flagged with cfdi_valid = false.
 *
 * Therefore: an invoice with cfdi_valid === false may not transition to
 * MATCHED. A null cfdi_valid means the invoice is not a CFDI (US plant)
 * and the guard does not apply.
 */
export interface InvoiceGuardContext {
  cfdiValid: boolean | null;
}

export type TransitionGuard = (ctx: InvoiceGuardContext) =>
  | { ok: true }
  | { ok: false; reason: string };

export const TRANSITION_GUARDS: Partial<
  Record<`${InvoiceStatus}->${InvoiceStatus}`, TransitionGuard>
> = {
  [`${InvoiceStatus.PENDING_MATCH}->${InvoiceStatus.MATCHED}`]: (ctx) =>
    ctx.cfdiValid === false
      ? {
          ok: false,
          reason:
            'CFDI validation failed (cfdi_valid=false). SAT compliance required before matching (PRD INT-04).',
        }
      : { ok: true },
};
