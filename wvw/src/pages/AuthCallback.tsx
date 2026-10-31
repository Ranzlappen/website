import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, call, errorMessage } from '../firebase';
import { BASE } from '../config';
import { ErrorBox, Spinner } from '../components/ui';
import { consumeOAuthState, redirectUri } from '../lib/discordAuth';

/** /auth/discord?code=…&state=… — exchange the code, sign in, go back. */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    const { ok, returnTo } = consumeOAuthState(q.get('state'));
    if (q.get('error')) {
      setError(q.get('error_description') || 'Discord login was cancelled.');
      return;
    }
    if (!code || !ok) {
      setError('Login link expired or was opened in another tab — please try again.');
      return;
    }
    (async () => {
      try {
        const { token } = await call<{ token: string }>('discordLogin', { code, redirectUri: redirectUri() });
        await signInWithCustomToken(auth, token);
        const path = returnTo.startsWith(BASE) ? `/${returnTo.slice(BASE.length)}` : '/account';
        navigate(path.includes('auth/discord') ? '/account' : path, { replace: true });
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md py-16">
      {error ? (
        <ErrorBox>
          {error} <Link to="/account" className="underline">Back</Link>
        </ErrorBox>
      ) : (
        <Spinner label="Signing you in with Discord…" />
      )}
    </div>
  );
}
