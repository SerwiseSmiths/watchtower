import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

async function getActor(): Promise<{ id: number | null; name: string | null }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
    const session = token ? verifyRootSession(token) : null;
    if (!session) return { id: null, name: null };

    const user = await prisma.admin_users.findUnique({ where: { id: session.adminUserId } });
    const name = user ? `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() || user.email || null : null;
    return { id: session.adminUserId, name };
  } catch {
    return { id: null, name: null };
  }
}

/** Shallow key-by-key diff between two plain objects — only keys that actually changed
 *  (by JSON value) are included, keeping audit entries readable instead of dumping whole
 *  records on every update. */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const oldVal = before?.[key] ?? null;
    const newVal = after?.[key] ?? null;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }
  return changes;
}

export interface LogAuditInput {
  module: string;
  action: AuditAction;
  entityId: string;
  entityLabel?: string | null;
  /** For UPDATE, pass both before/after and let this function diff them. For CREATE, pass
   *  only `after`. For DELETE, pass only `before`. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Escape hatch for state-transition actions with no natural before/after record (e.g.
   *  bypassing a stage) — pass a ready-made changes object instead of before/after. */
  changes?: Record<string, unknown>;
}

/** Writes one row to the global audit log. Never throws — a logging failure must never
 *  block the actual user action; failures are only console-logged. */
export async function logAudit(entry: LogAuditInput): Promise<void> {
  try {
    const actor = await getActor();
    const changes =
      entry.changes ??
      (entry.action === 'UPDATE'
        ? diffFields(entry.before, entry.after)
        : (entry.after ?? entry.before ?? null));

    await prisma.watchtower_audit_logs.create({
      data: {
        module: entry.module,
        action: entry.action,
        entity_id: entry.entityId,
        entity_label: entry.entityLabel ?? null,
        changes: changes as never,
        actor_id: actor.id,
        actor_name: actor.name,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log entry', err);
  }
}
