import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [SequelizeModule.forFeature([AuditLog])],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
