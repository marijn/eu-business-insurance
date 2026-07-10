import { Sequelize } from 'sequelize';
import { MySqlBackend } from '../src/storage/mysql';
import { createBackend } from '../src/storage';
import { MemoryBackend } from '../src/storage/memory';
import { Invoice } from '../src/types';

function mockedMySql(tables: Record<string, object[]> = {}) {
  const sequelize = new Sequelize('mysql://root@127.0.0.1:1/insurance', { dialect: 'mysql', logging: false });
  const statements: Array<{ sql: string; parameters?: unknown[] }> = [];
  const respond = (sql: string) => (sql.startsWith('SELECT')
    ? tables[/FROM `(\w+)`/.exec(sql)?.[1] ?? ''] ?? []
    : { affectedRows: 1, insertId: 0, warningStatus: 0 });
  const connection = {
    query: ({ sql }: { sql: string }, callback: (error: null, result: unknown) => void) => {
      statements.push({ sql });
      callback(null, respond(sql));
      return { setMaxListeners: () => undefined };
    },
    execute: (sql: string, parameters: unknown[], callback: (error: null, result: unknown) => void) => {
      statements.push({ sql, parameters });
      callback(null, respond(sql));
      return { setMaxListeners: () => undefined };
    },
  };
  jest.spyOn(sequelize.connectionManager, 'getConnection').mockResolvedValue(connection);
  return { backend: new MySqlBackend(sequelize), statements };
}

const invoice: Invoice = {
  id: 'inv_1',
  policy_id: 'pol_1',
  status: 'PAID',
  amount: 119,
  currency: 'EUR',
  due_date: '2026-11-01',
  paid_at: '2026-10-14T09:30:00.000Z',
  items: [{ description: 'Premium', amount: 100, tax_rate: 0.19 }],
  billing_address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
  created_at: '2026-10-14T09:00:00.000Z',
};

describe('MySQL storage', () => {
  it('writes an invoice and replaces its items in one transaction', async () => {
    const { backend, statements } = mockedMySql();

    await backend.put('invoices', 'inv_1', invoice);

    expect(statements.map(({ sql }) => sql.split(' (')[0])).toEqual([
      'START TRANSACTION;',
      'INSERT INTO `invoices`',
      "DELETE FROM `invoice_items` WHERE `invoice_id` = 'inv_1'",
      'INSERT INTO `invoice_items`',
      'COMMIT;',
    ]);
    expect(statements[1].sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(statements[1].parameters).toEqual([
      'inv_1', 'pol_1', 'PAID', 119, 'EUR', '2026-11-01', '2026-10-14 09:30:00.000',
      'Musterstraße 1', 'Berlin', '10115', 'DE', null, null, null, '2026-10-14 09:00:00.000', null,
    ]);
    expect(statements[3].sql).toBe(
      "INSERT INTO `invoice_items` (`invoice_id`,`position`,`description`,`amount`,`tax_rate`) VALUES ('inv_1',0,'Premium',100,0.19);"
    );
  });

  it('reads an invoice and its items back into the API shape', async () => {
    const { backend, statements } = mockedMySql({
      invoices: [{
        id: 'inv_1', policy_id: 'pol_1', status: 'PAID', amount: 119, currency: 'EUR', due_date: '2026-11-01',
        paid_at: new Date('2026-10-14T09:30:00.000Z'), billing_street: 'Musterstraße 1', billing_city: 'Berlin',
        billing_postal_code: '10115', billing_country: 'DE', billing_vat_id: null, pdf_url: null, payment_link: null,
        created_at: new Date('2026-10-14T09:00:00.000Z'), updated_at: null,
      }],
      invoice_items: [{ invoice_id: 'inv_1', position: 0, description: 'Premium', amount: 100, tax_rate: 0.19 }],
    });

    expect(JSON.parse(JSON.stringify(await backend.get('invoices', 'inv_1')))).toStrictEqual(invoice);
    expect(statements[0].sql).toMatch(/^SELECT .* FROM `invoices` AS `invoices` WHERE `invoices`.`id` = 'inv_1';$/);
    expect(statements[1].sql).toBe(
      'SELECT `invoice_id`, `position`, `description`, `amount`, `tax_rate` FROM `invoice_items` AS `invoice_items` ' +
        "WHERE `invoice_items`.`invoice_id` IN ('inv_1') ORDER BY `invoice_items`.`position` ASC;"
    );
  });
});

describe('storage selection', () => {
  it('uses memory by default and MySQL only when asked', async () => {
    expect(createBackend({})).toBeInstanceOf(MemoryBackend);
    expect(createBackend({ STORAGE: 'memory', DATABASE_URL: 'mysql://x' })).toBeInstanceOf(MemoryBackend);
    expect(() => createBackend({ STORAGE: 'mysql' })).toThrow('DATABASE_URL');
    expect(() => createBackend({ STORAGE: 'postgres' })).toThrow('Unknown STORAGE');
    const mysql = createBackend({ STORAGE: 'mysql', DATABASE_URL: 'mysql://root:secret@127.0.0.1:1/x' });
    expect(mysql).toBeInstanceOf(MySqlBackend);
    await mysql.close();
  });
});
