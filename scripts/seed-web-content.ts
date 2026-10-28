// Seeds the website CMS with the current serwise-website content: the `home` Web Page
// (every block, with the live copy + design styles) and the `login` single type.
// Idempotent — re-running updates the same entries and reuses already-uploaded images.
//
// Writes go through watchtower's own REST API (same path the admin uses), so watchtower
// must be running. Images are uploaded to Cloudinary + `files` exactly like the Media Library.
//
// Usage:
//   SEED_API_URL=http://localhost:3001 SEED_API_TOKEN=<full-access token> \
//     npx tsx scripts/seed-web-content.ts [path/to/serwise-website/public]
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db/prisma';
import { uploadToCloudinary } from '../src/lib/media/cloudinary';

const API_URL = (process.env.SEED_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = process.env.SEED_API_TOKEN;
const PUBLIC_DIR = path.resolve(process.argv[2] ?? path.join(__dirname, '../../serwise-website/public'));

/** Seeded images are named with this prefix so re-runs find and reuse them. */
const NAME_PREFIX = 'website-';

type Json = Record<string, unknown>;

// ─── media ───────────────────────────────────────────────────────────────────

async function asset(relativePath: string, alt: string): Promise<number> {
  const name = `${NAME_PREFIX}${relativePath.replace(/[\\/]/g, '-')}`;
  const existing = await prisma.files.findFirst({ where: { name, provider: 'cloudinary' }, orderBy: { id: 'desc' } });
  if (existing) return existing.id;

  const buffer = fs.readFileSync(path.join(PUBLIC_DIR, 'images', relativePath));
  const mime = 'image/png';
  const uploaded = await uploadToCloudinary(buffer, mime);
  const now = new Date();
  const created = await prisma.files.create({
    data: {
      name,
      alternative_text: alt,
      ext: '.png',
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

// ─── REST ────────────────────────────────────────────────────────────────────

async function api(method: string, route: string, body?: Json): Promise<Json> {
  const res = await fetch(`${API_URL}/api${route}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

// ─── style helpers (values from the Figma spec) ──────────────────────────────

const text = (s: Json) => ({ uppercase: false, ...s });
const section = (s: Json = {}) => ({ hidden: false, gradientAngle: 180, ...s });
const ACTION_LOGIN = { action: 'login' };

async function buildHomeBlocks(): Promise<Json[]> {
  const img = {
    icon: await asset('serwise_icon.png', 'Serwise logo'),
    wordmark: await asset('serwise_text.png', 'serwise'),
    footerWordmark: await asset('footer-wordmark.png', 'serwise'),
    coins: await asset('beyond/coins.png', 'Stack of gold coins'),
    technician: await asset('beyond/technician.png', 'Serwise technician holding a wrench'),
    hand: await asset('app/hand-phone.png', 'Hand holding a phone with the Serwise app'),
    qr: await asset('app/qr.png', 'QR code to download the Serwise app'),
  };

  const appliances = [
    { appliance: 'ac', title: 'Air Conditioner', description: 'Servicing, gas charging and repairs for split & window ACs.', w: 79, h: 59 },
    { appliance: 'fridge', title: 'Fridge', description: 'Cooling issues, gas refill and compressor repairs at home.', w: 68, h: 94 },
    { appliance: 'washer', title: 'Washing Machine', description: 'Drum, motor and PCB repairs for front & top load machines.', w: 65, h: 78 },
    { appliance: 'purifier', title: 'Water Purifier / RO', dropdownLabel: 'RO / Water Purifier', description: 'Filter changes, membrane service and leak fixes.', w: 87, h: 72 },
    { appliance: 'geyser', title: 'Geyser', description: 'Heating element, thermostat and installation service.', w: 90, h: 80 },
  ];
  const cards: Json[] = [];
  for (const a of appliances) {
    cards.push({
      appliance: a.appliance,
      title: a.title,
      dropdownLabel: a.dropdownLabel ?? null,
      description: a.description,
      image: await asset(`devices/cards/${a.appliance}.png`, a.title),
      thumbnail: await asset(`devices/${a.appliance}.png`, a.title),
      imageWidth: a.w,
      imageHeight: a.h,
      ctaLabel: 'Get Started',
      ctaAction: 'login',
    });
  }

  const sectionHeading = text({ color: '#000000', fontSize: 36, fontSizeMobile: 28, fontWeight: 'bold', lineHeight: 1.3, letterSpacing: -0.03 });
  const darkButton = { variant: 'dark', borderRadius: 8, fontSize: 18 };

  return [
    {
      __component: 'web.header',
      logo: img.icon,
      wordmark: img.wordmark,
      navLinks: [
        { label: 'Enterprise Benefits', action: 'scroll', href: '#enterprise', openInNewTab: false },
        { label: 'Join Serwise', action: 'join', href: null, openInNewTab: false },
      ],
      navStyle: text({ color: '#000000', fontSize: 14, fontWeight: 'bold', letterSpacing: -0.03 }),
      appButton: { label: 'Get the App', action: 'scroll', href: '#get-the-app', variant: 'outline', borderColor: '#000000', textColor: '#000000', borderRadius: 8, fontSize: 14, openInNewTab: false },
      signInButton: { label: 'Sign in', ...ACTION_LOGIN, variant: 'dark', textColor: '#FFFFFF', borderRadius: 8, fontSize: 14, openInNewTab: false },
      style: section({ paddingTop: 25, paddingBottom: 25 }),
    },
    {
      __component: 'web.hero',
      title: 'Your ultimate Service Platform',
      titleStyle: text({ color: '#1E1F24', fontSize: 56, fontSizeMobile: 34, fontWeight: 'semibold', lineHeight: 1.3, letterSpacing: -0.03 }),
      subtitle: 'Repair & Service should not be a hassle.\nHassle free service in just one tap',
      subtitleStyle: text({ color: '#B7B7B7', fontSize: 20, fontSizeMobile: 16, fontWeight: 'medium', lineHeight: 1.3, letterSpacing: -0.03 }),
      serviceLabel: 'Service type',
      servicePlaceholder: 'Select Appliance',
      addressLabel: 'Address',
      addressPlaceholder: 'Enter Your Location',
      searchBackground: '#FFFFFF',
      bookButton: { label: 'Book Now', ...ACTION_LOGIN, ...darkButton, borderRadius: 42, openInNewTab: false },
      style: section({ paddingTop: 60, paddingBottom: 110, paddingTopMobile: 32, paddingBottomMobile: 64, textAlign: 'center' }),
    },
    {
      __component: 'web.services-grid',
      heading: 'Explore All Services',
      headingStyle: sectionHeading,
      cards,
      cardBackground: '#E6E6E6',
      cardTitleStyle: text({ color: '#181818', fontSize: 19.38, fontWeight: 'semibold', letterSpacing: -0.03 }),
      cardDescriptionStyle: text({ color: '#B7B7B7', fontSize: 14.53, fontWeight: 'medium', letterSpacing: -0.03 }),
      comingSoonTitle: 'Coming Up Next',
      comingSoonDescription: 'Microwave, chimney, TV and more appliances on the way.',
      style: section({ paddingBottom: 70 }),
    },
    {
      __component: 'web.feature-grid',
      heading: 'Service & Beyond',
      headingStyle: sectionHeading,
      cards: [
        { title: 'Your Appliance, Complete history.', description: 'Track what was done and when with your appliance’s service history.', illustration: 'history' },
        { title: 'Service Booking, Simplified.', description: 'Raise a service request through our app or website and get your appliance fixed Instantly.', illustration: 'phone' },
        { title: 'Cashback Everytime.', description: 'Everytime you Book Service with Us you get Guaranteed Cashback', illustration: 'image', image: img.coins, imageWidth: 305, imageHeight: 267 },
        { title: 'Service Dates', description: 'Tired of service delays? Explore Annual plans for all your appliances.', illustration: 'image', image: img.technician, imageWidth: 312, imageHeight: 284 },
      ],
      cardBackground: '#E6E6E6',
      cardTitleStyle: text({ color: '#000000', fontSize: 26, fontSizeMobile: 22, fontWeight: 'semibold', letterSpacing: -0.03 }),
      cardDescriptionStyle: text({ color: '#000000', fontSize: 15, fontSizeMobile: 14, fontWeight: 'medium', letterSpacing: -0.03 }),
      style: section({ paddingBottom: 92, anchorId: 'enterprise' }),
    },
    {
      __component: 'web.app-promo',
      wordmark: img.wordmark,
      lead: 'Book repairs, track service requests, and stay updated - all in one app.',
      leadStyle: text({ color: '#BCBCBC', fontSize: 20, fontSizeMobile: 17, fontWeight: 'semibold', letterSpacing: -0.03 }),
      taglineTop: 'One app',
      taglineBottom: 'all you need',
      taglineStyle: text({ color: '#BCBCBC', fontSize: 54.48, fontWeight: 'bold', letterSpacing: -0.05 }),
      handImage: img.hand,
      arcColorFrom: '#9ECEFF',
      arcColorTo: '#FEFEFF',
      qrImage: img.qr,
      qrLabel: 'Scan or Tap',
      qrLink: 'https://play.google.com/store/apps/details?id=com.serwise',
      qrCardBackground: '#EDEDED',
      style: section({ backgroundColor: '#FFFFFF', anchorId: 'get-the-app' }),
    },
    {
      __component: 'web.support',
      eyebrow: 'Customer Support',
      eyebrowStyle: text({ color: '#000000', fontSize: 24, fontSizeMobile: 18, fontWeight: 'bold', letterSpacing: 0.04, uppercase: true }),
      phoneNumber: '971-2811-201',
      phoneStyle: text({ color: '#000000', fontSize: 88, fontSizeMobile: 52, fontWeight: 'extrabold', letterSpacing: -0.03 }),
      description: 'Call our helpline to book a service or get assistance from our support team.',
      descriptionStyle: text({ color: '#BCBCBC', fontSize: 20, fontSizeMobile: 17, fontWeight: 'semibold', letterSpacing: -0.03 }),
      callButton: { label: 'Call Now', action: 'call', href: '+919712811201', variant: 'pill', backgroundColor: '#C0C0C0', textColor: '#FFFFFF', borderRadius: 40, fontSize: 20, openInNewTab: false },
      style: section({ paddingTop: 96, paddingBottom: 97, textAlign: 'center', anchorId: 'support' }),
    },
    {
      __component: 'web.counter',
      label: 'Tickets Resolved & Counting',
      labelStyle: text({ color: '#BCBCBC', fontSize: 24, fontSizeMobile: 18, fontWeight: 'bold', letterSpacing: 0.04, uppercase: true }),
      value: '100000',
      animate: true,
      digitColor: '#FFFFFF',
      style: section({ backgroundColor: '#313131', paddingTop: 45, paddingBottom: 55, anchorId: 'tickets' }),
    },
    {
      __component: 'web.help-cta',
      title: 'Help is just a tap away!',
      titleStyle: text({ color: '#000000', fontSize: 44.27, fontSizeMobile: 30, fontWeight: 'semibold', letterSpacing: 0.02 }),
      button: { label: 'Book Now', ...ACTION_LOGIN, variant: 'dark', borderRadius: 9, fontSize: 27.55, openInNewTab: false },
      citiesLabel: 'Available Cities',
      citiesLabelStyle: text({ color: '#BCBCBC', fontSize: 18, fontSizeMobile: 15, fontWeight: 'semibold', letterSpacing: -0.03 }),
      cities: [{ name: 'Surat' }, { name: 'Ahmedabad' }, { name: 'Vadodara' }],
      cityStyle: text({ color: '#000000', fontSize: 22, fontSizeMobile: 18, fontWeight: 'semibold', letterSpacing: -0.03 }),
      style: section({ paddingTop: 43, textAlign: 'center', anchorId: 'join' }),
    },
    {
      __component: 'web.footer',
      links: [
        { label: 'Terms & Conditions', action: 'link', href: '/terms', openInNewTab: false },
        { label: 'Privacy Policy', action: 'link', href: '/privacy', openInNewTab: false },
        { label: 'Refund Policy', action: 'link', href: '/refund', openInNewTab: false },
        { label: 'Contact Us', action: 'call', href: '+919712811201', openInNewTab: false },
      ],
      linkStyle: text({ color: '#BCBCBC', fontSize: 18, fontSizeMobile: 14, fontWeight: 'bold', letterSpacing: -0.03 }),
      wordmark: img.footerWordmark,
      style: section({ paddingTop: 54, textAlign: 'center' }),
    },
  ];
}

async function seedHome() {
  console.log('Web Page: home');
  const data = {
    title: 'Home',
    handle: 'home',
    seoTitle: 'Serwise | Your Ultimate Service Platform',
    seoDescription: 'Appliance repair & service at home. Book AC, fridge, washing machine, RO and geyser service in one tap.',
    blocks: await buildHomeBlocks(),
  };

  const found = (await api('GET', '/web-pages?filters[handle][$eq]=home&status=draft')) as { data?: Json[] };
  const existing = found.data?.[0];
  const saved = existing
    ? ((await api('PUT', `/web-pages/${existing.documentId}`, { data })) as { data: Json }).data
    : ((await api('POST', '/web-pages', { data })) as { data: Json }).data;
  console.log(`  ${existing ? 'updated' : 'created'} draft ${saved.documentId}`);

  await api('POST', `/web-pages/${saved.documentId}/actions/publish`);
  console.log('  published');
}

async function seedLogin() {
  console.log('Login');
  const logo = await asset('serwise_icon.png', 'Serwise logo');
  await api('PUT', '/login', {
    data: {
      logo,
      phoneTitle: 'Mobile No.',
      phoneLabel: 'Enter Phone Number',
      phonePlaceholder: '00000 00000',
      termsPrefix: 'By continuing, you agree to our',
      termsLabel: 'Terms and Conditions',
      termsUrl: '/terms',
      privacyLabel: 'Privacy Policy',
      privacyUrl: '/privacy',
      continueLabel: 'Continue',
      otpTitle: 'OTP',
      otpLabel: 'Enter OTP to Proceed',
      otpSubtitle: 'We’ve sent a One-Time Password (OTP) to {phone}.',
      resendCountdownText: 'Get new code ({seconds} seconds)',
      resendLabel: 'Get new code',
      backLabel: 'Back',
      verifyLabel: 'Continue',
      welcomeTitle: 'Welcome, {name}!',
      signedInTitle: 'You’re signed in',
      newUserMessage: 'Your Serwise account is ready. Get the app to add your appliances and book your first service.',
      returningUserMessage: 'Book services, track tickets and view your appliance history in the Serwise app.',
      doneLabel: 'Done',
      style: {
        panelBackground: '#FFFFFF',
        backdropColor: 'rgba(0, 0, 0, 0.45)',
        titleColor: '#000000',
        titleSize: 32,
        textColor: '#181818',
        mutedColor: '#6B6B6B',
        inputBackground: '#FFFFFF',
        inputBorderColor: '#E5E5E5',
        accentColor: '#0D886C',
        buttonGradientFrom: '#4D4D4D',
        buttonGradientTo: '#09101F',
        buttonTextColor: '#FFFFFF',
        borderRadius: 15,
      },
    },
  });
  console.log('  saved');
}

async function main() {
  if (!TOKEN) throw new Error('Set SEED_API_TOKEN to a full-access watchtower API token');
  if (!fs.existsSync(path.join(PUBLIC_DIR, 'images'))) throw new Error(`No images folder under ${PUBLIC_DIR}`);
  console.log(`Seeding ${API_URL} (images from ${PUBLIC_DIR})`);
  await seedHome();
  await seedLogin();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
