import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { ApprovalRule } from '../rules-engine/entities/approval-rule.entity';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.username'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        models: [User, AuditLog, Invoice, ApprovalRule],
        autoLoadModels: true,
        // synchronize() is fine for local dev; production schema is owned
        // by Roshni's Flyway migrations (DAT-01) and this must be false.
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: console.log,
      }),
    }),
  ],
})
export class DatabaseModule {}
