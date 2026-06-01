import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogInput {
  actionType: string;
  invoiceId?: string | null;
  performedBy?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  notes?: string | null;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog) private readonly auditLogModel: typeof AuditLog,
  ) {}

  /**
   * Append-only insert. Never expose update() or destroy() on this model.
   */
  async record(input: AuditLogInput): Promise<AuditLog> {
    const entry = await this.auditLogModel.create({
      actionType: input.actionType,
      invoiceId: input.invoiceId ?? null,
      performedBy: input.performedBy ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      notes: input.notes ?? null,
    } as AuditLog);
    this.logger.debug(
      `Audit: ${input.actionType} by ${input.performedBy ?? 'system'}`,
    );
    return entry;
  }
}
