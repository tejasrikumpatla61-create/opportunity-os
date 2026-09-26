import { Bell, ClipboardCheck, Compass, LayoutDashboard, LogOut, Menu, Plus, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Brand } from '@/components/brand';
import { OpportunityAi } from '@/components/ai-assistant';
import { OnboardingWizard } from '@/components/onboarding-wizard';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: Compass },
  { href: '/applications', label: 'Applications', icon: ClipboardCheck },
  { href: '/tasks', label: 'Tasks', icon: ClipboardCheck },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: typeof LayoutDashboard; onClick?: () => void }) {
  const [location, navigate] = useLocation();
  const active = location === href || (href !== '/dashboard' && location.startsWith(`${href}/`));
  return (
    <Link href={href} className={`nav-link${active ? ' active' : ''}`} onClick={onClick} data-testid={`link-${label.toLowerCase()}`}>
      <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
    </Link>
  );
}

import { logout, getStoredUser } from '@/services/authService';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [location, navigate] = useLocation();
  const currentUser = getStoredUser();

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-frame noise">
      <aside className={`sidebar${mobileOpen ? ' mobile-visible' : ''}`} aria-label="Application navigation">
        <Brand />
        <div className="nav-section-label">Workspace</div>
        <nav>
          {navItems.map((item) => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
        </nav>
        <div className="nav-section-label">Quick action</div>
        <Link href="/add-opportunity" className="nav-link" onClick={() => setMobileOpen(false)} data-testid="link-add-opportunity"><Plus size={17} /><span>Add opportunity</span></Link>
        <div className="sidebar-footer">
          <div className="user-mini">
            <span className="avatar">{currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : '—'}</span>
            <div><div style={{ fontSize: '.75rem', fontWeight: 700 }}>{currentUser?.full_name || currentUser?.email || 'Your workspace'}</div><div className="mono" style={{ fontSize: '.6rem', color: 'hsl(var(--sidebar-foreground) / .5)' }}>AUTHENTICATED</div></div>
          </div>
          <button className="nav-link" style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer' }} onClick={signOut} data-testid="button-sign-out"><LogOut size={17} /><span>Sign out</span></button>
        </div>
      </aside>
      <div className="main-frame">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
            <button className="icon-btn mobile-menu" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} data-testid="button-mobile-menu">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
            <span className="topbar-title">{navItems.find((item) => location === item.href)?.label ?? 'Workspace'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <button className="icon-btn" onClick={() => setNotice(true)} aria-label="View notifications" data-testid="button-notifications"><Bell size={17} /></button>
            <Link href="/profile" className="avatar" aria-label="Open profile" data-testid="link-user-profile">—</Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map((item) => <NavLink key={item.href} {...item} />)}
      </nav>
      <OpportunityAi />
      {(new URLSearchParams(window.location.search).get('onboarding') === 'preview' || new URLSearchParams(window.location.search).get('onboarding') === '1') && <OnboardingWizard preview={new URLSearchParams(window.location.search).get('onboarding') === 'preview'} onClose={() => navigate('/dashboard')} />}
      {notice && <div className="toast-note" role="status" data-testid="status-notice"><div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}><span>{'Session updated.'}</span><button className="icon-btn" style={{ color: 'inherit', width: '1.6rem', height: '1.6rem' }} onClick={() => setNotice(false)} aria-label="Dismiss notice" data-testid="button-dismiss-notice"><X size={14} /></button></div></div>}
    </div>
  );
}