'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(provider: 'google' | 'github') {
    const supabase = getBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSignOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    setShowMenu(false);
    window.location.reload();
  }

  if (loading) {
    return (
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--border)',
        }}
      />
    );
  }

  if (user) {
    const avatarUrl =
      user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User';

    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '20px',
            transition: 'background 0.2s',
          }}
          aria-label="Account menu"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: '50%' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--civic)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {displayName[0].toUpperCase()}
            </div>
          )}
        </button>

        {showMenu && (
          <>
            <div
              onClick={() => setShowMenu(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 199,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '8px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                minWidth: '200px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                zIndex: 200,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Not signed in: show sign-in button
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: '6px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'white',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
          color: 'var(--ink)',
        }}
      >
        Sign in
      </button>

      {showMenu && (
        <>
          <div
            onClick={() => setShowMenu(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 199,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '8px',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '220px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              zIndex: 200,
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              Sign in to Civic Brief
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                marginBottom: '16px',
              }}
            >
              Track your briefs and get higher usage limits.
            </div>
            <button
              onClick={() => handleSignIn('google')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px',
                transition: 'background 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleSignIn('github')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.037 0 0 4.037 0 9c0 3.975 2.578 7.35 6.154 8.542.45.083.614-.195.614-.433 0-.213-.008-.78-.012-1.53-2.503.544-3.032-1.206-3.032-1.206-.41-1.04-.999-1.316-.999-1.316-.816-.558.062-.546.062-.546.903.063 1.378.926 1.378.926.803 1.374 2.106.977 2.62.747.081-.581.313-.977.57-1.201-1.998-.227-4.1-.999-4.1-4.449 0-.983.352-1.786.928-2.415-.093-.228-.402-1.143.088-2.382 0 0 .756-.242 2.475.923A8.63 8.63 0 019 4.373a8.63 8.63 0 012.252.303c1.718-1.165 2.473-.923 2.473-.923.491 1.24.182 2.154.09 2.382.577.629.926 1.432.926 2.415 0 3.458-2.105 4.22-4.11 4.442.323.278.611.828.611 1.668 0 1.203-.012 2.175-.012 2.47 0 .24.162.52.618.432C15.425 16.346 18 12.972 18 9c0-4.963-4.037-9-9-9z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>
        </>
      )}
    </div>
  );
}
