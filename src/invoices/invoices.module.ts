import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Invoice } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceStateMachineService } from './state-machine/invoice-state-machine.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Invoice]),
    AuditLogsModule,
    RulesEngineModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceStateMachineService],
  exports: [InvoicesService, InvoiceStateMachineService],
})
export class InvoicesModule {}
