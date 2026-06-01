/* eslint-disable no-console */
import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { ApprovalRule } from '../rules-engine/entities/approval-rule.entity';
import { Role } from '../common/enums/role.enum';

dotenv.config();

/**
 * Demo user hierarchy for WF-01..WF-05 local testing:
 *
 *   VP_Finance (vp@)
 *      ^
 *      | manager
 *   Finance_Director (fd@)
 *      ^
 *      | manager
 *   Plant_Manager   (pm@   - PLT-001)
 *   Plant_Manager   (pm2@  - PLT-002)
 *      ^
 *      | manager
 *   AP_Clerk        (clerk@ - PLT-001)
 *
 * This shape exercises:
 *   - WF-03 multi-step approval routing (PM -> FD -> VP for >$50K)
 *   - WF-05 escalation chain (approver -> their manager)
 */
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

  async function upsert(email: string, fields: Partial<User>) {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await existing.update(fields);
      console.log(`~ Updated ${email} (${fields.role})`);
      return existing;
    }
    const created = await User.create({ email, ...fields } as User);
    console.log(`+ Created ${email} (${fields.role})`);
    return created;
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // Order matters - create top of hierarchy first so manager_id refs resolve.
  const vp = await upsert('vp@martinrea.dev', {
    fullName: 'Demo VP Finance',
    passwordHash,
    role: Role.VP_FINANCE,
    plantId: null,
    managerId: null,
    isActive: true,
  });
  const fd = await upsert('fd@martinrea.dev', {
    fullName: 'Demo Finance Director',
    passwordHash,
    role: Role.FINANCE_DIRECTOR,
    plantId: null,
    managerId: vp.id,
    isActive: true,
  });
  const pm = await upsert('pm@martinrea.dev', {
    fullName: 'Demo Plant Manager (PLT-001)',
    passwordHash,
    role: Role.PLANT_MANAGER,
    plantId: 'PLT-001',
    managerId: fd.id,
    isActive: true,
  });
  await upsert('pm2@martinrea.dev', {
    fullName: 'Demo Plant Manager (PLT-002)',
    passwordHash,
    role: Role.PLANT_MANAGER,
    plantId: 'PLT-002',
    managerId: fd.id,
    isActive: true,
  });
  await upsert('clerk@martinrea.dev', {
    fullName: 'Demo AP Clerk',
    passwordHash,
    role: Role.AP_CLERK,
    plantId: 'PLT-001',
    managerId: pm.id,
    isActive: true,
  });

  console.log('\nAll users seeded. Default password: Password123!');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
