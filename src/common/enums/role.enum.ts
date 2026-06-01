/**
 * Phase 1 roles per PRD Section 4.7 (WF-01).
 *
 * AP_Clerk           - Creates and edits invoices; CANNOT approve.
 * Plant_Manager      - Can approve invoices with total <= $50,000.
 * Finance_Director   - Can approve invoices of any amount.
 *
 * VP_Finance is reserved as a future extension point per PRD WF-03
 * (invoices > $50K route PM -> FD -> VP_Finance). Defined here so the
 * Rules Engine can reference it once the org hierarchy is finalised.
 */
export enum Role {
  AP_CLERK = 'AP_Clerk',
  PLANT_MANAGER = 'Plant_Manager',
  FINANCE_DIRECTOR = 'Finance_Director',
  VP_FINANCE = 'VP_Finance',
}

export const APPROVER_ROLES: ReadonlyArray<Role> = [
  Role.PLANT_MANAGER,
  Role.FINANCE_DIRECTOR,
  Role.VP_FINANCE,
];

export const PLANT_MANAGER_LIMIT_USD = 50_000;
