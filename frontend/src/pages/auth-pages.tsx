import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useState, useEffect, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import { FaGithub, FaGoogle } from 'react-icons/fa6';
import {
  login,
  signup,
  loginWithGoogle,
  loginWithGitHub,
  handleOAuthCallback,
  restoreSession,
} from '@/services/authService';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');
  const isLogin = mode === 'login';

  const clearErrors = () => {
    if (error) setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || oauthLoading) return;
    setError('');

    // Zod validation
    const validation = authSchema.safeParse({
      email,
      password,
      name: isLogin ? undefined : name,
      confirmPassword: isLogin ? undefined : confirmPassword,
    });

    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid form input');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }

      const session = await restoreSession();
      if (session && !session.hasCompletedOnboarding) {
        navigate('/dashboard?onboarding=1');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (loading || oauthLoading) return;
    setError('');
    setOauthLoading(provider);
    try {
      if (provider === 'google') {
        await loginWithGoogle();
      } else {
        await loginWithGitHub();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to initialize ${provider} login.`;
      setError(msg);
      setOauthLoading(null);
    }
  };

  const isSubmitting = loading || oauthLoading !== null;

  return (
    <div className="auth-layout noise">
      <aside className="auth-aside">
        <div>
          <Link href="/" className="brand" data-testid="link-auth-brand">
            <span className="logo-mark">O</span>
            <span>OpportunityOS</span>
          </Link>
          <div style={{ marginTop: 'clamp(5rem, 18vh, 10rem)', maxWidth: '450px' }}>
            <div className="eyebrow" style={{ color: 'hsl(var(--sidebar-primary))' }}>A calmer way forward</div>
            <h1 className="display" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 0.98, letterSpacing: '-.07em', marginTop: '1rem' }}>
              {isLogin ? 'Pick up where you left off.' : 'Make room for what matters.'}
            </h1>
            <p style={{ color: 'hsl(var(--sidebar-foreground) / .6)', lineHeight: 1.7, fontSize: '.85rem', maxWidth: '340px', marginTop: '1.4rem' }}>
              Your opportunities, your context, and the next small action — held in one focused workspace.
            </p>
          </div>
        </div>
        <span className="mono" style={{ fontSize: '.62rem', color: 'hsl(var(--sidebar-foreground) / .4)' }}>
          SECURED BY SUPABASE AUTH / READY FOR YOUR DATA
        </span>
      </aside>
      <main className="auth-form-side">
        <div className="auth-form">
          <Link href="/" className="brand" style={{ marginBottom: '3rem' }} data-testid="link-auth-mobile-brand">
            <span className="logo-mark">O</span>
            <span>OpportunityOS</span>
          </Link>
          <div className="eyebrow">{isLogin ? 'Welcome back' : 'Start here'}</div>
          <h2 className="display" style={{ fontSize: '2rem', letterSpacing: '-.055em', marginTop: '.6rem' }}>
            {isLogin ? 'Welcome back' : 'Create your OpportunityOS account'}
          </h2>
          <p className="muted" style={{ fontSize: '.82rem', marginTop: '.55rem', lineHeight: 1.6 }}>
            {isLogin ? 'Continue building your next opportunity.' : 'A focused place to turn possibility into a plan.'}
          </p>

          <form onSubmit={submit} style={{ marginTop: '2rem' }}>
            {!isLogin && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="label" htmlFor="name">Full name</label>
                <input
                  className="field"
                  id="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearErrors(); }}
                  autoComplete="name"
                  required
                  disabled={isSubmitting}
                  placeholder="How should we call you?"
                  data-testid="input-signup-name"
                />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="email">Email</label>
              <input
                className="field"
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
                autoComplete="email"
                required
                disabled={isSubmitting}
                placeholder="you@school.edu"
                data-testid={`input-${mode}-email`}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="password">Password</label>
              <input
                className="field"
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                disabled={isSubmitting}
                placeholder="At least 6 characters"
                data-testid={`input-${mode}-password`}
              />
            </div>
            {!isLogin && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="label" htmlFor="confirm-password">Confirm password</label>
                <input
                  className="field"
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  placeholder="Repeat your password"
                  data-testid="input-signup-confirm-password"
                />
              </div>
            )}

            {error && (
              <div className="readonly-box" role="alert" style={{ marginBottom: '1rem', color: 'hsl(var(--destructive, 0 84% 60%))', fontSize: '.78rem' }} data-testid="status-auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ width: '100%' }}
              data-testid={`button-submit-${mode}`}
            >
              {loading ? (
                <>
                  <LoaderCircle size={15} className="spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* ──────── OR ──────── divider */}
          <div
            className="auth-divider"
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1.5rem 0',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '.72rem',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'hsl(var(--border))' }} />
            <span style={{ padding: '0 .8rem', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'hsl(var(--border))' }} />
          </div>

          {/* Social OAuth Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleOAuth('google')}
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '.6rem',
                fontSize: '.82rem',
              }}
              data-testid={`button-oauth-google-${mode}`}
            >
              {oauthLoading === 'google' ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <FaGoogle size={14} />
              )}
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleOAuth('github')}
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '.6rem',
                fontSize: '.82rem',
              }}
              data-testid={`button-oauth-github-${mode}`}
            >
              {oauthLoading === 'github' ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <FaGithub size={15} />
              )}
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: '2rem', paddingTop: '1.2rem', textAlign: 'center', fontSize: '.78rem' }}>
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/signup" style={{ color: 'hsl(var(--primary))', fontWeight: 800 }} data-testid="link-switch-signup">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'hsl(var(--primary))', fontWeight: 800 }} data-testid="link-switch-login">
                  Sign In
                </Link>
              </>
            )}
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: '.8rem' }} onClick={() => navigate('/')} data-testid="button-back-home">
            Back to home
          </button>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() { return <AuthPage mode="login" />; }
export function SignupPage() { return <AuthPage mode="signup" />; }

export function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    handleOAuthCallback()
      .then((session) => {
        if (!active) return;
        if (!session.hasCompletedOnboarding) {
          navigate('/dashboard?onboarding=1');
        } else {
          navigate('/dashboard');
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Social authentication failed';
        setError(msg);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="app-frame noise" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px', padding: '2rem' }}>
          <div className="readonly-box" role="alert" style={{ color: 'hsl(var(--destructive, 0 84% 60%))', marginBottom: '1.2rem', textAlign: 'left' }} data-testid="status-oauth-callback-error">
            <strong style={{ display: 'block', marginBottom: '.3rem' }}>Authentication Failed</strong>
            <p style={{ margin: 0, fontSize: '.82rem', lineHeight: 1.5 }}>{error}</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/login')} data-testid="button-return-login">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame noise" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="loading-pulse" style={{ margin: '0 auto 1rem' }} />
        <strong className="mono" style={{ fontSize: '.75rem' }}>Completing social authentication…</strong>
      </div>
    </div>
  );
}