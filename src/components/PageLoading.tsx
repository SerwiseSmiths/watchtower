import { dmSans } from '@/app/tickets/fonts';
import RootSidebar from '@/components/RootSidebar';

/** Automatic Next.js loading UI (see loading.tsx in each root-session page) — renders
 *  immediately on navigation, before the destination page's server-side data fetch
 *  resolves, so a click always gives instant feedback instead of a blank wait. */
export default function PageLoading() {
  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ padding: '44px 40px' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '3px solid #E5E5E5',
            borderTopColor: '#181818',
            animation: 'watchtower-spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes watchtower-spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    </div>
  );
}
