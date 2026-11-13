import type { PrismaClient } from '@prisma/client';

/**
 * A raw-SQL stand-in for a generated Prisma model delegate, covering exactly the subset of the
 * Prisma query API that entity-repository uses (findMany/findUnique/count/create/update/delete/
 * deleteMany with Prisma-style `where`/`orderBy`/`skip`/`take`).
 *
 * Why: content-type and component tables can now be created and altered at runtime by the
 * Content-Type Builder, and a generated Prisma client only knows the tables (and columns) that
 * existed when `prisma generate` last ran. Raw SQL works for any table, old or new. Results go
 * through Prisma's raw query path, so values come back typed like model results (numeric →
 * Decimal, timestamp → Date, json → parsed).
 *
 * Identifiers are validated + quoted; every value is a bound parameter.
 */

export type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type OrderBy = Record<string, string> | Record<string, string>[];

export interface SqlModel {
  findMany: (args?: { where?: Where; orderBy?: OrderBy; skip?: number; take?: number }) => Promise<Row[]>;
  findUnique: (args: { where: Where }) => Promise<Row | null>;
  count: (args?: { where?: Where }) => Promise<number>;
  create: (args: { data: Row }) => Promise<Row>;
  update: (args: { where: { id: number }; data: Row }) => Promise<Row>;
  delete: (args: { where: { id: number } }) => Promise<Row>;
  deleteMany: (args: { where: Where }) => Promise<{ count: number }>;
}

type RawClient = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  if (!IDENTIFIER.test(name) || name.length > 63) throw new Error(`Invalid SQL identifier: ${name}`);
  return `"${name}"`;
}

/** Plain objects/arrays are stored as JSON; Dates, Decimals and primitives pass straight through. */
function toParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || value instanceof Date) return value;
  if (typeof value === 'object') {
    // Prisma.Decimal (decimal.js; its class name is minified) — send its exact string form.
    if (typeof (value as { toFixed?: unknown }).toFixed === 'function') return String(value);
    return JSON.stringify(value);
  }
  return value;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

class ParamList {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(toParam(value));
    return `$${this.values.length}`;
  }
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && (value as object).constructor === Object;
}

function buildCondition(column: string, value: unknown, params: ParamList): string {
  const col = quoteIdent(column);
  if (value === null) return `${col} IS NULL`;
  if (!isOperatorObject(value)) return `${col} = ${params.add(value)}`;

  const insensitive = value.mode === 'insensitive';
  const parts: string[] = [];
  for (const [op, operand] of Object.entries(value)) {
    switch (op) {
      case 'mode':
        break;
      case 'equals':
        parts.push(operand === null ? `${col} IS NULL` : `${col} = ${params.add(operand)}`);
        break;
      case 'not':
        if (operand === null) parts.push(`${col} IS NOT NULL`);
        else if (isOperatorObject(operand)) parts.push(`NOT (${buildCondition(column, operand, params)})`);
        else parts.push(`${col} IS DISTINCT FROM ${params.add(operand)}`);
        break;
      case 'in':
      case 'notIn': {
        const list = operand as unknown[];
        if (list.length === 0) {
          parts.push(op === 'in' ? 'FALSE' : 'TRUE');
          break;
        }
        const placeholders = list.map((v) => params.add(v)).join(', ');
        parts.push(op === 'in' ? `${col} IN (${placeholders})` : `${col} NOT IN (${placeholders})`);
        break;
      }
      case 'contains':
      case 'startsWith':
      case 'endsWith': {
        const text = escapeLike(String(operand));
        const pattern = op === 'contains' ? `%${text}%` : op === 'startsWith' ? `${text}%` : `%${text}`;
        parts.push(`${col}::text ${insensitive ? 'ILIKE' : 'LIKE'} ${params.add(pattern)}`);
        break;
      }
      case 'gt':
        parts.push(`${col} > ${params.add(operand)}`);
        break;
      case 'gte':
        parts.push(`${col} >= ${params.add(operand)}`);
        break;
      case 'lt':
        parts.push(`${col} < ${params.add(operand)}`);
        break;
      case 'lte':
        parts.push(`${col} <= ${params.add(operand)}`);
        break;
      default:
        throw new Error(`Unsupported filter operator "${op}" on ${column}`);
    }
  }
  return parts.length ? parts.join(' AND ') : 'TRUE';
}

export function buildWhere(where: Where | undefined, params: ParamList): string {
  if (!where) return 'TRUE';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'AND' || key === 'OR') {
      const items = (Array.isArray(value) ? value : [value]) as Where[];
      if (items.length === 0) {
        parts.push(key === 'AND' ? 'TRUE' : 'FALSE');
        continue;
      }
      parts.push(`(${items.map((w) => `(${buildWhere(w, params)})`).join(key === 'AND' ? ' AND ' : ' OR ')})`);
    } else if (key === 'NOT') {
      const items = (Array.isArray(value) ? value : [value]) as Where[];
      parts.push(items.map((w) => `NOT (${buildWhere(w, params)})`).join(' AND '));
    } else {
      parts.push(buildCondition(key, value, params));
    }
  }
  return parts.length ? parts.join(' AND ') : 'TRUE';
}

function buildOrderBy(orderBy: OrderBy | undefined): string {
  if (!orderBy) return '';
  const entries = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  if (entries.length === 0) return '';
  return ` ORDER BY ${entries.map(([col, dir]) => `${quoteIdent(col)} ${dir === 'desc' ? 'DESC' : 'ASC'}`).join(', ')}`;
}

function dataColumns(data: Row): [string, unknown][] {
  return Object.entries(data).filter(([, v]) => v !== undefined);
}

export function sqlModel(client: RawClient, table: string): SqlModel {
  const t = quoteIdent(table);
  const query = (sql: string, params: ParamList) => client.$queryRawUnsafe<Row[]>(sql, ...params.values);

  return {
    async findMany(args = {}) {
      const params = new ParamList();
      let sql = `SELECT * FROM ${t} WHERE ${buildWhere(args.where, params)}${buildOrderBy(args.orderBy)}`;
      if (args.take != null) sql += ` LIMIT ${Math.max(0, Math.floor(args.take))}`;
      if (args.skip) sql += ` OFFSET ${Math.max(0, Math.floor(args.skip))}`;
      return query(sql, params);
    },
    async findUnique(args) {
      const params = new ParamList();
      const rows = await query(`SELECT * FROM ${t} WHERE ${buildWhere(args.where, params)} LIMIT 1`, params);
      return rows[0] ?? null;
    },
    async count(args = {}) {
      const params = new ParamList();
      const rows = await query(`SELECT count(*) AS c FROM ${t} WHERE ${buildWhere(args.where, params)}`, params);
      return Number(rows[0]?.c ?? 0);
    },
    async create({ data }) {
      const params = new ParamList();
      const cols = dataColumns(data);
      const sql = cols.length
        ? `INSERT INTO ${t} (${cols.map(([c]) => quoteIdent(c)).join(', ')}) VALUES (${cols.map(([, v]) => params.add(v)).join(', ')}) RETURNING *`
        : `INSERT INTO ${t} DEFAULT VALUES RETURNING *`;
      return (await query(sql, params))[0];
    },
    async update({ where, data }) {
      const params = new ParamList();
      const cols = dataColumns(data);
      if (cols.length === 0) {
        const existing = await query(`SELECT * FROM ${t} WHERE ${buildWhere(where, params)} LIMIT 1`, params);
        if (!existing[0]) throw new Error(`No ${table} row matches ${JSON.stringify(where)}`);
        return existing[0];
      }
      const set = cols.map(([c, v]) => `${quoteIdent(c)} = ${params.add(v)}`).join(', ');
      const rows = await query(`UPDATE ${t} SET ${set} WHERE ${buildWhere(where, params)} RETURNING *`, params);
      if (!rows[0]) throw new Error(`No ${table} row matches ${JSON.stringify(where)}`);
      return rows[0];
    },
    async delete({ where }) {
      const params = new ParamList();
      const rows = await query(`DELETE FROM ${t} WHERE ${buildWhere(where, params)} RETURNING *`, params);
      if (!rows[0]) throw new Error(`No ${table} row matches ${JSON.stringify(where)}`);
      return rows[0];
    },
    async deleteMany({ where }) {
      const params = new ParamList();
      const count = await client.$executeRawUnsafe(`DELETE FROM ${t} WHERE ${buildWhere(where, params)}`, ...params.values);
      return { count };
    },
  };
}
