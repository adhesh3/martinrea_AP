import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  RejectInvoiceDto,
  TransitionInvoiceDto,
} from './dto/transition-invoice.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

/**
 * Phase 1 / WF-02 endpoints.
 *
 * - POST   /api/invoices                          create (any authenticated user; system actor in production)
 * - GET    /api/invoices/:id                      fetch
 * - GET    /api/invoices/:id/allowed-transitions  for UI button enablement
 * - POST   /api/invoices/:id/transitions          generic transition (used by tests + ops; FD only)
 * - POST   /api/invoices/:id/submit-review        Aditya UI hook (PENDING_REVIEW -> PENDING_MATCH)
 * - POST   /api/invoices/:id/submit-match         Yash UI hook (PENDING_MATCH  -> MATCHED -> PENDING_APPROVAL)
 *                                                 WF-03 will extend this with routing engine logic.
 * - POST   /api/invoices/:id/approve              approver action (PENDING_APPROVAL -> APPROVED)
 * - POST   /api/invoices/:id/reject               approver action (PENDING_APPROVAL -> REJECTED)
 * - POST   /api/invoices/:id/flag-exception       AP_Clerk action (PENDING_MATCH -> EXCEPTION)
 */
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const invoice = await this.invoices.create(dto, user.id);
    return this.toDto(invoice);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const invoice = await this.invoices.findById(id);
    return this.toDto(invoice);
  }

  @Get(':id/allowed-transitions')
  async allowedTransitions(@Param('id', new ParseUUIDPipe()) id: string) {
    const invoice = await this.invoices.findById(id);
    return {
      id: invoice.id,
      currentStatus: invoice.status,
      allowedTransitions: this.invoices.getAllowedTransitions(invoice.status),
    };
  }

  /**
   * Generic admin / ops transition. Restricted to Finance_Director so
   * arbitrary moves cannot be made by anyone else (this endpoint exists
   * primarily for testing and break-glass scenarios).
   */
  @Post(':id/transitions')
  @Roles(Role.FINANCE_DIRECTOR)
  @HttpCode(HttpStatus.OK)
  async transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.invoices.transition(id, dto.to, {
      performedBy: user.id,
      notes: dto.notes ?? null,
    });
    return this.toDto(updated);
  }

  @Post(':id/submit-review')
  @HttpCode(HttpStatus.OK)
  async submitReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.invoices.transition(
      id,
      InvoiceStatus.PENDING_MATCH,
      { performedBy: user.id, notes: 'OCR review completed by AP Clerk' },
    );
    return this.toDto(updated);
  }

  /**
   * Yash's hook from UI-B-05. Moves PENDING_MATCH -> MATCHED ->
   * PENDING_APPROVAL and uses the WF-03 rules engine to compute the
   * approver chain.
   */
  @Post(':id/submit-match')
  @HttpCode(HttpStatus.OK)
  async submitMatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const queued = await this.invoices.submitMatch(id, user.id);
    return this.toDto(queued);
  }

  @Post(':id/approve')
  @Roles(Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR, Role.VP_FINANCE)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.invoices.approve(id, user.id);
    return {
      ...this.toDto(result.invoice),
      chainComplete: result.chainComplete,
      nextApproverId: result.nextApproverId,
    };
  }

  @Post(':id/reject')
  @Roles(Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR, Role.VP_FINANCE)
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.invoices.reject(id, user.id, dto.reason);
    return this.toDto(updated);
  }

  @Post(':id/flag-exception')
  @HttpCode(HttpStatus.OK)
  async flagException(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.invoices.transition(id, InvoiceStatus.EXCEPTION, {
      performedBy: user.id,
      notes: 'Discrepancy flagged from workbench',
    });
    return this.toDto(updated);
  }

  private toDto(invoice: import('./entities/invoice.entity').Invoice) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplierName: invoice.supplierName,
      supplierId: invoice.supplierId,
      poNumber: invoice.poNumber,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      cfdiValid: invoice.cfdiValid,
      ingestionChannel: invoice.ingestionChannel,
      plantId: invoice.plantId,
      currentApproverId: invoice.currentApproverId,
      approvalChain: invoice.approvalChain,
      approvalsCompleted: invoice.approvalsCompleted,
      rejectionReason: invoice.rejectionReason,
      pendingApprovalSince: invoice.pendingApprovalSince,
      lastEscalatedAt: invoice.lastEscalatedAt,
      createdAt: invoice.get('createdAt'),
      updatedAt: invoice.get('updatedAt'),
    };
  }
}
