/* eslint-disable no-console */
import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { ApprovalRule } from '../rules-engine/entities/approval-rule.entity';
import { Role } from '../common/enums/role.enum';

dotenv.config();

/**
 * Default approval routing rules per PRD WF-03.
 *
 * These are seeded as a working baseline. When Martinrea provides the
 * canonical DOA (Delegation of Authority) matrix the rows can be
 * updated in-place - no code change required.
 */
const rules = [
  {
    ruleName: 'Tier-1-Small',
    minAmount: null,
    maxAmount: 10_000,
    roleChain: [Role.FINANCE_DIRECTOR],
    priority: 10,
    description: 'Invoice <= $10,000 : single approval by Finance Director',
  },
  {
    ruleName: 'Tier-2-Medium',
    minAmount: 10_000,
    maxAmount: 50_000,
    roleChain: [Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR],
    priority: 20,
    description: 'Invoice $10K-50K : Plant Manager then Finance Director',
  },
  {
    ruleName: 'Tier-3-Large',
    minAmount: 50_000,
    maxAmount: null,
    roleChain: [Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR, Role.VP_FINANCE],
    priority: 30,
    description: 'Invoice > $50K : Plant Manager -> Finance Director -> VP Finance',
  },
];

async function main() {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'martinrea',
    password: process.env.DB_PASSWORD ?? 'martinrea_dev_pwd',
    database: process.env.DB_NAME ?? 'martinrea_ap',
    models: [User, AuditLog, Invoice, ApprovalRule],
    logging: false,
  });

  await sequelize.authenticate();
  await sequelize.sync();

  console.log('Seeding approval rules...\n');
  for (const r of rules) {
    const existing = await ApprovalRule.findOne({ where: { ruleName: r.ruleName } });
    if (existing) {
      await existing.update(r);
      console.log(`~ Updated rule '${r.ruleName}' chain=[${r.roleChain.join(',')}]`);
    } else {
      await ApprovalRule.create({ ...r, isActive: true } as ApprovalRule);
      console.log(`+ Created rule '${r.ruleName}' chain=[${r.roleChain.join(',')}]`);
    }
  }
  console.log('\nDone.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
