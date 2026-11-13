/**
 * Makes the website's signed-in pages CMS-driven (2026-11-01):
 *   1. Schema — adds the web.dashboard, web.app-sidebar and web.plans blocks (and their parts)
 *      from content-schemas/ and allows them in the Web Page "blocks" zone. Skipped for
 *      anything the database already has.
 *   2. Content — creates + publishes Web Pages with the current design's copy, pictures and
 *      colours: "Dashboard" (handle dashboard: web.dashboard) and "AMC Plans" (handle plans:
 *      web.app-sidebar + web.plans). Images are uploaded like the Media Library does. A page whose
 *      handle already exists is never overwritten. (Plan tiers stay in Subscription Plans.)
 *      An existing dashboard page gets any popup it's missing (Add to Wallet, Order History).
 *   3. Global Config — adds APP_DOWNLOAD_LINK (every website QR is generated from it) if missing.
 * Per-block QR images / app links were replaced by that entry; removing those fields deletes their
 * data, so it needs --allow-data-loss.
 *
 * On prod, run `yarn cms:sync-schema` from dev first (step 1 then has nothing to do) — schema
 * editing is dev-only.
 *   npx tsx --env-file=.env scripts/cms-add-app-pages.ts            # dry run
 *   npx tsx --env-file=.env scripts/cms-add-app-pages.ts --apply
 */
import fs from 'fs';
import path from 'path';
import { applySchemaPlan } from '../src/lib/content-schema/apply';
import { planSchemaChange } from '../src/lib/content-schema/ddl';
import { staticRawComponents, staticRawContentTypes } from '../src/lib/content-schema/loader';
import { ensureSchemaRegistry, getRegistrySnapshot } from '../src/lib/content-schema/registry';
import { contentTypeUid } from '../src/lib/content-schema/store';
import { createEntity, findEntity, findSingleType, listEntities, publishEntity, updateEntity } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';
import { uploadToCloudinary } from '../src/lib/media/cloudinary';

const apply = process.argv.includes('--apply');
const PUBLIC_DIR = path.join(__dirname, '../../serwise-website/public/images');

type Row = Record<string, unknown>;

const WEB_PAGE_UID = 'api::web-page.web-page';
const GLOBAL_CONFIG_UID = 'api::global-config.global-config';
const COMPONENTS = [
  'web.dashboard-tile',
  'web.dial-item',
  'web.plan-preview',
  'web.dashboard-style',
  'web.dashboard',
  'web.list-item',
  'web.sidebar-item',
  'web.app-sidebar',
  'web.plans',
  'web.wallet-amount',
  'web.add-money',
  'web.order-history',
  // App Promo's own QR/link fields moved to Global Config → APP_DOWNLOAD_LINK
  'web.app-promo',
  'web.booking-appliance',
  'web.ticket',
  'web.resolution-step',
  'web.resolution-steps',
  'web.info-block',
  'web.info-blocks',
  'web.rate-card',
];
/** Single types defined by content-schemas/ — the Magic Booking popup's content. */
const MAGIC_FLOW_UID = 'api::magic-flow.magic-flow';
const ADDRESS_BOOK_UID = 'api::address-book.address-book';
const SETTINGS_DRAWER_UID = 'api::settings-drawer.settings-drawer';
const CONTENT_TYPES = [MAGIC_FLOW_UID, ADDRESS_BOOK_UID, SETTINGS_DRAWER_UID];
/** Removed fields (per-block QR images / app links, now global). Dropping them needs --allow-data-loss. */
const allowDataLoss = process.argv.includes('--allow-data-loss');
const APP_DOWNLOAD_LINK = 'https://onelink.to/npw2mp';
/** Blocks the Web Page "blocks" zone must allow. */
const BLOCKS = ['web.dashboard', 'web.app-sidebar', 'web.plans', 'web.ticket', 'web.resolution-steps', 'web.info-blocks', 'web.rate-card'];

/** Repository writes end with Next's revalidateTag, which throws outside a request — the DB write
 *  has already committed by then, so only that specific error is ignored. */
async function ignoreRevalidate<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && /static generation store missing|revalidateTag|outside a request scope/i.test(err.message)) return undefined;
    throw err;
  }
}

// ─── 1. schema ───────────────────────────────────────────────────────────────

async function addSchema() {
  await ensureSchemaRegistry({ force: true });
  const before = getRegistrySnapshot();
  if (before.source !== 'db') throw new Error('No schema registry on this database — apply prisma/manual-migrations/0004_cms_schema_registry.sql first.');

  // These components are defined by content-schemas/: add missing ones, bring changed ones up to date.
  const bundled = new Map(staticRawComponents.filter((c) => COMPONENTS.includes(c.uid)).map((c) => [c.uid, c]));
  const components = before.components.map((c) => {
    const file = bundled.get(c.uid);
    return file && JSON.stringify(file.schema.attributes) !== JSON.stringify(c.schema.attributes)
      ? { uid: c.uid, schema: { ...c.schema, info: file.schema.info, attributes: file.schema.attributes } }
      : c;
  });
  const have = new Set(before.components.map((c) => c.uid));
  const missing = [...bundled.values()].filter((c) => !have.has(c.uid));

  const contentTypes = before.contentTypes.map((ct) => {
    if (contentTypeUid(ct) !== WEB_PAGE_UID) return ct;
    const zone = ct.attributes.blocks;
    const add = BLOCKS.filter((uid) => !zone.components?.includes(uid));
    if (add.length === 0) return ct;
    return { ...ct, attributes: { ...ct.attributes, blocks: { ...zone, components: [...(zone.components ?? []), ...add] } } };
  });
  if (!contentTypes.some((ct) => contentTypeUid(ct) === WEB_PAGE_UID)) throw new Error('This database has no Web Page type.');

  // Content types defined by content-schemas/ (Magic Flow): add if missing, bring fields up to date.
  const haveTypes = new Map(contentTypes.map((ct, i) => [contentTypeUid(ct), i]));
  for (const raw of staticRawContentTypes.filter((ct) => CONTENT_TYPES.includes(contentTypeUid(ct)))) {
    const at = haveTypes.get(contentTypeUid(raw));
    if (at === undefined) contentTypes.push(raw);
    else if (JSON.stringify(contentTypes[at].attributes) !== JSON.stringify(raw.attributes)) {
      contentTypes[at] = { ...contentTypes[at], info: raw.info, attributes: raw.attributes };
    }
  }

  const plan = planSchemaChange(before, { ...before, contentTypes, components: [...components, ...missing] });
  if (plan.changes.length === 0) {
    console.log('Schema: already in place.');
    return;
  }
  for (const change of plan.changes) console.log(`Schema: ${change.destructive ? '⚠ ' : ''}${apply ? '' : 'would '}${change.description}`);
  if (apply && plan.changes.some((c) => c.destructive) && !allowDataLoss) {
    throw new Error('Some changes delete fields (marked ⚠). Re-run with --apply --allow-data-loss if that is intended.');
  }
  if (apply) {
    await applySchemaPlan(prisma, before, plan);
    await ensureSchemaRegistry({ force: true });
  }
}

// ─── 2. content ──────────────────────────────────────────────────────────────

const MIME: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml' };

/** Uploads public/images/<relativePath> once (named website-<path>, same as seed-web-content.ts). */
async function asset(relativePath: string, alt = ''): Promise<number | string> {
  const name = `website-${relativePath.replace(/[\\/]/g, '-')}`;
  const existing = await prisma.files.findFirst({ where: { name, provider: 'cloudinary' }, orderBy: { id: 'desc' } });
  if (existing) return existing.id;
  if (!apply) return `<upload ${relativePath}>`;

  const ext = path.extname(relativePath);
  const mime = MIME[ext];
  const uploaded = await uploadToCloudinary(fs.readFileSync(path.join(PUBLIC_DIR, relativePath)), mime);
  const now = new Date();
  const created = await prisma.files.create({
    data: {
      name,
      alternative_text: alt,
      ext,
      mime,
      size: Math.round((uploaded.bytes / 1024) * 100) / 100,
      width: uploaded.width,
      height: uploaded.height,
      url: uploaded.url,
      provider: 'cloudinary',
      provider_metadata: { public_id: uploaded.publicId, resource_type: uploaded.resourceType },
      folder_path: '/',
      created_at: now,
      updated_at: now,
      published_at: now,
    },
  });
  console.log(`  uploaded ${relativePath} → file #${created.id}`);
  return created.id;
}

/** Add to Wallet popup — Figma "Add to wallet pop up". */
const ADD_MONEY: Row = {
  title: 'Add to Wallet',
  amounts: [50, 100, 200, 250, 350, 500].map((amount) => ({ amount })),
  customPlaceholder: 'Custom',
  minAmount: 10,
  maxAmount: 50000,
  amountErrorText: 'Enter an amount between ₹{min} and ₹{max}.',
  continueLabel: 'Continue',
  note: 'Note: Wallet Balance Deduction is only Available through Mobile App',
  paymentDescription: 'Wallet Recharge',
  processingText: 'Confirming your payment…',
  successText: 'Money added to your wallet.',
  pendingText: 'Payment received — your balance will update shortly.',
  failureText: 'Payment didn’t go through. No money was deducted.',
  chipBackground: '#E5E5E5',
  chipTextColor: '#000000',
  selectedBackground: '#000000',
  selectedTextColor: '#FFFFFF',
  placeholderColor: '#B7B7B7',
  buttonBackground: '#000000',
  buttonTextColor: '#FFFFFF',
  noteColor: '#B7B7B7',
};

/** Order History popup — Figma "Frame 21422". */
const ORDER_HISTORY: Row = {
  title: 'Order History',
  activeTicketsText: '{count} Active Tickets',
  activeTicketText: '{count} Active Ticket',
  note: 'To View Any Past Ticket Orders\nDownload the Serwise App.',
  background: '#F2F2F2',
  borderColor: '#E5E5E5',
  titleColor: '#454545',
  textColor: '#000000',
  noteColor: '#B7B7B7',
};

async function dashboardBlock(): Promise<Row> {
  const dial = async (label: string, file: string, extra: Row = {}) => ({
    label,
    image: await asset(file, label),
    imageShadow: true,
    action: 'magic-booking',
    deviceKey: DIAL_DEVICE_KEYS[label],
    handoffTitle: `Book ${label} service`,
    ...extra,
  });

  return {
    __component: 'web.dashboard',
    personalLabel: 'Personal',
    organizationLabel: 'Organization',
    organizationNotice: 'Organization accounts are coming soon.',
    avatarEmoji: '🌻',
    morningGreeting: 'Good Morning,',
    afternoonGreeting: 'Good Afternoon,',
    eveningGreeting: 'Good Evening,',
    fallbackName: 'there',
    signOutLabel: 'Sign out',
    addressTile: {
      label: 'Home & Address',
      image: await asset('dashboard/home-address.svg', 'Home & Address'),
      imageWidth: 97,
      imageHeight: 59,
      action: 'addresses',
      handoffTitle: 'Your homes & addresses',
      showOpenIcon: false,
      hidden: false,
    },
    walletTile: { label: 'Wallet', action: 'add-money', handoffTitle: 'Add money to your wallet', showOpenIcon: false, hidden: false },
    appliancesTile: {
      label: 'My Appliances',
      image: await asset('dashboard/my-appliances.svg', 'My Appliances'),
      imageWidth: 91,
      imageHeight: 66,
      action: 'app',
      handoffTitle: 'Your appliances',
      showOpenIcon: true,
      hidden: false,
    },
    ordersTile: { label: 'Orders', action: 'order-history', handoffTitle: 'Your orders & service history', showOpenIcon: true, hidden: false },
    dialTitle: 'Service Dial',
    dialItems: [
      await dial('Air Conditioner', 'devices/ac.png'),
      await dial('Fridge', 'devices/fridge.png'),
      await dial('Washing Machine', 'devices/washer.png'),
      await dial('RO / Water Purifier', 'devices/purifier.png'),
      await dial('Geyser', 'devices/geyser.png'),
      await dial('Customer Care', 'dashboard/customer-care.svg', { action: 'call', deviceKey: null, imageShadow: false, handoffTitle: null }),
    ],
    plansTitle: 'My Plans',
    noPlanText: 'Looks like you don’t have an active clean water plan yet.',
    activePlanFallback: 'Active plan',
    nextServiceLabel: 'Next service',
    plansPreviewLogo: await asset('serwise_text.png', 'serwise'),
    plansPreview: [
      { price: '₹1899', buttonColor: '#2754FF', buttonTextColor: '#FFFFFF' },
      { price: '₹1299', description: 'Essential care to get your appliance started right.', buttonLabel: 'Subscribe', buttonColor: '#E4F55E', buttonTextColor: '#000000' },
      { price: '₹2499', buttonColor: '#FF5A1F', buttonTextColor: '#FFFFFF' },
    ],
    exploreLabel: 'Explore',
    exploreHref: '/plans',
    rateCard: { label: 'Rate Card', action: 'link', href: '/rate-card', handoffTitle: 'Service rate card', showOpenIcon: true, hidden: false },
    magicLabel: 'Magic Booking',
    magicHint: 'Don’t Know What to do?\nClick Above Button.',
    magicHandoffTitle: 'Magic Booking',
    magicAction: 'magic-booking',
    supportPhone: '+919712811201',
    qrWordmark: await asset('serwise_text.png', 'serwise'),
    addMoney: ADD_MONEY,
    orderHistory: ORDER_HISTORY,
    handoffText: 'Continue in the Serwise app — scan the code with your phone, or tap below to get the app.',
    handoffButtonLabel: 'Get the app',
    style: {
      pageBackground: '#F2F2F2',
      cardBackground: '#FFFFFF',
      cardBorderColor: '#E5E5E5',
      textColor: '#000000',
      labelColor: '#454545',
      accentColor: '#0C8D6E',
      dialIconBackground: '#F4F4F4',
      noPlanColor: '#2754FF',
      exploreButtonColor: '#454545',
      magicGradientFrom: '#4D4D4D',
      magicGradientTo: '#09101F',
      magicTextColor: '#FFFFFF',
      hintColor: '#B7B7B7',
    },
  };
}

const HANDOFF_TEXT = 'Continue in the Serwise app — scan the code with your phone, or tap below to get the app.';

async function sidebarBlock(): Promise<Row> {
  return {
    __component: 'web.app-sidebar',
    logo: await asset('serwise_text.png', 'serwise'),
    logoHref: '/',
    navItems: [
      { label: 'Service Ticket', icon: 'ticket', handoffTitle: 'Service Ticket' },
      { label: 'AMC Plans', icon: 'shield', href: '/plans' },
      { label: 'My Appliances', icon: 'appliance', handoffTitle: 'My Appliances' },
      { label: 'Settings', icon: 'settings', handoffTitle: 'Settings' },
    ],
    qrLabel: 'Scan to Download',
    handoffText: HANDOFF_TEXT,
    handoffButtonLabel: 'Get the app',
    sidebarBackground: '#F2F2F2',
    contentBackground: '#EAEAEA',
    activeBackground: '#FFFFFF',
    borderColor: '#B7B7B7',
    textColor: '#000000',
  };
}

async function plansBlock(): Promise<Row> {
  return {
    __component: 'web.plans',
    annualLabel: 'Annual Plan',
    monthlyLabel: 'Monthly Plan',
    includesTitle: 'Every Plans Includes',
    includes: [
      'All Essential Filters Replacement.',
      'Deep internal hygiene cleaning of purifier tank.',
      'Taste & odor restoration.',
      'Scheduled service — always on time (no follow-up needed).',
      'Performance & safety check-up.',
    ].map((text) => ({ text })),
    cashReward: 'Instant Cash Reward up to ₹200 on any plan.',
    cardLogo: await asset('serwise_text.png', 'serwise'),
    perMonthLabel: 'Per month',
    perYearLabel: 'Per year,',
    perMonthSuffix: '/month',
    monthlyUnavailableText: 'Monthly pricing is available in the Serwise app.',
    includedLabel: 'What’s Included?',
    subscribeLabel: 'Subscribe',
    dialogTitle: 'What’s Included?',
    qtyLabel: 'Qty:',
    subscribeHandoffTitle: 'Subscribe to {plan}',
    defaultFeatures: [
      { title: 'Spun Filter', description: 'Spun filter removes dirt, sand, and rust particles from water, protecting the main purifier.', qty: '2 pcs' },
      {
        title: 'Inline Filter Set',
        description: '“Sediment, Pre Carbon, Post Carbon Filter” are being replaced to remove tiny particles using Carbon balls and blocks',
        qty: '1 pcs',
      },
      { title: 'Hygiene & Cleaning of Tank', description: 'Water Storage Tank cleaning and servicing done at the end date of the subscription.', qty: '1 pcs' },
      {
        title: 'Performance & Safety Check up',
        description: 'Ensuring condition of all related components, and checking wiring for safe and proper operation.',
        qty: '3 Services',
      },
      {
        title: 'Taste & Odor Restoration',
        description: 'Taste & Odor Restoration are achieved through replacement of filters to remove chlorine and unwanted chemicals that might be in your water.',
        qty: '3 Services',
      },
    ],
    fallbackPlanColor: '#2754FF',
    toggleBackground: '#E2E2E2',
    cardBackground: '#FFFFFF',
    textColor: '#000000',
    mutedColor: '#5D5D5D',
    tickColor: '#616161',
    rewardColor: '#00A205',
    dialogTickColor: '#000000',
  };
}

/** Website ticket page — Figma "Order Confirmation & Tracking". Steps + info blocks start as a copy of the
 *  app's Page "complaint-detail" (same pictures); from then on the two are edited separately. */
async function ticketBlocks(): Promise<Row[]> {
  const appPage = await findPage('complaint-detail', 'api::page.page');
  const appBlocks = ((appPage && ((await findEntity('api::page.page', appPage.id as number, { status: 'draft' })) as Row | null)?.blocks) ?? []) as Row[];
  const appBlock = (uid: string) => appBlocks.find((b) => b.__component === uid);
  const ad = appBlock('blocks.advertisement');
  const appSteps = ((appBlock('blocks.resolution-steps')?.steps as Row[] | undefined) ?? []).filter((s) =>
    ['assigning', 'entrance', 'estimating', 'completed'].includes(s.stageKey as string),
  );
  const appItems = (appBlock('blocks.info-blocks')?.items as Row[] | undefined) ?? [];

  const steps = appSteps.length
    ? appSteps.map((s) => ({ stageKey: s.stageKey, title: s.title, description: s.description, image: s.image }))
    : [
        { stageKey: 'assigning', title: 'Assign', description: 'Dedicated Verified Service Provider will be Assigned' },
        { stageKey: 'entrance', title: 'Entrance', description: 'Entrance through Qr code to insure safety & Security.' },
        { stageKey: 'estimating', title: 'Estimation', description: 'Approval of Amount of work that has to be done.' },
        { stageKey: 'completed', title: 'Solved!', description: 'Raised Issue Solved and in warranty period now.' },
      ];
  const items = (appItems.length ? appItems : [{ title: 'Make It ₹185 >', body: 'Technician visit and issue diagnosis fee. Refunded on service approval — half to wallet and half adjusted in final quote.' }]).map(
    (item, i) => ({
      title: item.title,
      body: item.body,
      // The app's advertisement banner sits under the first block
      ...(i === 0 && ad?.fallbackImage ? { image: ad.fallbackImage, imageLink: ad.fallbackTargetUrl ?? null } : {}),
    }),
  );

  return [
    {
      __component: 'web.ticket',
      raisedTitle: 'Your Service Ticket is Raised!',
      ticketTitle: 'Service Ticket',
      goBackLabel: 'Go Back',
      ticketDetailsTitle: 'Ticket Details',
      addressDetailsLabel: 'Address Details',
      otherAddressLabel: 'Other',
      changeLabel: 'Change',
      applianceDetailsLabel: 'Appliance Details',
      quantityText: '{count} Nos',
      addDetailsLabel: '+ Add Details',
      ticketUpdateTitle: 'Ticket Update',
      providerDetailsLabel: 'Provider Details',
      noProviderText: 'We’re assigning a verified technician near you.',
      providerRoleText: '{appliance} Tech',
      sendMessageLabel: 'Send a Message',
      tagsNotesLabel: '+ Tags & Notes',
      ticketTabLabel: 'Ticket {n}',
      errorText: 'Couldn’t load this ticket. Please try again.',
      stageAssigning: 'Assigning',
      stageEntrance: 'Entrance',
      stageEstimating: 'Estimating',
      stageApproval: 'Estimate Approval',
      stageInProgress: 'In Progress',
      stagePayment: 'Payment',
      stageCompleted: 'Completed',
      stageRejected: 'Rejected',
      pageBackground: '#F2F2F2',
      headerBackground: '#E6E6E6',
      accentColor: '#139859',
      cardBackground: '#FFFFFF',
      borderColor: '#E5E5E5',
      mutedColor: '#B7B7B7',
      chipBackground: '#E5E5E5',
      chipTextColor: '#454545',
    },
    { __component: 'web.resolution-steps', title: 'How Your Issue Will be Resolved.', steps, doneColor: '#25B961' },
    { __component: 'web.info-blocks', items },
  ];
}

const PAGES: { title: string; handle: string; seoTitle?: string; seoDescription?: string; blocks: () => Promise<Row[]> }[] = [
  { title: 'Dashboard', handle: 'dashboard', blocks: async () => [await dashboardBlock()] },
  {
    title: 'AMC Plans',
    handle: 'plans',
    seoTitle: 'AMC Plans | Serwise',
    seoDescription: 'Annual maintenance plans for your water purifier — filters, hygiene cleaning and scheduled service included.',
    blocks: async () => [await sidebarBlock(), await plansBlock()],
  },
  { title: 'Ticket', handle: 'ticket', seoTitle: 'Service Ticket | Serwise', blocks: ticketBlocks },
  {
    title: 'Rate Card',
    handle: 'rate-card',
    seoTitle: 'Rate Card | Serwise',
    seoDescription: 'Service charges for appliance repair and maintenance with Serwise.',
    blocks: async () => [
      {
        __component: 'web.rate-card',
        title: 'Rate Card',
        goBackLabel: 'Go Back',
        descriptionHeader: 'Description',
        chargeHeader: 'Service Charge',
        otherGroupLabel: 'Other Services',
        emptyText: 'Rates will be published here soon.',
        pageBackground: '#F2F2F2',
        tableBorderColor: '#B7B7B7',
        textColor: '#000000',
      },
    ],
  },
];

async function findPage(handle: string, uid = WEB_PAGE_UID): Promise<Row | null> {
  const result = await listEntities(uid, { status: 'draft', filters: { handle }, pageSize: 1 });
  return (result.data[0] as Row | undefined) ?? null;
}

async function addPage({ blocks, ...page }: (typeof PAGES)[number]) {
  if (await findPage(page.handle)) {
    console.log(`Content: a web page with handle "${page.handle}" already exists — left as is.`);
    return;
  }
  const data = { ...page, blocks: await blocks() };
  const names = data.blocks.map((b) => b.__component).join(', ');
  if (!apply) {
    console.log(`Content: would create + publish Web Page "${page.title}" (${page.handle}) with: ${names}`);
    return;
  }
  await ignoreRevalidate(() => createEntity(WEB_PAGE_UID, data));
  const draft = await findPage(page.handle);
  if (!draft) throw new Error(`${page.title} page was not created`);
  await ignoreRevalidate(() => publishEntity(WEB_PAGE_UID, draft.id as number));
  console.log(`Content: created + published Web Page "${page.title}" (${page.handle}) with: ${names}`);
}

/** Components re-saved as new rows: drop their row ids, but keep media objects (written by their file id). */
function withoutComponentIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutComponentIds);
  if (value === null || typeof value !== 'object') return value;
  const row = value as Row;
  if ('mime' in row && 'url' in row) return row;
  return Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id').map(([k, v]) => [k, withoutComponentIds(v)]));
}

/** Dashboard pages created before the popups existed get them, with the tile that opens each one
 *  pointed at it (Wallet → Add to Wallet, Orders → Order History). Only fills what's missing —
 *  anything already edited in the CMS is kept. */
async function upgradeDashboard() {
  const found = await findPage('dashboard');
  if (!found) return;
  const draft = (await findEntity(WEB_PAGE_UID, found.id as number, { status: 'draft' })) as Row | null;
  const blocks = (draft?.blocks as Row[] | undefined) ?? [];
  const dashboard = blocks.find((b) => b.__component === 'web.dashboard');
  if (!dashboard) return;

  const patch: Row = {};
  const added: string[] = [];
  if (!dashboard.addMoney) {
    patch.addMoney = ADD_MONEY;
    patch.walletTile = { ...((dashboard.walletTile as Row | null) ?? {}), action: 'add-money' };
    added.push('Add to Wallet popup (Wallet tile opens it)');
  }
  if (!dashboard.orderHistory) {
    patch.orderHistory = ORDER_HISTORY;
    patch.ordersTile = { ...((dashboard.ordersTile as Row | null) ?? {}), action: 'order-history' };
    added.push('Order History popup (Orders tile opens it)');
  }
  const rateCard = (dashboard.rateCard as Row | null) ?? {};
  if (!rateCard.action || rateCard.action === 'app') {
    patch.rateCard = { ...rateCard, action: 'link', href: '/rate-card' };
    added.push('Rate Card tile opens /rate-card');
  }
  const addressTile = (dashboard.addressTile as Row | null) ?? {};
  if (!addressTile.action || addressTile.action === 'app') {
    patch.addressTile = { ...addressTile, action: 'addresses' };
    added.push('Home & Address tile opens the address sheet');
  }
  if (!dashboard.magicAction || dashboard.magicAction === 'app') {
    patch.magicAction = 'magic-booking';
    added.push('Magic Booking button opens the booking popup');
  }
  // Appliance dial items still on the old "continue in the app" default book that appliance instead
  const dialItems = (dashboard.dialItems as Row[] | undefined) ?? [];
  if (dialItems.some((d) => d.action === 'app' && !d.deviceKey && DIAL_DEVICE_KEYS[d.label as string])) {
    patch.dialItems = dialItems.map((d) =>
      d.action === 'app' && !d.deviceKey && DIAL_DEVICE_KEYS[d.label as string]
        ? { ...d, action: 'magic-booking', deviceKey: DIAL_DEVICE_KEYS[d.label as string] }
        : d,
    );
    added.push('Service Dial appliances open the booking popup');
  }
  if (added.length === 0) {
    console.log('Content: dashboard page is up to date.');
    return;
  }
  if (!apply) {
    console.log(`Content: would add to the dashboard page: ${added.join('; ')}.`);
    return;
  }
  const updated = blocks.map((b) => (b === dashboard ? { ...b, ...patch } : b));
  await ignoreRevalidate(() => updateEntity(WEB_PAGE_UID, found.id as number, { blocks: withoutComponentIds(updated) as Row[] }));
  await ignoreRevalidate(() => publishEntity(WEB_PAGE_UID, found.id as number));
  console.log(`Content: added to the dashboard page (published): ${added.join('; ')}.`);
}

/** Service Dial labels → the nexus device key the booking popup preselects. */
const DIAL_DEVICE_KEYS: Record<string, string> = {
  'Air Conditioner': 'air_conditioner',
  Fridge: 'fridge',
  'Washing Machine': 'washing_machine',
  'RO / Water Purifier': 'master_purifier',
  Geyser: 'geyser',
};

/** Magic Booking popup content — Figma "Magic booking" frames. Created once; never overwritten. */
async function magicFlowContent(): Promise<Row> {
  const appliance = async (deviceKey: string, label: string, file: string, imageWidth: number, imageHeight: number) => ({
    deviceKey,
    label,
    image: await asset(file, label),
    imageWidth,
    imageHeight,
  });
  return {
    serviceType: 'Service',
    applianceTitle: 'Appliance Details',
    appliances: [
      await appliance('air_conditioner', 'Air Conditioner', 'devices/ac.png', 50, 24),
      await appliance('fridge', 'Fridge', 'devices/fridge.png', 33, 46),
      await appliance('washing_machine', 'Washing Machine', 'devices/washer.png', 28, 34),
      await appliance('master_purifier', 'RO / Water Purifier', 'devices/purifier.png', 37, 31),
      await appliance('geyser', 'Geyser', 'devices/geyser.png', 35, 30),
    ],
    selectedLabel: 'Selected',
    notSelectedLabel: 'Not Selected',
    selectLabel: 'Select',
    addLabel: 'Add',
    multipleHint: 'You Can Add Multiple Appliance at once',
    confirmLabel: 'Confirm',
    addressTitle: 'Address',
    noAddressText: '0 Address Found!\nAdd for the better experience.',
    addressesFoundText: '{count} Address Found!',
    searchPlaceholder: 'Search Address',
    homeLabel: 'Home',
    officeLabel: 'Office',
    otherLabel: 'Other',
    housePlaceholder: 'House / Flat / Floor / Building No.',
    streetPlaceholder: 'Street / Road / Area Name',
    autofillPlaceholder: 'Autofill Box',
    directionPlaceholder: 'Note For Direction',
    addAddressLabel: 'Add Address',
    addAnotherLabel: 'Add another',
    addressContinueLabel: 'Continue',
    confirmationTitle: 'Confirmation',
    applianceDetailsLabel: 'Appliance Details',
    addressDetailsLabel: 'Address Details',
    changeLabel: 'Change',
    visitChargeText: 'Visit Charge : ₹{amount}',
    visitChargeNote: 'Any additional charges after inspecting your appliance will be shared with you before the work starts.',
    confirmContinueLabel: 'Continue',
    upiOfferText: 'Use UPI and get ₹15 off instantly',
    upiOfferIcon: await asset('magic/upi-offer.svg', 'UPI offer'),
    paymentTitle: 'Payment',
    scanToPayLabel: 'Scan to pay',
    paymentNote: 'Scan with any UPI app. Your visit is booked as soon as the payment is received.',
    paymentContinueLabel: 'Continue',
    waitingText: 'Waiting for your payment…',
    expiredText: 'This QR has expired.',
    retryLabel: 'Get a new QR',
    successTitle: 'Visit Booked!',
    successText: 'Payment received — a technician will be assigned to you shortly.\nTrack it in the Serwise app.',
    doneLabel: 'Done',
    errorText: 'Something went wrong. Please try again.',
    background: '#F2F2F2',
    borderColor: '#E5E5E5',
    titleColor: '#454545',
    textColor: '#000000',
    mutedColor: '#B7B7B7',
    cardBackground: '#FFFFFF',
    selectedBackground: '#454545',
    selectedTextColor: '#FFFFFF',
    chipBackground: '#E5E5E5',
    chipTextColor: '#454545',
    buttonBackground: '#181818',
    buttonTextColor: '#FFFFFF',
    offerColor: '#2754FF',
  };
}

/** Home & Address sheet — Figma "Address" (list) + "Add Address". */
async function addressBookContent(): Promise<Row> {
  return {
    title: 'Home & Address',
    addCardLabel: 'Add address',
    editLabel: 'Edit',
    emptyText: 'No saved addresses yet.',
    deleteConfirmText: 'Delete this address?',
    deleteLabel: 'Delete',
    cancelLabel: 'Cancel',
    addTitle: 'Add Address',
    editTitle: 'Edit Address',
    searchPlaceholder: 'Search Address',
    saveAsLabel: 'Save As',
    homeLabel: 'Home',
    officeLabel: 'Office',
    otherLabel: 'Other',
    houseLabel: 'House / Flat / Floor / Building No.',
    housePlaceholder: 'e.g. C/201 Navkar Darshan Apartments',
    streetLabel: 'Street / Road / Area Name',
    streetPlaceholder: 'e.g. Vasant Vihar Township',
    autofillLabel: 'Location Autofill Box',
    autofillPlaceholder: 'Move the map or search to pick your location.',
    saveLabel: 'Save Address',
    errorText: 'Something went wrong. Please try again.',
    sheetBackground: '#FFFFFF',
    cardBorderColor: '#E5E5E5',
    titleColor: '#000000',
    textColor: '#454545',
    mutedColor: '#B7B7B7',
    chipBackground: '#E5E5E5',
    chipTextColor: '#454545',
    buttonBackground: '#181818',
    buttonTextColor: '#FFFFFF',
    deleteColor: '#FF9A9A',
  };
}

/** Settings drawer (dashboard gear) — Figma "Settings". */
async function settingsDrawerContent(): Promise<Row> {
  return {
    title: 'Settings',
    firstNameLabel: 'First Name',
    firstNamePlaceholder: 'First name',
    lastNamePlaceholder: 'Last name',
    phoneLabel: 'Phone Number',
    phoneChangeTitle: 'Change your phone number',
    emailLabel: 'Mail Id',
    emailPlaceholder: 'name@example.com',
    changeLabel: 'Change',
    saveLabel: 'Save',
    savedText: 'Saved',
    invalidEmailText: 'Please enter a valid email address.',
    errorText: 'Something went wrong. Please try again.',
    logoutLabel: 'Logout',
    background: '#FFFFFF',
    titleColor: '#000000',
    labelColor: '#363636',
    inputBorderColor: '#B7B7B7',
    chipBackground: '#E5E5E5',
    chipTextColor: '#454545',
    saveBackground: '#191919',
    saveTextColor: '#FFFFFF',
    logoutBackground: '#FFDBDB',
    logoutTextColor: '#FF6262',
  };
}

/** Creates a single type's content once; later runs only fill plain fields that are still empty. */
async function ensureSingleType(uid: string, label: string, build: () => Promise<Row>) {
  const existing = (await findSingleType(uid)) as Row | null;
  if (existing) {
    const content = await build();
    const patch = Object.fromEntries(
      Object.entries(content).filter(([key, value]) => typeof value === 'string' && (existing[key] === null || existing[key] === undefined)),
    );
    if (Object.keys(patch).length === 0) {
      console.log(`${label}: content already complete — left as is.`);
      return;
    }
    if (!apply) {
      console.log(`${label}: would fill ${Object.keys(patch).length} empty field(s): ${Object.keys(patch).join(', ')}`);
      return;
    }
    await ignoreRevalidate(() => updateEntity(uid, existing.id as number, patch));
    console.log(`${label}: filled ${Object.keys(patch).length} empty field(s).`);
    return;
  }
  if (!apply) {
    console.log(`${label}: would create the content.`);
    return;
  }
  await ignoreRevalidate(async () => createEntity(uid, await build()));
  console.log(`${label}: created the content.`);
}

async function ensureMagicFlow() {
  const existing = (await findSingleType(MAGIC_FLOW_UID)) as Row | null;
  if (existing) {
    // New plain fields get their design copy; filled fields are kept.
    const content = await magicFlowContent();
    const patch = Object.fromEntries(
      Object.entries(content).filter(([key, value]) => typeof value === 'string' && (existing[key] === null || existing[key] === undefined)),
    );
    if (Object.keys(patch).length === 0) {
      console.log('Magic Flow: content already complete — left as is.');
      return;
    }
    if (!apply) {
      console.log(`Magic Flow: would fill ${Object.keys(patch).length} empty field(s): ${Object.keys(patch).join(', ')}`);
      return;
    }
    await ignoreRevalidate(() => updateEntity(MAGIC_FLOW_UID, existing.id as number, patch));
    console.log(`Magic Flow: filled ${Object.keys(patch).length} empty field(s).`);
    return;
  }
  if (!apply) {
    console.log('Magic Flow: would create the booking popup content.');
    return;
  }
  await ignoreRevalidate(async () => createEntity(MAGIC_FLOW_UID, await magicFlowContent()));
  console.log('Magic Flow: created the booking popup content.');
}

/** The app download link every website QR is generated from — one Global Config entry. */
async function ensureAppDownloadLink() {
  const config = (await findSingleType(GLOBAL_CONFIG_UID)) as Row | null;
  const entries = (config?.entries as Row[] | undefined) ?? [];
  if (entries.some((e) => e.key === 'APP_DOWNLOAD_LINK')) {
    console.log('Global Config: APP_DOWNLOAD_LINK already set — left as is.');
    return;
  }
  if (!apply) {
    console.log(`Global Config: would add APP_DOWNLOAD_LINK = ${APP_DOWNLOAD_LINK}`);
    return;
  }
  const next = withoutComponentIds([...entries, { key: 'APP_DOWNLOAD_LINK', value: APP_DOWNLOAD_LINK }]) as Row[];
  if (config) await ignoreRevalidate(() => updateEntity(GLOBAL_CONFIG_UID, config.id as number, { entries: next }));
  else await ignoreRevalidate(() => createEntity(GLOBAL_CONFIG_UID, { entries: next }));
  console.log(`Global Config: added APP_DOWNLOAD_LINK = ${APP_DOWNLOAD_LINK}`);
}

async function main() {
  console.log(`Database: ${new URL(process.env.DATABASE_URL!).pathname.slice(1)}   Mode: ${apply ? 'APPLY' : 'dry run'}\n`);
  await addSchema();
  // Content needs the schema in place; on a dry run with schema pending, stop here.
  await ensureSchemaRegistry({ force: true });
  const have = new Set(getRegistrySnapshot().components.map((c) => c.uid));
  if (!COMPONENTS.every((uid) => have.has(uid))) {
    console.log('Content: skipped until the schema is applied.');
  } else {
    for (const page of PAGES) await addPage(page);
    await upgradeDashboard();
  }
  const haveType = (uid: string) => getRegistrySnapshot().contentTypes.some((ct) => contentTypeUid(ct) === uid);
  if (haveType(MAGIC_FLOW_UID)) await ensureMagicFlow();
  else console.log('Magic Flow: skipped until the schema is applied.');
  if (haveType(ADDRESS_BOOK_UID)) await ensureSingleType(ADDRESS_BOOK_UID, 'Address Book', addressBookContent);
  else console.log('Address Book: skipped until the schema is applied.');
  if (haveType(SETTINGS_DRAWER_UID)) await ensureSingleType(SETTINGS_DRAWER_UID, 'Settings Drawer', settingsDrawerContent);
  else console.log('Settings Drawer: skipped until the schema is applied.');
  await ensureAppDownloadLink();
  if (!apply) console.log('\nDry run — nothing written. Re-run with --apply.');
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
