'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getComponent, getContentType } from '@/lib/content-schema/registry';
import type { FieldSchema } from '@/lib/content-schema/types';
import { deleteWebPageAction, saveLoginAction, saveWebPageAction, unpublishWebPageAction } from './actions';
import { LOGIN_UID, WEB_PAGE_UID } from './content-types';
import { ImageField, SaveButton, cellStyle, ctaButtonStyle, fieldLabelStyle, inputStyle, labelStyle, type MediaFile } from './ui';

// Website content (serwise-website): the "Web Page" collection and "Login" single type.
// Rather than a hand-written editor per block (there are 17 web.* components), the form
// is generated from the content-type/component schemas, so new fields show up here as
// soon as they're added to content-schemas/.

type Row = Record<string, unknown>;

export interface WebPageRow extends Row {
  id: number;
  documentId: string;
  title?: string;
  handle?: string;
  isLive: boolean;
}

const panelStyle: CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: 20 };
const nestedStyle: CSSProperties = { border: '1px solid #E5E5E5', borderRadius: 6, background: '#FAFAFA' };
const summaryStyle: CSSProperties = { cursor: 'pointer', padding: '10px 12px', fontSize: 13, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' };
const smallBtn: CSSProperties = { background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#181818' };
const iconBtn: CSSProperties = { ...smallBtn, padding: '2px 8px' };

const humanize = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** Initial value for a new component — scalar defaults from its schema. */
function emptyValueFor(attributes: Record<string, FieldSchema>): Row {
  const result: Row = {};
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind === 'scalar' && field.default !== undefined) result[name] = field.default;
  }
  return result;
}

/** A short label for a block/item header — its first non-empty text field. */
function previewOf(value: Row): string | null {
  for (const key of ['title', 'heading', 'label', 'name', 'eyebrow', 'qrLabel']) {
    const v = value[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ─── Field renderers ─────────────────────────────────────────────────────────

const HEX6 = /^#[0-9a-f]{6}$/i;

function ScalarInput({ field, value, onChange }: { field: Extract<FieldSchema, { kind: 'scalar' }>; value: unknown; onChange: (v: unknown) => void }) {
  if (field.format === 'color') {
    const text = (value as string) ?? '';
    return (
      <div className="d-flex align-items-center" style={{ gap: 8 }}>
        <input
          type="color"
          value={HEX6.test(text) ? text : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: 40, height: 40, padding: 2, border: '1px solid #E5E5E5', borderRadius: 6, background: '#EFEFEF', flexShrink: 0, cursor: 'pointer' }}
        />
        <input type="text" placeholder="#RRGGBB" value={text} onChange={(e) => onChange(e.target.value || null)} style={inputStyle} />
      </div>
    );
  }
  switch (field.type) {
    case 'boolean':
      return (
        <label className="d-flex align-items-center" style={{ gap: 8, ...cellStyle, minHeight: 40 }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {value ? 'Yes' : 'No'}
        </label>
      );
    case 'enumeration':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} style={inputStyle}>
          <option value="">—</option>
          {field.enum?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case 'integer':
    case 'decimal':
      return (
        <input
          type="number"
          step={field.type === 'decimal' ? 0.01 : 1}
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          style={inputStyle}
        />
      );
    case 'text':
      return <textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />;
    default:
      return <input type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
  }
}

function ItemControls({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }} onClick={(e) => e.preventDefault()}>
      <button type="button" style={iconBtn} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">↑</button>
      <button type="button" style={iconBtn} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">↓</button>
      <button type="button" style={{ ...iconBtn, color: '#E53935' }} onClick={onRemove}>Remove</button>
    </div>
  );
}

function Collapsible({ title, subtitle, actions, children, open }: { title: string; subtitle?: string | null; actions?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details style={nestedStyle} open={open}>
      <summary style={summaryStyle}>
        <span className="d-inline-flex align-items-center justify-content-between" style={{ width: 'calc(100% - 20px)', gap: 8, verticalAlign: 'middle' }}>
          <span>
            {title}
            {subtitle && <span style={{ ...labelStyle, fontSize: 11, marginLeft: 8 }}>{subtitle}</span>}
          </span>
          {actions}
        </span>
      </summary>
      <div style={{ padding: '4px 12px 12px' }}>{children}</div>
    </details>
  );
}

function ComponentField({ name, field, value, onChange }: { name: string; field: Extract<FieldSchema, { kind: 'component' }>; value: unknown; onChange: (v: unknown) => void }) {
  const component = getComponent(field.component);

  if (!field.repeatable) {
    const current = value as Row | null | undefined;
    return (
      <Collapsible
        title={humanize(name)}
        subtitle={component.displayName}
        actions={
          current ? (
            <button type="button" style={{ ...iconBtn, color: '#E53935' }} onClick={(e) => { e.preventDefault(); onChange(null); }}>
              Clear
            </button>
          ) : null
        }
      >
        {current ? (
          <AttributesForm attributes={component.attributes} value={current} onChange={onChange} />
        ) : (
          <button type="button" style={smallBtn} onClick={() => onChange(emptyValueFor(component.attributes))}>
            + Set {humanize(name).toLowerCase()}
          </button>
        )}
      </Collapsible>
    );
  }

  const items = (Array.isArray(value) ? value : []) as Row[];
  return (
    <Collapsible title={humanize(name)} subtitle={`${items.length} × ${component.displayName}`}>
      <div className="d-flex flex-column" style={{ gap: 8 }}>
        {items.map((item, i) => (
          <Collapsible
            key={(item.id as number | undefined) ?? `new-${i}`}
            title={`${component.displayName} ${i + 1}`}
            subtitle={previewOf(item)}
            actions={<ItemControls index={i} count={items.length} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />}
          >
            <AttributesForm attributes={component.attributes} value={item} onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))} />
          </Collapsible>
        ))}
        <div>
          <button type="button" style={smallBtn} onClick={() => onChange([...items, emptyValueFor(component.attributes)])}>
            + Add {component.displayName.toLowerCase()}
          </button>
        </div>
      </div>
    </Collapsible>
  );
}

function DynamicZoneField({ field, value, onChange }: { field: Extract<FieldSchema, { kind: 'dynamiczone' }>; value: unknown; onChange: (v: unknown) => void }) {
  const blocks = (Array.isArray(value) ? value : []) as (Row & { __component: string })[];
  const [adding, setAdding] = useState('');

  return (
    <div className="d-flex flex-column" style={{ gap: 8 }}>
      {blocks.length === 0 && <span style={labelStyle}>No sections yet — add one below.</span>}
      {blocks.map((block, i) => {
        const component = getComponent(block.__component);
        return (
          <Collapsible
            // Row ids are per component table, so two block types can share an id
            key={`${block.__component}-${(block.id as number | undefined) ?? `new-${i}`}`}
            title={`${i + 1}. ${component.displayName}`}
            subtitle={previewOf(block) ?? component.description}
            actions={<ItemControls index={i} count={blocks.length} onMove={(to) => onChange(move(blocks, i, to))} onRemove={() => onChange(blocks.filter((_, j) => j !== i))} />}
          >
            <AttributesForm
              attributes={component.attributes}
              value={block}
              onChange={(next) => onChange(blocks.map((b, j) => (j === i ? { ...next, __component: b.__component } : b)))}
            />
          </Collapsible>
        );
      })}
      <div className="d-flex align-items-center" style={{ gap: 8 }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }}>
          <option value="">Add a section…</option>
          {field.components.map((uid) => (
            <option key={uid} value={uid}>
              {getComponent(uid).displayName}
            </option>
          ))}
        </select>
        <button
          type="button"
          style={smallBtn}
          disabled={!adding}
          onClick={() => {
            onChange([...blocks, { __component: adding, ...emptyValueFor(getComponent(adding).attributes) }]);
            setAdding('');
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

/** Every attribute of a schema: simple fields in a grid, then nested groups full-width. */
function AttributesForm({ attributes, value, onChange }: { attributes: Record<string, FieldSchema>; value: Row; onChange: (v: Row) => void }) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  const entries = Object.entries(attributes).filter(([, f]) => f.kind !== 'relation');
  const simple = entries.filter(([, f]) => f.kind === 'scalar' || f.kind === 'media');
  const nested = entries.filter(([, f]) => f.kind === 'component' || f.kind === 'dynamiczone');

  return (
    <div className="d-flex flex-column" style={{ gap: 12, paddingTop: 8 }}>
      {simple.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {simple.map(([name, field]) => {
            const wide = field.kind === 'scalar' && field.type === 'text';
            return (
              <div key={name} style={wide ? { gridColumn: '1 / -1' } : undefined}>
                {field.kind === 'media' ? (
                  <ImageField label={humanize(name)} value={(value[name] as MediaFile | null) ?? null} onChange={(file) => set(name, file)} />
                ) : (
                  <>
                    <div style={fieldLabelStyle}>
                      {humanize(name)}
                      {field.kind === 'scalar' && field.required && <span style={{ color: '#E53935' }}> *</span>}
                    </div>
                    {field.kind === 'scalar' && <ScalarInput field={field} value={value[name]} onChange={(v) => set(name, v)} />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {nested.map(([name, field]) =>
        field.kind === 'dynamiczone' ? (
          <div key={name}>
            <div style={fieldLabelStyle}>{humanize(name)}</div>
            <DynamicZoneField field={field} value={value[name]} onChange={(v) => set(name, v)} />
          </div>
        ) : field.kind === 'component' ? (
          <ComponentField key={name} name={name} field={field} value={value[name]} onChange={(v) => set(name, v)} />
        ) : null,
      )}
    </div>
  );
}

/** Only the schema's own attributes go back to the server (drops id/documentId/timestamps). */
function pickAttributes(attributes: Record<string, FieldSchema>, value: Row): Row {
  const result: Row = {};
  for (const name of Object.keys(attributes)) if (name in value) result[name] = value[name];
  return result;
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <div style={{ fontSize: 12, color: '#E53935', fontWeight: 600 }}>{error}</div> : null;
}

// ─── Web Pages tab ───────────────────────────────────────────────────────────

const NEW_PAGE: Row = { title: '', handle: '', blocks: [] };

function WebPageEditor({ page, onSaved, onDeleted }: { page: WebPageRow | null; onSaved: (id: number) => void; onDeleted: () => void }) {
  const router = useRouter();
  const schema = getContentType(WEB_PAGE_UID);
  const [form, setForm] = useState<Row>(() => page ?? NEW_PAGE);
  const [busy, setBusy] = useState<'save' | 'publish' | 'unpublish' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>, done: string) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const save = (publish: boolean) => {
    if (!String(form.title ?? '').trim() || !String(form.handle ?? '').trim()) {
      setError('Title and handle are required');
      return;
    }
    run(
      publish ? 'publish' : 'save',
      async () => {
        const saved = await saveWebPageAction(page?.id ?? null, pickAttributes(schema.attributes, form), publish);
        onSaved(saved.id);
      },
      publish ? 'Saved and published — live on the website now.' : 'Draft saved. Publish to make it live.',
    );
  };

  return (
    <div style={panelStyle}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{page ? (page.title || page.handle) : 'New page'}</div>
          <div style={labelStyle}>
            {page ? (page.isLive ? 'Published — edits stay in draft until you publish again' : 'Draft — not on the website yet') : 'Handle `home` is the website’s index page'}
          </div>
        </div>
        {page && (
          <div className="d-flex" style={{ gap: 6 }}>
            {page.isLive && (
              <button type="button" style={smallBtn} disabled={!!busy} onClick={() => run('unpublish', () => unpublishWebPageAction(page.id), 'Unpublished — the website falls back to its built-in content.')}>
                {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
              </button>
            )}
            <button
              type="button"
              style={{ ...smallBtn, color: '#E53935' }}
              disabled={!!busy}
              onClick={() => {
                if (!window.confirm(`Delete "${page.title || page.handle}"? This removes the draft and the published version.`)) return;
                run('delete', async () => { await deleteWebPageAction(page.id); onDeleted(); }, 'Deleted.');
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <AttributesForm attributes={schema.attributes} value={form} onChange={setForm} />

      <div className="d-flex flex-column mt-3" style={{ gap: 8 }}>
        <ErrorText error={error} />
        {notice && <div style={{ fontSize: 12, color: '#0C8D6E', fontWeight: 600 }}>{notice}</div>}
        <div className="d-flex" style={{ gap: 8 }}>
          <button type="button" disabled={!!busy} onClick={() => save(false)} className="w-100" style={{ background: '#EFEFEF', color: '#181818', border: '1px solid #E5E5E5', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', opacity: busy ? 0.6 : 1 }}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <SaveButton saving={busy === 'publish'} onClick={() => save(true)} label="Save & publish" />
        </div>
      </div>
    </div>
  );
}

export function WebPagesTab({ pages }: { pages: WebPageRow[] }) {
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(pages[0]?.id ?? null);
  const selected = typeof selectedId === 'number' ? (pages.find((p) => p.id === selectedId) ?? null) : null;

  return (
    <div className="d-flex align-items-start" style={{ gap: 16 }}>
      <div style={{ ...panelStyle, width: 240, flexShrink: 0, padding: 12 }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span style={fieldLabelStyle}>Pages</span>
          <button type="button" style={ctaButtonStyle('#181818')} onClick={() => setSelectedId('new')}>
            + New
          </button>
        </div>
        {pages.length === 0 && <div style={labelStyle}>No pages yet.</div>}
        <div className="d-flex flex-column" style={{ gap: 4 }}>
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="text-start"
              style={{ background: p.id === selectedId ? '#EFEFEF' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px' }}
            >
              <div style={cellStyle}>{p.title || p.handle}</div>
              <div className="d-flex align-items-center" style={{ gap: 6 }}>
                <span style={labelStyle}>/{p.handle}</span>
                <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', background: p.isLive ? '#E2F4EF' : '#EFEFEF', color: p.isLive ? '#0C8D6E' : '#8A8A8A' }}>
                  {p.isLive ? 'LIVE' : 'DRAFT'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {selectedId === null ? (
          <div style={{ ...panelStyle, ...labelStyle }}>Select a page or create a new one.</div>
        ) : (
          // Remount per page (and after each save's refresh) so the form starts from the saved data
          <WebPageEditor
            key={selected ? `${selected.id}-${String(selected.updatedAt ?? '')}` : 'new'}
            page={selected}
            onSaved={(id) => setSelectedId(id)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Login tab ───────────────────────────────────────────────────────────────

export function LoginTab({ login }: { login: Row | null }) {
  const router = useRouter();
  const schema = getContentType(LOGIN_UID);
  const [form, setForm] = useState<Row>(() => login ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveLoginAction(pickAttributes(schema.attributes, form));
      setNotice('Saved — live on the website now.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ ...labelStyle, marginBottom: 8 }}>
        Text and styling for the website’s login drawer. Use {'{phone}'}, {'{seconds}'} and {'{name}'} where shown — they’re filled in live. Empty fields use the website’s built-in text.
      </div>
      <AttributesForm attributes={schema.attributes} value={form} onChange={setForm} />
      <div className="d-flex flex-column mt-3" style={{ gap: 8 }}>
        <ErrorText error={error} />
        {notice && <div style={{ fontSize: 12, color: '#0C8D6E', fontWeight: 600 }}>{notice}</div>}
        <SaveButton saving={saving} onClick={save} />
      </div>
    </div>
  );
}
