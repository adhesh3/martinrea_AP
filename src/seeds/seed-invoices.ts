/* eslint-disable no-console */
import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';

dotenv.config();

const sampleInvoices = [
  {
    invoiceNumber: 'INV-2026-001',
    supplierName: 'Acme Steel Co.',
    supplierId: 'SUP-001',
    poNumber: 'PO-1001',
    totalAmount: 5_400.0,
    currency: 'USD',
    cfdiValid: null,
    ingestionChannel: 'EMAIL',
    plantId: 'PLT-001',
    status: InvoiceStatus.PENDING_REVIEW,
  },
  {
    invoiceNumber: 'INV-2026-002',
    supplierName: 'Northbridge Castings',
    supplierId: 'SUP-002',
    poNumber: 'PO-1002',
    totalAmount: 12_750.5,
    currency: 'USD',
    cfdiValid: null,
    ingestionChannel: 'SFTP',
    plantId: 'PLT-001',
    status: InvoiceStatus.PENDING_MATCH,
  },
  {
    invoiceNumber: 'INV-2026-003',
    supplierName: 'Industrias Saltillo S.A.',
    supplierId: 'SUP-MX-003',
    poNumber: 'PO-MX-1003',
    totalAmount: 8_900.0,
    currency: 'MXN',
    cfdiValid: false,
    ingestionChannel: 'PORTAL',
    plantId: 'PLT-MX-001',
    status: InvoiceStatus.PENDING_MATCH,
  },
  {
    invoiceNumber: 'INV-2026-004',
    supplierName: 'Brightway Tooling Inc.',
    supplierId: 'SUP-004',
    poNumber: 'PO-1004',
    totalAmount: 62_300.0,
    currency: 'USD',
    cfdiValid: null,
    ingestionChannel: 'EMAIL',
    plantId: 'PLT-002',
    status: InvoiceStatus.PENDING_APPROVAL,
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
    models: [User, AuditLog, Invoice],
    logging: false,
  });

  await sequelize.authenticate();
  await sequelize.sync();

  console.log('Seeding sample invoices...\n');
  for (const inv of sampleInvoices) {
    const existing = await Invoice.findOne({
      where: { invoiceNumber: inv.invoiceNumber },
    });
    if (existing) {
      console.log(`- Skipping ${inv.invoiceNumber} (already exists)`);
      continue;
    }
    const created = await Invoice.create(inv as Invoice);
    console.log(
      `+ Created ${created.invoiceNumber} (${created.status}) - $${created.totalAmount} ${created.currency} - id=${created.id}`,
    );
  }

  console.log('\nDone.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
