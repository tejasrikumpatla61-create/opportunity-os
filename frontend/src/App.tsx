import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { LandingPage } from '@/pages/landing-page';
import {
  AddOpportunityPage,
  ApplicationsPage,
  AuthCallbackPage,
  DashboardPage,
  LoginPage,
  OpportunityAnalysisPage,
  OpportunityDetailPage,
  OpportunitiesPage,
  ProfilePage,
  SignupPage,
  TasksPage,
} from '@/pages/pages';
import NotFound from '@/pages/not-found';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient();

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

import { useEffect, useState } from 'react';
import { getStoredToken, restoreSession } from '@/services/authService';

function Authenticated({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [checking, setChecking] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    let active = true;
    const currentToken = getStoredToken();
    if (!currentToken) {
      navigate('/login');
      setChecking(false);
      return;
    }

    restoreSession().then((session) => {
      if (!active) return;
      if (!session) {
        navigate('/login');
      } else {
        setToken(session.user.id);
      }
    }).catch(() => {
      if (active) navigate('/login');
    }).finally(() => {
      if (active) setChecking(false);
    });

    return () => { active = false; };
  }, [navigate]);

  if (checking) {
    return (
      <div className="app-frame noise" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-pulse" style={{ margin: '0 auto 1rem' }} />
          <strong className="mono" style={{ fontSize: '.75rem' }}>Verifying session…</strong>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/auth/callback" component={AuthCallbackPage} />
        <Route path="/dashboard"><Authenticated><DashboardPage /></Authenticated></Route>
        <Route path="/opportunities/:id/analysis"><Authenticated><OpportunityAnalysisPage /></Authenticated></Route>
        <Route path="/opportunities/:id"><Authenticated><OpportunityDetailPage /></Authenticated></Route>
        <Route path="/opportunities"><Authenticated><OpportunitiesPage /></Authenticated></Route>
        <Route path="/applications"><Authenticated><ApplicationsPage /></Authenticated></Route>
        <Route path="/tasks"><Authenticated><TasksPage /></Authenticated></Route>
        <Route path="/profile"><Authenticated><ProfilePage /></Authenticated></Route>
        <Route path="/add-opportunity"><Authenticated><AddOpportunityPage /></Authenticated></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;