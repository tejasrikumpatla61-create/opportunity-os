import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { marketingDemoData } from '@/data/marketingDemoData';

export function PublicNav() {
  return (
    <header className="marketing-nav">
      <div className="page-wrap" style={{ height: '4.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <Link href="/" className="brand" data-testid="link-public-brand"><span className="logo-mark">O</span><span>OpportunityOS</span></Link>
        <nav className="marketing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }} aria-label="Public navigation">
          <a href="#how-it-works" className="muted" style={{ fontSize: '.78rem', fontWeight: 700 }} data-testid="link-how-it-works">How it works</a>
          <a href="#features" className="muted" style={{ fontSize: '.78rem', fontWeight: 700 }} data-testid="link-features">Features</a>
          <Link href="/opportunities" className="muted" style={{ fontSize: '.78rem', fontWeight: 700 }} data-testid="link-opportunities-public">Opportunities</Link>
        </nav>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          <Link href="/login" className="btn btn-outline" data-testid="link-sign-in">Sign in</Link>
          <Link href="/signup" className="btn btn-primary" data-testid="link-get-started">Get started <ArrowRight size={14} /></Link>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  return (
    <div className="noise">
      <PublicNav />
      <section className="marketing-hero">
        <div className="page-wrap">
          <div className="eyebrow rise-in">AI Opportunity Execution Agent</div>
          <h1 className="hero-title rise-in delay-1" style={{ marginTop: '1.1rem' }}>Find the opportunity.<br /><em>Know your next move.</em></h1>
          <p className="rise-in delay-2" style={{ maxWidth: '510px', fontSize: '1.02rem', lineHeight: 1.7, color: 'hsl(var(--muted-foreground))', marginTop: '1.6rem' }}>OpportunityOS turns internships, scholarships, hackathons and other student opportunities into personalized execution plans.</p>
          <div className="rise-in delay-3" style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1.7rem' }}>
            <Link href="/opportunities" className="btn btn-primary" data-testid="button-hero-start">Explore Opportunities <ArrowRight size={15} /></Link>
            <a href="#how-it-works" className="btn btn-ghost" data-testid="link-hero-how-it-works">See How It Works <ChevronRight size={15} /></a>
          </div>
          <div className="card" style={{ marginTop: '5.6rem', padding: '1rem', maxWidth: '900px' }}>
            <div className="orb-pattern" style={{ minHeight: '260px', borderRadius: '.75rem', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                <span className="pill" style={{ background: 'hsl(var(--sidebar-foreground) / .1)', color: 'hsl(var(--sidebar-foreground) / .75)' }}><span className="status-dot" style={{ color: 'hsl(var(--sidebar-primary))' }} /> Opportunity analysis</span>
                <span className="mono" style={{ fontSize: '.63rem', color: 'hsl(var(--sidebar-foreground) / .5)' }}>MARKETING DEMO</span>
              </div>
              <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 190px', gap: '1rem', alignItems: 'stretch' }}>
                <div style={{ border: '1px solid hsl(var(--sidebar-foreground) / .12)', background: 'hsl(var(--sidebar-foreground) / .06)', borderRadius: '.65rem', padding: '1rem' }}>
                  <div className="mono" style={{ fontSize: '.62rem', color: 'hsl(var(--sidebar-primary))', letterSpacing: '.1em' }}>AI INNOVATION HACKATHON</div>
                  <div className="display" style={{ fontSize: 'clamp(1.35rem, 4vw, 2.2rem)', lineHeight: 1.03, letterSpacing: '-.06em', marginTop: '.55rem' }}>A clear read<br />before you commit.</div>
                  <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    {['Undergraduate', 'Python', 'Networking'].map((item) => <span key={item} className="pill" style={{ background: 'hsl(var(--sidebar-primary) / .16)', color: 'hsl(var(--sidebar-foreground) / .85)' }}>✓ {item}</span>)}
                  </div>
                </div>
                <div style={{ border: '1px solid hsl(var(--sidebar-foreground) / .12)', background: 'hsl(var(--sidebar-foreground) / .06)', borderRadius: '.65rem', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div><div className="mono" style={{ fontSize: '.6rem', color: 'hsl(var(--sidebar-foreground) / .5)' }}>MATCH</div><div className="display" style={{ color: 'hsl(var(--sidebar-primary))', fontSize: '2.7rem', lineHeight: 1, marginTop: '.35rem' }}>92%</div><div style={{ color: 'hsl(var(--sidebar-foreground) / .7)', fontSize: '.72rem', marginTop: '.25rem' }}>Likely eligible</div></div>
                  <div><div className="mono" style={{ fontSize: '.6rem', color: 'hsl(var(--sidebar-foreground) / .5)' }}>NEXT ACTION</div><div style={{ color: 'hsl(var(--sidebar-foreground) / .85)', fontSize: '.74rem', marginTop: '.3rem' }}>Update your resume</div><div style={{ color: 'hsl(var(--sidebar-primary))', fontSize: '.68rem', marginTop: '.55rem' }}>5 days remaining</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="section-pad">
        <div className="page-wrap">
            <div className="eyebrow">How it works</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '2rem', margin: '.8rem 0 2.4rem' }}>
            <h2 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.7rem)', lineHeight: 1, letterSpacing: '-.06em', maxWidth: '620px' }}>Great opportunities shouldn't be lost between discovery and deadline.</h2>
            <p className="muted" style={{ maxWidth: '300px', lineHeight: 1.6, fontSize: '.82rem' }}>OpportunityOS bridges the gap between understanding eligibility, checking evidence, preparing documents, and knowing what to do next.</p>
          </div>
          <div className="step-list">{marketingDemoData.workflow.map((step) => <div className="step-item" key={step.step}><div className="mono eyebrow">{step.step}</div><h3 className="display" style={{ marginTop: '1.6rem', fontSize: '1.15rem' }}>{step.title}</h3><p className="muted" style={{ marginTop: '.55rem', fontSize: '.8rem', lineHeight: 1.6 }}>{step.copy}</p></div>)}</div>
        </div>
      </section>
      <section className="section-pad">
        <div className="page-wrap">
          <div className="eyebrow">The Opportunity AI system</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '2rem', margin: '.8rem 0 2.4rem', flexWrap: 'wrap' }}>
            <h2 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.7rem)', lineHeight: 1, letterSpacing: '-.06em', maxWidth: '620px' }}>Profile + resume + opportunity<br /><span className="muted">become a plan.</span></h2>
            <p className="muted" style={{ maxWidth: '300px', lineHeight: 1.6, fontSize: '.82rem' }}>OpportunityOS uses your profile and available resume evidence to understand fit and make the next step easier to see.</p>
          </div>
          <div className="step-list" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {['Student Profile', 'Resume Evidence', 'Opportunity'].map((item, index) => <div className="step-item" key={item}><div className="mono eyebrow">0{index + 1}</div><h3 className="display" style={{ marginTop: '1.6rem', fontSize: '1.15rem' }}>{item}</h3><p className="muted" style={{ marginTop: '.55rem', fontSize: '.8rem', lineHeight: 1.6 }}>{index === 2 ? 'Requirements, eligibility, deadline, and the original source link.' : index === 1 ? 'Evidence that can support skills, education, projects, and experience.' : 'Education, skills, interests, and opportunity preferences.'}</p></div>)}
          </div>
          <div style={{ textAlign: 'center', padding: '1.2rem 0', color: 'hsl(var(--primary))', fontFamily: 'var(--app-font-mono)', fontSize: '.7rem', letterSpacing: '.12em' }}>↓ OPPORTUNITY AI ↓</div>
          <div className="card" style={{ textAlign: 'center', padding: '1.35rem' }}><div className="display" style={{ fontSize: '1.35rem' }}>Personalized Action Plan</div><p className="muted" style={{ marginTop: '.5rem', fontSize: '.8rem' }}>Match, eligibility, evidence, missing requirements, and the work to do next.</p></div>
        </div>
      </section>
      <section id="features" className="section-pad" style={{ background: 'hsl(var(--muted) / .45)' }}>
        <div className="page-wrap">
          <div className="eyebrow">Built for signal</div>
          <h2 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.7rem)', lineHeight: 1, letterSpacing: '-.06em', maxWidth: '620px', margin: '.8rem 0 2.2rem' }}>Less noise.<br /><span style={{ color: 'hsl(var(--primary))' }}>More agency.</span></h2>
          <div className="feature-grid">{marketingDemoData.features.map((feature, index) => <article className={`card feature-panel card-hover${index === 0 ? ' orb-pattern' : ''}`} key={feature.title}><div><span className="pill" style={index === 0 ? { background: 'hsl(var(--sidebar-foreground) / .1)', color: 'hsl(var(--sidebar-foreground) / .7)' } : undefined}>0{index + 1}</span><h3 className="display" style={{ fontSize: '1.3rem', letterSpacing: '-.04em', marginTop: '2rem', maxWidth: '240px' }}>{feature.title}</h3></div><p style={{ fontSize: '.8rem', lineHeight: 1.65, color: index === 0 ? 'hsl(var(--sidebar-foreground) / .68)' : 'hsl(var(--muted-foreground))', maxWidth: '300px' }}>{feature.copy}</p></article>)}</div>
        </div>
      </section>
      <section className="section-pad"><div className="page-wrap"><div className="card" style={{ padding: 'clamp(1.5rem, 5vw, 4rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}><div><div className="eyebrow">Your next move</div><h2 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.7rem)', letterSpacing: '-.06em', lineHeight: 1, marginTop: '.8rem', maxWidth: '600px' }}>Your next opportunity already exists.<br /><span className="muted">Turn it into a plan.</span></h2></div><Link href="/signup" className="btn btn-primary" data-testid="button-final-start">Build My Opportunity Profile <ArrowRight size={15} /></Link></div></div></section>
      <footer style={{ borderTop: '1px solid hsl(var(--border))', padding: '1.4rem 0' }}><div className="page-wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}><span className="muted" style={{ fontSize: '.72rem' }}>OpportunityOS — a more considered way forward.</span><span className="mono muted" style={{ fontSize: '.62rem' }}>V1 / FRONTEND PREVIEW</span></div></footer>
    </div>
  );
}