import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

/**
 * Invoice - workflow-service local view.
 *
 * The canonical Invoices schema is owned by Roshni (DAT-01). This entity
 * defines only the columns the workflow track needs to drive the state
 * machine, audit log, and approval routing. When Roshni publishes the
 * unified Flyway migration this entity must be reconciled with it.
 *
 * Columns directly tied to PRD requirements:
 *   - status              -> PRD Section 5.2 invoice lifecycle
 *   - cfdi_valid          -> PRD INT-04 (guards transition to MATCHED)
 *   - approval_chain      -> PRD WF-03 (sequential routing - JSONB)
 *   - approvals_completed -> PRD WF-03 (history of approver actions)
 *   - current_approver_id -> PRD WF-03 / WF-05 (used by SLA escalation)
 */
@Table({
  tableName: 'invoices',
  timestamps: true,
  paranoid: true,
  underscored: true,
})
export class Invoice extends Model<Invoice> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare invoiceNumber: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare supplierName: string;

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare supplierId: string | null;

  @Column({ type: DataType.STRING(60), allowNull: true })
  declare poNumber: string | null;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    get(this: Invoice): number {
      const raw = this.getDataValue('totalAmount');
      return raw === null || raw === undefined
        ? 0
        : parseFloat(raw as unknown as string);
    },
  })
  declare totalAmount: number;

  @Column({ type: DataType.STRING(3), allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Default(InvoiceStatus.RECEIVED)
  @Column({
    type: DataType.ENUM(...Object.values(InvoiceStatus)),
    allowNull: false,
  })
  declare status: InvoiceStatus;

  @Column({ type: DataType.BOOLEAN, allowNull: true })
  declare cfdiValid: boolean | null;

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare ingestionChannel: string | null;

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare plantId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare currentApproverId: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare approvalChain: string[] | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare approvalsCompleted: Array<{
    approverId: string;
    decision: 'APPROVED' | 'REJECTED';
    timestamp: string;
    notes?: string;
  }> | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  declare rejectionReason: string | null;

  /**
   * Set by WF-05 escalation cron each time the invoice is escalated.
   * Prevents duplicate escalation emails on subsequent cron ticks.
   */
  @Column({ type: DataType.DATE, allowNull: true })
  declare lastEscalatedAt: Date | null;

  /** When the invoice entered PENDING_APPROVAL (for SLA windowing). */
  @Column({ type: DataType.DATE, allowNull: true })
  declare pendingApprovalSince: Date | null;
}
