import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/**
 * WF-05 - SLA escalation cron.
 *
 * Runs hourly (configurable via ESCALATION_CRON). Finds invoices stuck in
 * PENDING_APPROVAL longer than SLA_PENDING_APPROVAL_HOURS (default 48 per
 * PRD WF-05) and:
 *   1. Sends an escalation email to the current approver's manager.
 *   2. Logs an SLA_BREACH event to Audit_Logs.
 *   3. Stamps last_escalated_at so the next cron tick doesn't re-send
 *      until another full SLA window passes.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectModel(Invoice) private readonly invoiceModel: typeof Invoice,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'sla-escalation' })
  async runHourly(): Promise<void> {
    await this.runOnce();
  }

  /** Public so tests and ops endpoints can invoke a single pass. */
  async runOnce(): Promise<{ checked: number; escalated: number }> {
    const slaHours =
      this.config.get<number>('workflow.slaPendingApprovalHours') ?? 48;
    const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);

    const breached = await this.invoiceModel.findAll({
      where: {
        status: InvoiceStatus.PENDING_APPROVAL,
        pendingApprovalSince: { [Op.lt]: cutoff },
        [Op.or]: [
          { lastEscalatedAt: null },
          { lastEscalatedAt: { [Op.lt]: cutoff } },
        ],
      },
    });

    this.logger.log(
      `SLA cron: cutoff=${cutoff.toISOString()} candidates=${breached.length}`,
    );

    let escalated = 0;
    for (const invoice of breached) {
      try {
        await this.escalateOne(invoice, slaHours);
        escalated++;
      } catch (err) {
        this.logger.error(
          `Escalation failed for invoice ${invoice.id}: ${(err as Error).message}`,
        );
      }
    }

    return { checked: breached.length, escalated };
  }

  private async escalateOne(invoice: Invoice, slaHours: number): Promise<void> {
    if (!invoice.currentApproverId) {
      return;
    }
    const approver = await this.users.findById(invoice.currentApproverId);
    const managerId = approver.managerId;

    // Always re-notify the current approver, and CC their manager when one exists.
    await this.notifications.sendApprovalRequired({
      to: approver.email,
      approverName: approver.fullName,
      invoiceNumber: invoice.invoiceNumber,
      supplierName: invoice.supplierName,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      invoiceId: invoice.id,
      isEscalation: true,
    });

    if (managerId) {
      const manager = await this.users.findById(managerId);
      await this.notifications.sendApprovalRequired({
        to: manager.email,
        approverName: manager.fullName,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        invoiceId: invoice.id,
        isEscalation: true,
      });
    }

    invoice.lastEscalatedAt = new Date();
    await invoice.save();

    await this.audit.record({
      actionType: 'SLA_BREACH',
      invoiceId: invoice.id,
      performedBy: null,
      newValue: {
        slaHours,
        approverId: approver.id,
        approverEmail: approver.email,
        escalatedTo: managerId,
        pendingApprovalSince: invoice.pendingApprovalSince?.toISOString() ?? null,
      },
      notes: 'SLA escalation email dispatched',
    });

    this.logger.log(
      `SLA_BREACH: invoice ${invoice.invoiceNumber} escalated to manager ${managerId ?? '(no manager)'}`,
    );
  }
}
