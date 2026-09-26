import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import { login, signup, restoreSession } from '@/services/authService';

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
  const [error, setError] = useState('');
  const isLogin = mode === 'login';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
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
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
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
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
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

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }} data-testid={`button-submit-${mode}`}>
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

          <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: '2rem', paddingTop: '1.2rem', textAlign: 'center', fontSize: '.78rem' }}>
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/signup" style={{ color: 'hsl(var(--primary))', fontWeight: 800 }} data-testid="link-switch-signup">
                  Create account
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