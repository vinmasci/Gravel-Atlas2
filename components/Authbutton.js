import { useUser } from '@auth0/nextjs-auth0';

export default function AuthButton() {
  const { user, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '120px',
      zIndex: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: '8px',
      borderRadius: '5px',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)'
    }}>
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px' }}>{user.name}</span>
          <a href="/api/auth/logout" className="btn btn-outline-secondary btn-sm">
            Logout
          </a>
        </div>
      ) : (
        <a href="/api/auth/login" className="btn btn-primary btn-sm">
          Login
        </a>
      )}
    </div>
  );
}