import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { prisma } from '@/lib/db/prisma';
import AuditLogView, { type AuditLogRow } from './AuditLogView';

const PAGE_SIZE = 50;

type SearchParams = {
  module?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;
  if (!session) redirect('/');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    ...(params.module && { module: params.module }),
    ...(params.action && { action: params.action }),
    ...(params.actorId && { actor_id: Number(params.actorId) }),
    ...(params.entityId && {
      OR: [
        { entity_id: { contains: params.entityId, mode: 'insensitive' as const } },
        { entity_label: { contains: params.entityId, mode: 'insensitive' as const } },
      ],
    }),
    ...((params.from || params.to) && {
      created_at: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(`${params.to}T23:59:59.999Z`) }),
      },
    }),
  };

  const [logs, total, modules, actors] = await Promise.all([
    prisma.watchtower_audit_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.watchtower_audit_logs.count({ where }),
    prisma.watchtower_audit_logs.findMany({ distinct: ['module'], select: { module: true }, orderBy: { module: 'asc' } }),
    prisma.watchtower_audit_logs.findMany({
      distinct: ['actor_id'],
      select: { actor_id: true, actor_name: true },
      where: { actor_id: { not: null } },
    }),
  ]);

  return (
    <AuditLogView
      logs={logs as unknown as AuditLogRow[]}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      moduleOptions={modules.map((m) => m.module)}
      actorOptions={actors.map((a) => ({ id: a.actor_id as number, name: a.actor_name ?? `#${a.actor_id}` }))}
      filters={params}
    />
  );
}
