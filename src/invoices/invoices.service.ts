import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize, Transaction } from 'sequelize';
import { Invoice } from './entities/invoice.entity';
import { InvoiceStateMachineService } from './state-machine/invoice-state-machine.service';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

export interface TransitionOptions {
  performedBy: string;
  notes?: string | null;
  rejectionReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ApproveResult {
  invoice: Invoice;
  chainComplete: boolean;
  nextApproverId: string | null;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice) private readonly invoiceModel: typeof Invoice,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly stateMachine: InvoiceStateMachineService,
    private readonly audit: AuditLogsService,
    private readonly rules: RulesEngineService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  async create(dto: CreateInvoiceDto, performedBy: string): Promise<Invoice> {
    const invoice = await this.sequelize.transaction(async (tx) => {
      const created = await this.invoiceModel.create(
        {
          invoiceNumber: dto.invoiceNumber,
          supplierName: dto.supplierName,
          supplierId: dto.supplierId ?? null,
          poNumber: dto.poNumber ?? null,
          totalAmount: dto.totalAmount,
          currency: dto.currency ?? 'USD',
          cfdiValid: dto.cfdiValid ?? null,
          ingestionChannel: dto.ingestionChannel ?? null,
          plantId: dto.plantId ?? null,
          status: InvoiceStatus.RECEIVED,
        } as Invoice,
        { transaction: tx },
      );

      await this.audit.record({
        actionType: 'INVOICE_CREATED',
        invoiceId: created.id,
        performedBy,
        newValue: { status: created.status, invoiceNumber: created.invoiceNumber },
      });

      return created;
    });

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} created (${invoice.id}) in status ${invoice.status}`,
    );
    return invoice;
  }

  async findById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceModel.findByPk(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return invoice;
  }

  getAllowedTransitions(from: InvoiceStatus): InvoiceStatus[] {
    return this.stateMachine.getAllowedTransitions(from);
  }

  /**
   * Direct state transition (used by ops, tests, and the /transitions
   * endpoint). Does not compute an approval chain; for that use
   * `submitMatch`.
   */
  async transition(
    id: string,
    to: InvoiceStatus,
    opts: TransitionOptions,
  ): Promise<Invoice> {
    return this.sequelize.transaction(async (tx: Transaction) => {
      const invoice = await this.invoiceModel.findByPk(id, {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found`);
      }

      const from = invoice.status;

      this.stateMachine.assertTransition(from, to, {
        cfdiValid: invoice.cfdiValid,
      });

      invoice.status = to;

      if (to === InvoiceStatus.REJECTED) {
        if (!opts.rejectionReason) {
          throw new ConflictException(
            'A rejectionReason is required when moving to REJECTED',
          );
        }
        invoice.rejectionReason = opts.rejectionReason;
      } else if (
        from === InvoiceStatus.REJECTED &&
        to === InvoiceStatus.PENDING_REVIEW
      ) {
        invoice.rejectionReason = null;
      }

      await invoice.save({ transaction: tx });

      await this.audit.record({
        actionType: 'INVOICE_STATE_TRANSITION',
        invoiceId: invoice.id,
        performedBy: opts.performedBy,
        oldValue: { status: from },
        newValue: {
          status: to,
          ...(opts.metadata ?? {}),
          ...(opts.rejectionReason ? { rejectionReason: opts.rejectionReason } : {}),
        },
        notes: opts.notes ?? null,
      });

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} (${invoice.id}): ${from} -> ${to} by ${opts.performedBy}`,
      );

      return invoice;
    });
  }

  /**
   * Yash's UI-B-05 hook. PRD WF-03 routing logic happens here.
   *
   * 1. Transition PENDING_MATCH -> MATCHED.
   * 2. Compute approval chain from Rules_Engine (amount + plantId).
   * 3. Transition MATCHED -> PENDING_APPROVAL and assign currentApproverId.
   * 4. Notify the first approver (WF-04).
   */
  async submitMatch(id: string, performedBy: string): Promise<Invoice> {
    await this.transition(id, InvoiceStatus.MATCHED, {
      performedBy,
      notes: '3-way match completed - no unresolved discrepancies',
    });

    const invoiceForChain = await this.findById(id);
    const chain = await this.rules.computeApprovalChain(
      invoiceForChain.totalAmount,
      invoiceForChain.plantId,
    );

    const updated = await this.sequelize.transaction(async (tx) => {
      const invoice = await this.invoiceModel.findByPk(id, {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found`);
      }

      this.stateMachine.assertTransition(
        invoice.status,
        InvoiceStatus.PENDING_APPROVAL,
        { cfdiValid: invoice.cfdiValid },
      );

      invoice.status = InvoiceStatus.PENDING_APPROVAL;
      invoice.approvalChain = chain.userChain;
      invoice.currentApproverId = chain.userChain[0];
      invoice.approvalsCompleted = [];
      invoice.pendingApprovalSince = new Date();
      invoice.lastEscalatedAt = null;

      await invoice.save({ transaction: tx });

      await this.audit.record({
        actionType: 'INVOICE_STATE_TRANSITION',
        invoiceId: invoice.id,
        performedBy,
        oldValue: { status: InvoiceStatus.MATCHED },
        newValue: {
          status: InvoiceStatus.PENDING_APPROVAL,
          rule: chain.rule.name,
          roleChain: chain.roleChain,
          userChain: chain.userChain,
        },
        notes: `Routed via rule '${chain.rule.name}'`,
      });

      return invoice;
    });

    await this.notifyApprover(updated, /* isEscalation */ false);
    return updated;
  }

  /**
   * Single approval step. Records the current approver's decision and
   * either advances to the next approver in the chain (status stays
   * PENDING_APPROVAL) or transitions the invoice to APPROVED when the
   * chain is exhausted.
   *
   * Per PRD WF-01 + WF-03:
   *   - @Roles guard at the controller blocks AP_Clerk (403).
   *   - This method additionally enforces segregation of duties: only
   *     the user matching invoice.current_approver_id may approve.
   */
  async approve(
    id: string,
    approverId: string,
    notes?: string,
  ): Promise<ApproveResult> {
    const result = await this.sequelize.transaction(async (tx) => {
      const invoice = await this.invoiceModel.findByPk(id, {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found`);
      }
      if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          `Invoice is in status ${invoice.status}, not PENDING_APPROVAL`,
        );
      }
      if (invoice.currentApproverId !== approverId) {
        throw new ForbiddenException(
          'You are not the current required approver for this invoice (segregation of duties).',
        );
      }

      const completed = [...(invoice.approvalsCompleted ?? [])];
      completed.push({
        approverId,
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        notes,
      });

      const chain = invoice.approvalChain ?? [];
      const idx = chain.indexOf(approverId);
      const nextApproverId = idx >= 0 && idx + 1 < chain.length ? chain[idx + 1] : null;
      const chainComplete = nextApproverId === null;

      invoice.approvalsCompleted = completed;
      invoice.currentApproverId = nextApproverId;
      // Restart the SLA window for the next approver in the chain.
      invoice.pendingApprovalSince = chainComplete ? null : new Date();
      invoice.lastEscalatedAt = null;

      if (chainComplete) {
        this.stateMachine.assertTransition(
          invoice.status,
          InvoiceStatus.APPROVED,
          { cfdiValid: invoice.cfdiValid },
        );
        invoice.status = InvoiceStatus.APPROVED;
      }

      await invoice.save({ transaction: tx });

      await this.audit.record({
        actionType: chainComplete
          ? 'INVOICE_STATE_TRANSITION'
          : 'INVOICE_APPROVAL_STEP',
        invoiceId: invoice.id,
        performedBy: approverId,
        oldValue: chainComplete ? { status: InvoiceStatus.PENDING_APPROVAL } : null,
        newValue: chainComplete
          ? { status: InvoiceStatus.APPROVED, approvals: completed }
          : { advancedTo: nextApproverId, approvals: completed },
        notes: notes ?? null,
      });

      return { invoice, chainComplete, nextApproverId };
    });

    if (!result.chainComplete && result.nextApproverId) {
      await this.notifyApprover(result.invoice, /* isEscalation */ false);
    }

    this.logger.log(
      `Invoice ${result.invoice.invoiceNumber}: approval step by ${approverId} - ` +
        (result.chainComplete
          ? 'CHAIN COMPLETE -> APPROVED'
          : `advancing to ${result.nextApproverId}`),
    );

    return result;
  }

  /**
   * Reject - any approver in the chain can short-circuit and reject.
   * Invoice returns to PENDING_REVIEW with the reason recorded (PRD WF-03).
   */
  async reject(id: string, approverId: string, reason: string): Promise<Invoice> {
    const updated = await this.sequelize.transaction(async (tx) => {
      const invoice = await this.invoiceModel.findByPk(id, {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found`);
      }
      if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          `Invoice is in status ${invoice.status}, not PENDING_APPROVAL`,
        );
      }
      if (!(invoice.approvalChain ?? []).includes(approverId)) {
        throw new ForbiddenException(
          'Only an approver in the chain may reject this invoice.',
        );
      }

      const completed = [...(invoice.approvalsCompleted ?? [])];
      completed.push({
        approverId,
        decision: 'REJECTED',
        timestamp: new Date().toISOString(),
        notes: reason,
      });

      this.stateMachine.assertTransition(invoice.status, InvoiceStatus.REJECTED, {
        cfdiValid: invoice.cfdiValid,
      });

      invoice.status = InvoiceStatus.REJECTED;
      invoice.rejectionReason = reason;
      invoice.approvalsCompleted = completed;
      invoice.currentApproverId = null;

      await invoice.save({ transaction: tx });

      await this.audit.record({
        actionType: 'INVOICE_STATE_TRANSITION',
        invoiceId: invoice.id,
        performedBy: approverId,
        oldValue: { status: InvoiceStatus.PENDING_APPROVAL },
        newValue: {
          status: InvoiceStatus.REJECTED,
          rejectionReason: reason,
          rejectedBy: approverId,
        },
        notes: reason,
      });

      return invoice;
    });

    this.logger.log(
      `Invoice ${updated.invoiceNumber} REJECTED by ${approverId}: ${reason}`,
    );
    return updated;
  }

  /**
   * Sends WF-04 notification to invoice.currentApproverId.
   * Used by submitMatch, approve (next step), and the WF-05 escalation cron.
   */
  async notifyApprover(invoice: Invoice, isEscalation: boolean): Promise<void> {
    if (!invoice.currentApproverId) {
      return;
    }
    try {
      const approver = await this.users.findById(invoice.currentApproverId);
      await this.notifications.sendApprovalRequired({
        to: approver.email,
        approverName: approver.fullName,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        invoiceId: invoice.id,
        isEscalation,
      });
    } catch (err) {
      // Email delivery failures should not break the workflow; log and continue.
      this.logger.warn(
        `Failed to notify ${invoice.currentApproverId} for invoice ${invoice.id}: ${(err as Error).message}`,
      );
    }
  }
}
