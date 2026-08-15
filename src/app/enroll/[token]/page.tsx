import { checkEnrollment } from '@/lib/auth/enrollment';
import EnrollForm from './EnrollForm';

export default async function EnrollPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = await checkEnrollment(token);

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100" style={{ background: '#F2F2F2' }}>
      <div className="bg-white rounded-4 p-4" style={{ width: 420, maxWidth: '90vw' }}>
        <h1 className="fw-bold mb-1" style={{ fontSize: 32, letterSpacing: '-0.03em', color: '#181818' }}>
          Register device
        </h1>
        {!check.ok ? (
          <p className="mb-0" style={{ color: '#B7B7B7', fontWeight: 500 }}>
            {check.error}
          </p>
        ) : (
          <EnrollForm token={token} />
        )}
      </div>
    </div>
  );
}
