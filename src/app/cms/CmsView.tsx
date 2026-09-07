'use client';

import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';
import {
  saveBottomTabAction,
  saveComplaintPageAction,
  saveGlobalConfigAction,
  saveWelcomeBonusAction,
  createPageAction,
  updatePageAction,
  deletePageAction,
  uploadCmsImageAction,
} from './actions';

// ─── Shared primitives (same conventions as pricing/PricingView.tsx, device-types) ────

export interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
}

export interface DeviceTypeOption {
  id: number;
  name: string;
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '11px',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  color: '#000000',
  outline: 'none',
};
const fieldLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#454545', marginBottom: 4 };
const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

function ctaButtonStyle(color: string): CSSProperties {
  return { background: color, color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '-0.03em' };
}

function ImageField({ label, value, onChange }: { label: string; value: MediaFile | null; onChange: (file: MediaFile | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const uploaded = await uploadCmsImageAction(formData);
      onChange(uploaded);
    } catch {
      setError('Upload failed — please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div className="d-flex align-items-center" style={{ gap: 10 }}>
        <div className="d-flex align-items-center justify-content-center" style={{ width: 56, height: 56, borderRadius: 6, background: '#EFEFEF', border: '1px solid #E5E5E5', overflow: 'hidden', flexShrink: 0 }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={value.name ?? label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 9, fontWeight: 600, color: '#B7B7B7' }}>None</span>
          )}
        </div>
        <div className="d-flex flex-column" style={{ gap: 4 }}>
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 11, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} style={{ background: 'transparent', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600, padding: 0, textAlign: 'left' }}>
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {error && <div style={{ fontSize: 10, color: '#FF5E5E', fontWeight: 600, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function RelationChecklist({ label, options, selectedIds, onChange }: { label: string; options: DeviceTypeOption[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div className="d-flex flex-column" style={{ maxHeight: 120, overflowY: 'auto', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: 8, gap: 4 }}>
        {options.length === 0 && <span style={{ fontSize: 11, color: '#B7B7B7' }}>None available.</span>}
        {options.map((option) => (
          <label key={option.id} className="d-flex align-items-center" style={{ gap: 6, fontSize: 12, color: '#000' }}>
            <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} />
            {option.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={saving} className="w-100" style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', opacity: saving ? 0.6 : 1 }}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  );
}

function RepeaterHeader({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-2">
      <span style={fieldLabelStyle}>{label}</span>
      <button type="button" onClick={onAdd} style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#181818' }}>
        {addLabel}
      </button>
    </div>
  );
}

function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 12, fontWeight: 600 }}>
      Remove
    </button>
  );
}

// ─── Bottom Tab ─────────────────────────────────────────────────────────────

interface TabItem {
  key: string;
  label: string;
  redirectUrl: string;
  inactiveIcon: MediaFile | null;
  activeIcon: MediaFile | null;
  activeBgColor: string;
  inactiveBgColor: string;
}

const EMPTY_TAB_ITEM: TabItem = { key: '', label: '', redirectUrl: '', inactiveIcon: null, activeIcon: null, activeBgColor: '', inactiveBgColor: '' };

function BottomTabTab({ bottomTab }: { bottomTab: { tabs?: (Partial<TabItem> & { inactiveIcon?: MediaFile | null; activeIcon?: MediaFile | null })[] } | null }) {
  const router = useRouter();
  const [tabs, setTabs] = useState<TabItem[]>(
    (bottomTab?.tabs ?? []).map((t) => ({ ...EMPTY_TAB_ITEM, ...t })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<TabItem>) {
    setTabs((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    setTabs((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setTabs((prev) => [...prev, { ...EMPTY_TAB_ITEM }]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveBottomTabAction({
        tabs: tabs.map((t) => ({
          key: t.key,
          label: t.label,
          redirectUrl: t.redirectUrl || undefined,
          inactiveIcon: t.inactiveIcon?.id ?? null,
          activeIcon: t.activeIcon?.id ?? null,
          activeBgColor: t.activeBgColor || undefined,
          inactiveBgColor: t.inactiveBgColor || undefined,
        })),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 5, padding: 20, maxWidth: 800 }}>
      <RepeaterHeader label="Tabs (key must match: home | circles | wallet | settings)" onAdd={add} addLabel="+ Add Tab" />
      <div className="d-flex flex-column" style={{ gap: 12 }}>
        {tabs.map((tab, i) => (
          <div key={i} style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12 }}>
            <div className="row g-2 mb-2">
              <div className="col-3">
                <div style={fieldLabelStyle}>Key</div>
                <input type="text" value={tab.key} onChange={(e) => update(i, { key: e.target.value })} style={inputStyle} placeholder="home" />
              </div>
              <div className="col-3">
                <div style={fieldLabelStyle}>Label</div>
                <input type="text" value={tab.label} onChange={(e) => update(i, { label: e.target.value })} style={inputStyle} />
              </div>
              <div className="col-4">
                <div style={fieldLabelStyle}>Redirect URL</div>
                <input type="text" value={tab.redirectUrl} onChange={(e) => update(i, { redirectUrl: e.target.value })} style={inputStyle} />
              </div>
              <div className="col-2 d-flex align-items-end justify-content-end" style={{ paddingBottom: 8 }}>
                <RemoveRowButton onClick={() => remove(i)} />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-3">
                <ImageField label="Inactive Icon" value={tab.inactiveIcon} onChange={(v) => update(i, { inactiveIcon: v })} />
              </div>
              <div className="col-3">
                <ImageField label="Active Icon" value={tab.activeIcon} onChange={(v) => update(i, { activeIcon: v })} />
              </div>
              <div className="col-3">
                <div style={fieldLabelStyle}>Active BG Color</div>
                <input type="text" value={tab.activeBgColor} onChange={(e) => update(i, { activeBgColor: e.target.value })} style={inputStyle} placeholder="#181818" />
              </div>
              <div className="col-3">
                <div style={fieldLabelStyle}>Inactive BG Color</div>
                <input type="text" value={tab.inactiveBgColor} onChange={(e) => update(i, { inactiveBgColor: e.target.value })} style={inputStyle} placeholder="#F2F2F2" />
              </div>
            </div>
          </div>
        ))}
        {tabs.length === 0 && <div style={{ ...labelStyle, padding: 10 }}>No tabs yet.</div>}
      </div>

      {error && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
      <div className="mt-3"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ─── Complaint Page ─────────────────────────────────────────────────────────

const AD_SIZES = ['BANNER', 'LARGE_BANNER', 'MEDIUM_RECTANGLE', 'ADAPTIVE_BANNER'];
const RESOLUTION_STAGE_KEYS = ['assigning', 'entrance', 'estimating', 'approval', 'payment', 'completed'];

interface AdvertisementForm {
  enableAdMob: boolean;
  adMobAdUnitId: string;
  adMobAdSize: string;
  fallbackImage: MediaFile | null;
  fallbackTargetUrl: string;
  fallbackImpressionUrl: string;
}
const EMPTY_AD: AdvertisementForm = { enableAdMob: false, adMobAdUnitId: '', adMobAdSize: 'BANNER', fallbackImage: null, fallbackTargetUrl: '', fallbackImpressionUrl: '' };

function AdvertisementEditor({ value, onChange }: { value: AdvertisementForm; onChange: (v: AdvertisementForm) => void }) {
  return (
    <div style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12 }}>
      <div style={fieldLabelStyle}>Advertisement</div>
      <div className="row g-2 mb-2">
        <div className="col-4">
          <label className="d-flex align-items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: '#000', marginTop: 20 }}>
            <input type="checkbox" checked={value.enableAdMob} onChange={(e) => onChange({ ...value, enableAdMob: e.target.checked })} />
            Enable AdMob
          </label>
        </div>
        <div className="col-4">
          <div style={fieldLabelStyle}>AdMob Ad Unit ID</div>
          <input type="text" value={value.adMobAdUnitId} onChange={(e) => onChange({ ...value, adMobAdUnitId: e.target.value })} style={inputStyle} />
        </div>
        <div className="col-4">
          <div style={fieldLabelStyle}>AdMob Ad Size</div>
          <select value={value.adMobAdSize} onChange={(e) => onChange({ ...value, adMobAdSize: e.target.value })} style={inputStyle}>
            {AD_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="row g-2">
        <div className="col-4">
          <ImageField label="Fallback Image" value={value.fallbackImage} onChange={(v) => onChange({ ...value, fallbackImage: v })} />
        </div>
        <div className="col-4">
          <div style={fieldLabelStyle}>Fallback Target URL</div>
          <input type="text" value={value.fallbackTargetUrl} onChange={(e) => onChange({ ...value, fallbackTargetUrl: e.target.value })} style={inputStyle} />
        </div>
        <div className="col-4">
          <div style={fieldLabelStyle}>Fallback Impression URL</div>
          <input type="text" value={value.fallbackImpressionUrl} onChange={(e) => onChange({ ...value, fallbackImpressionUrl: e.target.value })} style={inputStyle} />
        </div>
      </div>
    </div>
  );
}

interface ResolutionStep { stageKey: string; title: string; description: string; image: MediaFile | null }
const EMPTY_STEP: ResolutionStep = { stageKey: RESOLUTION_STAGE_KEYS[0], title: '', description: '', image: null };
interface InfoBlock { title: string; body: string }
const EMPTY_INFO_BLOCK: InfoBlock = { title: '', body: '' };

function ComplaintPageTab({
  complaintPage,
}: {
  complaintPage: { advertisement?: Partial<AdvertisementForm> | null; resolutionSteps?: Partial<ResolutionStep>[]; infoBlocks?: Partial<InfoBlock>[] } | null;
}) {
  const router = useRouter();
  const [advertisement, setAdvertisement] = useState<AdvertisementForm>({ ...EMPTY_AD, ...(complaintPage?.advertisement ?? {}) });
  const [steps, setSteps] = useState<ResolutionStep[]>((complaintPage?.resolutionSteps ?? []).map((s) => ({ ...EMPTY_STEP, ...s })));
  const [infoBlocks, setInfoBlocks] = useState<InfoBlock[]>((complaintPage?.infoBlocks ?? []).map((b) => ({ ...EMPTY_INFO_BLOCK, ...b })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveComplaintPageAction({
        advertisement: {
          enableAdMob: advertisement.enableAdMob,
          adMobAdUnitId: advertisement.adMobAdUnitId || undefined,
          adMobAdSize: advertisement.adMobAdSize,
          fallbackImage: advertisement.fallbackImage?.id ?? null,
          fallbackTargetUrl: advertisement.fallbackTargetUrl || undefined,
          fallbackImpressionUrl: advertisement.fallbackImpressionUrl || undefined,
        },
        resolutionSteps: steps.map((s) => ({ stageKey: s.stageKey, title: s.title, description: s.description, image: s.image?.id ?? null })),
        infoBlocks: infoBlocks.map((b) => ({ title: b.title, body: b.body })),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 5, padding: 20, maxWidth: 800 }}>
      <div className="mb-4"><AdvertisementEditor value={advertisement} onChange={setAdvertisement} /></div>

      <RepeaterHeader label="Resolution Steps" onAdd={() => setSteps((p) => [...p, { ...EMPTY_STEP }])} addLabel="+ Add Step" />
      <div className="d-flex flex-column mb-4" style={{ gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12 }}>
            <div className="row g-2 mb-2">
              <div className="col-3">
                <div style={fieldLabelStyle}>Stage Key</div>
                <select value={s.stageKey} onChange={(e) => setSteps((p) => p.map((x, idx) => idx === i ? { ...x, stageKey: e.target.value } : x))} style={inputStyle}>
                  {RESOLUTION_STAGE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="col-4">
                <div style={fieldLabelStyle}>Title</div>
                <input type="text" value={s.title} onChange={(e) => setSteps((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} style={inputStyle} />
              </div>
              <div className="col-4">
                <div style={fieldLabelStyle}>Description</div>
                <input type="text" value={s.description} onChange={(e) => setSteps((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} style={inputStyle} />
              </div>
              <div className="col-1 d-flex align-items-end justify-content-end" style={{ paddingBottom: 8 }}>
                <RemoveRowButton onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))} />
              </div>
            </div>
            <ImageField label="Image" value={s.image} onChange={(v) => setSteps((p) => p.map((x, idx) => idx === i ? { ...x, image: v } : x))} />
          </div>
        ))}
        {steps.length === 0 && <div style={{ ...labelStyle, padding: 10 }}>No resolution steps yet.</div>}
      </div>

      <RepeaterHeader label="Info Blocks" onAdd={() => setInfoBlocks((p) => [...p, { ...EMPTY_INFO_BLOCK }])} addLabel="+ Add Info Block" />
      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {infoBlocks.map((b, i) => (
          <div key={i} className="row g-2 align-items-center" style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12, margin: 0 }}>
            <div className="col-4">
              <div style={fieldLabelStyle}>Title</div>
              <input type="text" value={b.title} onChange={(e) => setInfoBlocks((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} style={inputStyle} />
            </div>
            <div className="col-7">
              <div style={fieldLabelStyle}>Body</div>
              <input type="text" value={b.body} onChange={(e) => setInfoBlocks((p) => p.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))} style={inputStyle} />
            </div>
            <div className="col-1 d-flex justify-content-end">
              <RemoveRowButton onClick={() => setInfoBlocks((p) => p.filter((_, idx) => idx !== i))} />
            </div>
          </div>
        ))}
        {infoBlocks.length === 0 && <div style={{ ...labelStyle, padding: 10 }}>No info blocks yet.</div>}
      </div>

      {error && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
      <div className="mt-3"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ─── Global Config ──────────────────────────────────────────────────────────

interface ConfigEntry { key: string; value: string }

function GlobalConfigTab({ globalConfig }: { globalConfig: { entries?: ConfigEntry[] } | null }) {
  const router = useRouter();
  const [entries, setEntries] = useState<ConfigEntry[]>(globalConfig?.entries ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveGlobalConfigAction({ entries: entries.map((e) => ({ key: e.key, value: e.value })) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 5, padding: 20, maxWidth: 700 }}>
      <RepeaterHeader label="Entries" onAdd={() => setEntries((p) => [...p, { key: '', value: '' }])} addLabel="+ Add Entry" />
      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {entries.map((entry, i) => (
          <div key={i} className="row g-2 align-items-center" style={{ margin: 0 }}>
            <div className="col-5">
              <input type="text" value={entry.key} onChange={(e) => setEntries((p) => p.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))} style={inputStyle} placeholder="REFERRAL_REWARD_AMOUNT" />
            </div>
            <div className="col-6">
              <input type="text" value={entry.value} onChange={(e) => setEntries((p) => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} style={inputStyle} placeholder="100" />
            </div>
            <div className="col-1 d-flex justify-content-end">
              <RemoveRowButton onClick={() => setEntries((p) => p.filter((_, idx) => idx !== i))} />
            </div>
          </div>
        ))}
        {entries.length === 0 && <div style={{ ...labelStyle, padding: 10 }}>No config entries yet.</div>}
      </div>

      {error && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
      <div className="mt-3"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ─── Welcome Bonus ──────────────────────────────────────────────────────────

function WelcomeBonusTab({ welcomeBonus }: { welcomeBonus: { image?: MediaFile | null; amount?: number; isEnabled?: boolean } | null }) {
  const router = useRouter();
  const [image, setImage] = useState<MediaFile | null>(welcomeBonus?.image ?? null);
  const [amount, setAmount] = useState<number>(welcomeBonus?.amount ?? 0);
  const [isEnabled, setIsEnabled] = useState<boolean>(welcomeBonus?.isEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveWelcomeBonusAction({ image: image?.id ?? null, amount, isEnabled });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 5, padding: 20, maxWidth: 500 }}>
      <div className="d-flex flex-column" style={{ gap: 14 }}>
        <label className="d-flex align-items-center" style={{ gap: 8, fontSize: 13, fontWeight: 600, color: '#000' }}>
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
          Enabled
        </label>
        <div>
          <div style={fieldLabelStyle}>Amount</div>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={inputStyle} />
        </div>
        <ImageField label="Image" value={image} onChange={setImage} />
      </div>

      {error && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
      <div className="mt-3"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ─── Pages (dynamic zone) ───────────────────────────────────────────────────

type BlockType = 'blocks.advertisement' | 'blocks.wallet' | 'blocks.hero-grid' | 'blocks.services' | 'blocks.whats-new' | 'blocks.invite-earn' | 'blocks.transactions';

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  'blocks.advertisement': 'Advertisement',
  'blocks.wallet': 'Wallet',
  'blocks.hero-grid': 'Hero Grid',
  'blocks.services': 'Services',
  'blocks.whats-new': "What's New",
  'blocks.invite-earn': 'Invite & Earn',
  'blocks.transactions': 'Transactions',
};

interface HeroGridItem { key: string; label: string; variant: string }
interface WhatsNewItem { image: MediaFile | null; title: string; targetUrl: string; ctaLabel: string }

// Generic bag of fields per block — kept loose (Record) since each block type has a very
// different shape; the editors below know how to read/write the fields they need.
type PageBlock = { __component: BlockType } & Record<string, unknown>;

const HERO_GRID_KEYS = ['MY_PLANS', 'ADDRESSES', 'ORDERS_HISTORY', 'APPLIANCES'];
const HERO_GRID_VARIANTS = ['COUNT', 'ACTIVE_COUNT', 'ACTIVE_PLAN'];

function defaultBlock(type: BlockType): PageBlock {
  switch (type) {
    case 'blocks.advertisement':
      return { __component: type, enableAdMob: false, adMobAdUnitId: '', adMobAdSize: 'BANNER', fallbackImage: null, fallbackTargetUrl: '', fallbackImpressionUrl: '' };
    case 'blocks.wallet':
      return { __component: type, heading: 'My Wallet', ctaLabel: '+ Add' };
    case 'blocks.hero-grid':
      return { __component: type, items: [] as HeroGridItem[] };
    case 'blocks.services':
      return { __component: type, heading: 'Services', rows: [] as { deviceTypes: number[] }[] };
    case 'blocks.whats-new':
      return { __component: type, heading: "What's New?", items: [] as WhatsNewItem[] };
    case 'blocks.invite-earn':
      return { __component: type, heading: 'Invite & Earn', body: 'Earn up to ₹{amount} for each friend you invite.', giftIcon: null, isDismissible: true };
    case 'blocks.transactions':
      return { __component: type, heading: 'Transactions', viewAllLabel: 'View All', limit: 10 };
  }
}

function BlockEditor({
  block,
  deviceTypeOptions,
  onChange,
}: {
  block: PageBlock;
  deviceTypeOptions: DeviceTypeOption[];
  onChange: (next: PageBlock) => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...block, ...patch });

  if (block.__component === 'blocks.advertisement') {
    const ad = block as unknown as AdvertisementForm & { __component: BlockType };
    return (
      <AdvertisementEditor
        value={{ enableAdMob: ad.enableAdMob, adMobAdUnitId: (ad.adMobAdUnitId as string) ?? '', adMobAdSize: (ad.adMobAdSize as string) ?? 'BANNER', fallbackImage: ad.fallbackImage, fallbackTargetUrl: (ad.fallbackTargetUrl as string) ?? '', fallbackImpressionUrl: (ad.fallbackImpressionUrl as string) ?? '' }}
        onChange={(v) => onChange({ __component: block.__component, ...v, fallbackImage: v.fallbackImage?.id ?? null })}
      />
    );
  }

  if (block.__component === 'blocks.wallet') {
    return (
      <div className="row g-2">
        <div className="col-6">
          <div style={fieldLabelStyle}>Heading</div>
          <input type="text" value={(block.heading as string) ?? ''} onChange={(e) => set({ heading: e.target.value })} style={inputStyle} />
        </div>
        <div className="col-6">
          <div style={fieldLabelStyle}>CTA Label</div>
          <input type="text" value={(block.ctaLabel as string) ?? ''} onChange={(e) => set({ ctaLabel: e.target.value })} style={inputStyle} />
        </div>
      </div>
    );
  }

  if (block.__component === 'blocks.hero-grid') {
    const items = (block.items as HeroGridItem[]) ?? [];
    return (
      <div>
        <RepeaterHeader label="Items" onAdd={() => set({ items: [...items, { key: HERO_GRID_KEYS[0], label: '', variant: HERO_GRID_VARIANTS[0] }] })} addLabel="+ Add Item" />
        <div className="d-flex flex-column" style={{ gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} className="row g-2 align-items-center" style={{ margin: 0 }}>
              <div className="col-4">
                <select value={item.key} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x) })} style={inputStyle}>
                  {HERO_GRID_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="col-4">
                <input type="text" value={item.label} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })} style={inputStyle} placeholder="Label" />
              </div>
              <div className="col-3">
                <select value={item.variant} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, variant: e.target.value } : x) })} style={inputStyle}>
                  {HERO_GRID_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="col-1 d-flex justify-content-end">
                <RemoveRowButton onClick={() => set({ items: items.filter((_, idx) => idx !== i) })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.__component === 'blocks.services') {
    const rows = (block.rows as { deviceTypes: number[] }[]) ?? [];
    return (
      <div>
        <div className="mb-2">
          <div style={fieldLabelStyle}>Heading</div>
          <input type="text" value={(block.heading as string) ?? ''} onChange={(e) => set({ heading: e.target.value })} style={inputStyle} />
        </div>
        <RepeaterHeader label="Rows" onAdd={() => set({ rows: [...rows, { deviceTypes: [] }] })} addLabel="+ Add Row" />
        <div className="d-flex flex-column" style={{ gap: 10 }}>
          {rows.map((row, i) => (
            <div key={i} className="d-flex align-items-start" style={{ gap: 8 }}>
              <div className="flex-grow-1">
                <RelationChecklist
                  label={`Row ${i + 1} — Device Types`}
                  options={deviceTypeOptions}
                  selectedIds={row.deviceTypes}
                  onChange={(ids) => set({ rows: rows.map((x, idx) => idx === i ? { deviceTypes: ids } : x) })}
                />
              </div>
              <div style={{ marginTop: 22 }}>
                <RemoveRowButton onClick={() => set({ rows: rows.filter((_, idx) => idx !== i) })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.__component === 'blocks.whats-new') {
    const items = (block.items as WhatsNewItem[]) ?? [];
    return (
      <div>
        <div className="mb-2">
          <div style={fieldLabelStyle}>Heading</div>
          <input type="text" value={(block.heading as string) ?? ''} onChange={(e) => set({ heading: e.target.value })} style={inputStyle} />
        </div>
        <RepeaterHeader label="Slides" onAdd={() => set({ items: [...items, { image: null, title: '', targetUrl: '', ctaLabel: 'Learn More' }] })} addLabel="+ Add Slide" />
        <div className="d-flex flex-column" style={{ gap: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 10 }}>
              <div className="row g-2 mb-2">
                <div className="col-4">
                  <ImageField label="Image" value={item.image} onChange={(v) => set({ items: items.map((x, idx) => idx === i ? { ...x, image: v } : x) })} />
                </div>
                <div className="col-3">
                  <div style={fieldLabelStyle}>Title</div>
                  <input type="text" value={item.title} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x) })} style={inputStyle} />
                </div>
                <div className="col-3">
                  <div style={fieldLabelStyle}>Target URL</div>
                  <input type="text" value={item.targetUrl} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, targetUrl: e.target.value } : x) })} style={inputStyle} />
                </div>
                <div className="col-2 d-flex align-items-end justify-content-end" style={{ paddingBottom: 8 }}>
                  <RemoveRowButton onClick={() => set({ items: items.filter((_, idx) => idx !== i) })} />
                </div>
              </div>
              <div style={fieldLabelStyle}>CTA Label</div>
              <input type="text" value={item.ctaLabel} onChange={(e) => set({ items: items.map((x, idx) => idx === i ? { ...x, ctaLabel: e.target.value } : x) })} style={inputStyle} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.__component === 'blocks.invite-earn') {
    return (
      <div className="d-flex flex-column" style={{ gap: 10 }}>
        <div className="row g-2">
          <div className="col-8">
            <div style={fieldLabelStyle}>Heading</div>
            <input type="text" value={(block.heading as string) ?? ''} onChange={(e) => set({ heading: e.target.value })} style={inputStyle} />
          </div>
          <div className="col-4 d-flex align-items-end" style={{ paddingBottom: 8 }}>
            <label className="d-flex align-items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: '#000' }}>
              <input type="checkbox" checked={Boolean(block.isDismissible)} onChange={(e) => set({ isDismissible: e.target.checked })} />
              Dismissible
            </label>
          </div>
        </div>
        <div>
          <div style={fieldLabelStyle}>Body (use {'{amount}'} for the referral reward)</div>
          <textarea value={(block.body as string) ?? ''} onChange={(e) => set({ body: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <ImageField label="Gift Icon" value={(block.giftIcon as MediaFile | null) ?? null} onChange={(v) => set({ giftIcon: v })} />
      </div>
    );
  }

  // blocks.transactions
  return (
    <div className="row g-2">
      <div className="col-5">
        <div style={fieldLabelStyle}>Heading</div>
        <input type="text" value={(block.heading as string) ?? ''} onChange={(e) => set({ heading: e.target.value })} style={inputStyle} />
      </div>
      <div className="col-4">
        <div style={fieldLabelStyle}>View All Label</div>
        <input type="text" value={(block.viewAllLabel as string) ?? ''} onChange={(e) => set({ viewAllLabel: e.target.value })} style={inputStyle} />
      </div>
      <div className="col-3">
        <div style={fieldLabelStyle}>Limit</div>
        <input type="number" value={(block.limit as number) ?? 10} onChange={(e) => set({ limit: Number(e.target.value) })} style={inputStyle} />
      </div>
    </div>
  );
}

interface PageRow {
  id: number;
  title: string;
  handle: string;
  blocks: PageBlock[];
}

const EMPTY_PAGE_FORM = { title: '', handle: '', blocks: [] as PageBlock[] };

function PagesTab({ pages, deviceTypeOptions }: { pages: PageRow[]; deviceTypeOptions: DeviceTypeOption[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_PAGE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addBlockType, setAddBlockType] = useState<BlockType>('blocks.advertisement');

  function openCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_PAGE_FORM);
    setError(null);
  }
  function openEdit(row: PageRow) {
    setCreating(false);
    setEditingId(row.id);
    setForm({ title: row.title, handle: row.handle, blocks: row.blocks ?? [] });
    setError(null);
  }
  function close() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  function addBlock() {
    setForm((p) => ({ ...p, blocks: [...p.blocks, defaultBlock(addBlockType)] }));
  }
  function updateBlock(i: number, next: PageBlock) {
    setForm((p) => ({ ...p, blocks: p.blocks.map((b, idx) => (idx === i ? next : b)) }));
  }
  function removeBlock(i: number) {
    setForm((p) => ({ ...p, blocks: p.blocks.filter((_, idx) => idx !== i) }));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setForm((p) => {
      const next = [...p.blocks];
      const j = i + dir;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, blocks: next };
    });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.handle.trim()) {
      setError('Title and handle are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { title: form.title, handle: form.handle, blocks: form.blocks };
      if (editingId) await updatePageAction(editingId, payload);
      else await createPageAction(payload);
      router.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save page');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deletePageAction(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" onClick={openCreate} style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, border: 'none' }}>
          + Add Page
        </button>
      </div>

      {showForm && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{editingId ? 'Edit Page' : 'Add Page'}</span>
              <button type="button" onClick={close} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>×</button>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={fieldLabelStyle}>Title</div>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Handle</div>
                <input type="text" value={form.handle} onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))} style={inputStyle} placeholder="homepage" />
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <span style={{ fontSize: 16, fontWeight: 700, color: '#181818' }}>Blocks</span>
              <div className="d-flex" style={{ gap: 8 }}>
                <select value={addBlockType} onChange={(e) => setAddBlockType(e.target.value as BlockType)} style={{ ...inputStyle, width: 180 }}>
                  {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>)}
                </select>
                <button type="button" onClick={addBlock} style={{ background: '#181818', color: '#FFF', border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, fontWeight: 600 }}>
                  + Add Block
                </button>
              </div>
            </div>

            <div className="d-flex flex-column mb-4" style={{ gap: 12 }}>
              {form.blocks.map((block, i) => (
                <div key={i} style={{ border: '1px solid #E5E5E5', borderRadius: 8, padding: 12 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#181818' }}>{i + 1}. {BLOCK_TYPE_LABELS[block.__component]}</span>
                    <div className="d-flex" style={{ gap: 10 }}>
                      <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', fontSize: 12, color: '#0D67CE', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                      <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === form.blocks.length - 1} style={{ background: 'none', border: 'none', fontSize: 12, color: '#0D67CE', opacity: i === form.blocks.length - 1 ? 0.3 : 1 }}>↓</button>
                      <RemoveRowButton onClick={() => removeBlock(i)} />
                    </div>
                  </div>
                  <BlockEditor block={block} deviceTypeOptions={deviceTypeOptions} onChange={(next) => updateBlock(i, next)} />
                </div>
              ))}
              {form.blocks.length === 0 && <div style={{ ...labelStyle, padding: 10 }}>No blocks yet — pick a type above and add one.</div>}
            </div>

            {error && <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
            <SaveButton saving={saving} onClick={handleSave} />
          </div>
        </div>
      )}

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
        <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ width: 260, ...labelStyle }}>Title</div>
          <div style={{ width: 220, ...labelStyle }}>Handle</div>
          <div style={{ width: 120, ...labelStyle }}>Blocks</div>
          <div style={{ width: 140, ...labelStyle }}>Actions</div>
        </div>
        {pages.length === 0 && <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>No pages yet.</div>}
        {pages.map((row, i) => (
          <div key={row.id} className="d-flex align-items-center" style={{ padding: '0 13px', height: 44, borderBottom: i === pages.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }} onClick={() => openEdit(row)}>
            <div style={{ width: 260, ...cellStyle }}>{row.title}</div>
            <div style={{ width: 220, ...cellStyle, fontWeight: 400 }}>{row.handle}</div>
            <div style={{ width: 120, ...cellStyle }}>{row.blocks?.length ?? 0}</div>
            <div style={{ width: 140 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => handleDelete(row.id)} disabled={deletingId === row.id} style={{ ...ctaButtonStyle('#FF5E5E'), opacity: deletingId === row.id ? 0.6 : 1 }}>
                {deletingId === row.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

type Tab = 'bottom-tab' | 'complaint-page' | 'global-config' | 'welcome-bonus' | 'pages';

export default function CmsView({
  bottomTab,
  complaintPage,
  globalConfig,
  welcomeBonus,
  pages,
  deviceTypeOptions,
}: {
  bottomTab: { tabs?: (Partial<TabItem> & { inactiveIcon?: MediaFile | null; activeIcon?: MediaFile | null })[] } | null;
  complaintPage: { advertisement?: Partial<AdvertisementForm> | null; resolutionSteps?: Partial<ResolutionStep>[]; infoBlocks?: Partial<InfoBlock>[] } | null;
  globalConfig: { entries?: ConfigEntry[] } | null;
  welcomeBonus: { image?: MediaFile | null; amount?: number; isEnabled?: boolean } | null;
  pages: PageRow[];
  deviceTypeOptions: DeviceTypeOption[];
}) {
  const searchParams = useSearchParams();
  const tab: Tab = (searchParams?.get('tab') as Tab | null) ?? 'bottom-tab';

  const heading: Record<Tab, string> = {
    'bottom-tab': 'Bottom Tab',
    'complaint-page': 'Complaint Page',
    'global-config': 'Global Config',
    'welcome-bonus': 'Welcome Bonus',
    pages: 'Pages',
  };

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />
      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-4" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{heading[tab]}</h1>

        {tab === 'bottom-tab' && <BottomTabTab bottomTab={bottomTab} />}
        {tab === 'complaint-page' && <ComplaintPageTab complaintPage={complaintPage} />}
        {tab === 'global-config' && <GlobalConfigTab globalConfig={globalConfig} />}
        {tab === 'welcome-bonus' && <WelcomeBonusTab welcomeBonus={welcomeBonus} />}
        {tab === 'pages' && <PagesTab pages={pages} deviceTypeOptions={deviceTypeOptions} />}
      </main>
    </div>
  );
}
