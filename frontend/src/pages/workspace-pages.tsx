import {
  ArrowRight, CalendarDays, Check, CircleHelp, ClipboardList, Clock3, Compass, ExternalLink,
  FileText, Filter, Globe2, Inbox, Link2, LockKeyhole, MoreHorizontal, Plus, Search,
  Settings2, Sparkles, Target, Trash2, Upload, UserRound, X, Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { OpportunityCard } from '@/components/opportunity-card';
import { analyzeOpportunity } from '@/services/analysisService';
import { ApiError } from '@/services/api-client';
import { getOpportunity, listOpportunities } from '@/services/opportunityService';
import { updateProfile } from '@/services/profileService';
import type { Opportunity, OpportunityAnalysis, OpportunityType } from '@/types/domain';
import { isSafeExternalUrl } from '@/utils/safe-url';

const opportunityFilters: { value: OpportunityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hackathon', label: 'Hackathons' },
  { value: 'internship', label: 'Internships' },
  { value: 'scholarship', label: 'Scholarships' },
  { value: 'fellowship', label: 'Fellowships' },
  { value: 'competition', label: 'Competitions' },
];

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 style={{ marginTop: '.55rem' }}>{title}</h1><p>{description}</p></div>{action}</div>;
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: LucideIcon; title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><div><div className="empty-icon"><Icon size={23} /></div><h2>{title}</h2><p>{copy}</p>{action}</div></div>;
}

function ServiceState({ loading, error, emptyTitle, emptyCopy, action }: { loading: boolean; error: string; emptyTitle: string; emptyCopy: string; action?: ReactNode }) {
  if (loading) return <div className="service-state" role="status"><div className="loading-pulse" /><strong>Loading connected opportunities…</strong><span className="muted">Waiting for the opportunity service.</span></div>;
  if (error) return <div className="service-state" role="alert"><div className="empty-icon"><Globe2 size={21} /></div><strong>Opportunity service unavailable</strong><span className="muted">{error}</span><span className="muted">No sample records are being shown.</span></div>;
  return <EmptyState icon={Compass} title={emptyTitle} copy={emptyCopy} action={action} />;
}

function useOpportunities(query: { search?: string; type?: OpportunityType } = {}) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listOpportunities(query).then((result) => {
      if (active) setItems(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof ApiError ? reason.message : 'The opportunity service could not be reached.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [query.search, query.type]);
  return { items, loading, error };
}

import { getPersonalizedFeed, dismissFeedCheckpoint, type PersonalizedFeed } from '@/services/feedService';

export function DashboardPage() {
  const [feed, setFeed] = useState<PersonalizedFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'hackathon' | 'internship' | 'scholarship' | 'fellowship' | 'closing_soon'>('all');

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getPersonalizedFeed();
      setFeed(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load personalized feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleDismissNotice = async () => {
    setDismissedNotice(true);
    try {
      await dismissFeedCheckpoint();
    } catch {
      // Ignored for UI responsiveness
    }
  };

  const newForYou = feed?.new_for_you || [];
  const bestMatches = feed?.best_matches || [];
  const newCount = (!dismissedNotice && feed?.new_matches_count) ? feed.new_matches_count : 0;

  return (
    <div className="app-content">
      <PageHeading
        eyebrow="Workspace / intelligence"
        title="Good to see you."
        description="Fresh, verified opportunities matched directly against your profile."
        action={
          <Link href="/opportunities" className="btn btn-primary" data-testid="button-dashboard-library">
            <Compass size={15} /> Explore library
          </Link>
        }
      />

      {/* 1. Compact New Opportunities Notification */}
      {newCount > 0 && (
        <aside
          className="card"
          role="status"
          style={{
            background: 'hsl(var(--primary) / .08)',
            borderColor: 'hsl(var(--primary) / .3)',
            padding: '.75rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}
          data-testid="notification-new-opportunities"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
            <span className="pill pill-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
              <Sparkles size={13} /> {newCount} NEW
            </span>
            <span style={{ fontSize: '.84rem', fontWeight: 500 }}>
              {newCount} new opportunit{newCount === 1 ? 'y' : 'ies'} match your profile
            </span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <a
              href="#new-for-you"
              className="btn btn-primary"
              style={{ padding: '.25rem .75rem', fontSize: '.75rem' }}
              data-testid="button-view-new-matches"
            >
              View opportunities
            </a>
            <button
              className="btn btn-outline"
              style={{ padding: '.25rem .75rem', fontSize: '.75rem' }}
              onClick={handleDismissNotice}
              data-testid="button-dismiss-notification"
            >
              Dismiss
            </button>
          </div>
        </aside>
      )}

      {/* 2. New For You Section (if available) */}
      {newForYou.length > 0 && (
        <section id="new-for-you" className="card opportunity-section" style={{ marginBottom: '1.2rem' }}>
          <div className="card-header opportunity-section-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <div className="card-title">New for You</div>
                <span className="pill pill-teal" style={{ fontSize: '.65rem' }}>FRESH LIVE DISCOVERY</span>
              </div>
              <p className="muted" style={{ marginTop: '.25rem', fontSize: '.72rem' }}>
                Verified opportunities discovered since your last checkpoint matching your skillset.
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="opportunity-grid">
              {newForYou.map((item) => (
                <OpportunityCard key={item.id} opportunity={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Best Matches Section */}
      <section className="card opportunity-section" style={{ marginBottom: '1.2rem' }}>
        <div className="card-header opportunity-section-header">
          <div>
            <div className="card-title">Best Matches</div>
            <p className="muted" style={{ marginTop: '.25rem', fontSize: '.72rem' }}>
              Deterministic ranking based on your skills, interests, and academic background.
            </p>
          </div>
          <Link href="/opportunities" className="btn btn-ghost" data-testid="link-dashboard-opportunities">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="card service-state" role="status">
              <div className="loading-pulse" />
              <strong>Loading personalized feed…</strong>
            </div>
          ) : error ? (
            <ServiceState loading={false} error={error} emptyTitle="Feed temporarily unavailable" emptyCopy="Unable to reach the feed service." />
          ) : !bestMatches.length ? (
            <ServiceState loading={false} error="" emptyTitle="No matched opportunities yet" emptyCopy="Complete your profile with skills and interests to see personalized recommendations." />
          ) : (
            <div className="opportunity-grid">
              {bestMatches.map((item) => (
                <OpportunityCard key={item.id} opportunity={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Categorized Opportunities Section */}
      <section className="card opportunity-section">
        <div className="card-header opportunity-section-header">
          <div>
            <div className="card-title">Explore by Category</div>
            <p className="muted" style={{ marginTop: '.25rem', fontSize: '.72rem' }}>
              Curated feeds for scholarships, internships, hackathons, and fellowships.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div className="filter-chips" role="group" aria-label="Category filters">
            <button
              type="button"
              className={`theme-option${activeTab === 'all' ? ' active' : ''}`}
              onClick={() => setActiveTab('all')}
              data-testid="tab-all"
            >
              All Live
            </button>
            <button
              type="button"
              className={`theme-option${activeTab === 'hackathon' ? ' active' : ''}`}
              onClick={() => setActiveTab('hackathon')}
              data-testid="tab-hackathon"
            >
              Hackathons ({feed?.latest_hackathons?.length || 0})
            </button>
            <button
              type="button"
              className={`theme-option${activeTab === 'internship' ? ' active' : ''}`}
              onClick={() => setActiveTab('internship')}
              data-testid="tab-internship"
            >
              Internships ({feed?.latest_internships?.length || 0})
            </button>
            <button
              type="button"
              className={`theme-option${activeTab === 'scholarship' ? ' active' : ''}`}
              onClick={() => setActiveTab('scholarship')}
              data-testid="tab-scholarship"
            >
              Scholarships ({feed?.latest_scholarships?.length || 0})
            </button>
            <button
              type="button"
              className={`theme-option${activeTab === 'fellowship' ? ' active' : ''}`}
              onClick={() => setActiveTab('fellowship')}
              data-testid="tab-fellowship"
            >
              Fellowships ({feed?.latest_fellowships?.length || 0})
            </button>
            <button
              type="button"
              className={`theme-option${activeTab === 'closing_soon' ? ' active' : ''}`}
              onClick={() => setActiveTab('closing_soon')}
              data-testid="tab-closing-soon"
            >
              Closing Soon ({feed?.closing_soon?.length || 0})
            </button>
          </div>

          {activeTab === 'scholarship' && (
            feed?.latest_scholarships?.length ? (
              <div className="opportunity-grid">
                {feed.latest_scholarships.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No verified new scholarships available right now.</p>
              </div>
            )
          )}

          {activeTab === 'internship' && (
            feed?.latest_internships?.length ? (
              <div className="opportunity-grid">
                {feed.latest_internships.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No verified new internships available right now.</p>
              </div>
            )
          )}

          {activeTab === 'hackathon' && (
            feed?.latest_hackathons?.length ? (
              <div className="opportunity-grid">
                {feed.latest_hackathons.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No verified hackathons available right now.</p>
              </div>
            )
          )}

          {activeTab === 'fellowship' && (
            feed?.latest_fellowships?.length ? (
              <div className="opportunity-grid">
                {feed.latest_fellowships.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No verified fellowships or programs available right now.</p>
              </div>
            )
          )}

          {activeTab === 'closing_soon' && (
            feed?.closing_soon?.length ? (
              <div className="opportunity-grid">
                {feed.closing_soon.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No opportunities are closing within the next 14 days.</p>
              </div>
            )
          )}

          {activeTab === 'all' && (
            bestMatches.length ? (
              <div className="opportunity-grid">
                {bestMatches.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : (
              <div className="readonly-box" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>No live opportunities connected yet.</p>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

export function OpportunitiesPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'newest'>('deadline-asc');
  const { items, loading, error } = useOpportunities();

  const locations = useMemo(() => {
    const locSet = new Set<string>();
    items.forEach((item) => {
      if (item.location) locSet.add(item.location);
    });
    return Array.from(locSet);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = items.filter((item) => {
      if (q) {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const orgMatch = (item.organization || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        if (!titleMatch && !orgMatch && !descMatch) return false;
      }
      if (type !== 'all') {
        const itemType = (item.opportunity_type || item.type || '').toLowerCase();
        if (itemType !== type.toLowerCase()) return false;
      }
      if (locationFilter !== 'all') {
        if ((item.location || '').toLowerCase() !== locationFilter.toLowerCase()) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'deadline-asc') {
        const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return dateA - dateB;
      }
      if (sortBy === 'deadline-desc') {
        const dateA = a.deadline ? new Date(a.deadline).getTime() : -Infinity;
        const dateB = b.deadline ? new Date(b.deadline).getTime() : -Infinity;
        return dateB - dateA;
      }
      if (sortBy === 'newest') {
        const dateA = (a as Record<string, unknown>).created_at ? new Date(String((a as Record<string, unknown>).created_at)).getTime() : 0;
        const dateB = (b as Record<string, unknown>).created_at ? new Date(String((b as Record<string, unknown>).created_at)).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [items, query, type, locationFilter, sortBy]);
  return (
    <div className="app-content">
      <PageHeading
        eyebrow="Discovery / library"
        title="Opportunities"
        description="Search your connected opportunity library. Records come from the opportunity service."
        action={
          <Link href="/add-opportunity" className="btn btn-primary" data-testid="button-opportunities-add">
            <Plus size={15} /> Add opportunity
          </Link>
        }
      />
      <div className="filters" style={{ flexWrap: 'wrap', gap: '.6rem' }}>
        <div className="search-wrap" style={{ flex: '1 1 220px' }}>
          <Search size={16} />
          <label htmlFor="opportunity-search" className="sr-only">Search opportunities</label>
          <input
            id="opportunity-search"
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or organization"
            data-testid="input-opportunity-search"
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={14} style={{ position: 'absolute', left: '.72rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
          <label htmlFor="opportunity-type" className="sr-only">Filter by type</label>
          <select
            id="opportunity-type"
            className="field"
            style={{ paddingLeft: '2rem', minWidth: '140px' }}
            value={type}
            onChange={(event) => setType(event.target.value as OpportunityType | 'all')}
            data-testid="select-opportunity-type"
          >
            <option value="all">All types</option>
            {opportunityFilters.slice(1).map((item) => (
              <option value={item.value} key={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="opportunity-location" className="sr-only">Filter by location</label>
          <select
            id="opportunity-location"
            className="field"
            style={{ minWidth: '140px' }}
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            data-testid="select-opportunity-location"
          >
            <option value="all">All locations</option>
            {locations.map((loc) => (
              <option value={loc} key={loc}>{loc}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="opportunity-sort" className="sr-only">Sort opportunities</label>
          <select
            id="opportunity-sort"
            className="field"
            style={{ minWidth: '160px' }}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as 'deadline-asc' | 'deadline-desc' | 'newest')}
            data-testid="select-opportunity-sort"
          >
            <option value="deadline-asc">Deadline (earliest first)</option>
            <option value="deadline-desc">Deadline (latest first)</option>
            <option value="newest">Newest added</option>
          </select>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => { setQuery(''); setType('all'); setLocationFilter('all'); setSortBy('deadline-asc'); }}
          data-testid="button-clear-opportunity-filters"
        >
          Clear
        </button>
      </div>
      <div className="card">
        {loading || error || !filteredItems.length ? (
          <ServiceState
            loading={loading}
            error={error}
            emptyTitle={query || type !== 'all' || locationFilter !== 'all' ? 'No connected opportunities match yet' : 'Your opportunity library is clear'}
            emptyCopy={query || type !== 'all' || locationFilter !== 'all' ? 'These filters are ready for your data. Try adjusting your query or clearing filters.' : 'Save internships, scholarships, hackathons, fellowships, and programs here. No sample listings are shown in your workspace.'}
            action={
              <Link href="/add-opportunity" className="btn btn-primary" data-testid="button-empty-add-opportunity">
                <Link2 size={14} /> Add from a link
              </Link>
            }
          />
        ) : (
          <div className="opportunity-grid">
            {filteredItems.map((item) => (
              <OpportunityCard key={item.id} opportunity={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!id) { setLoading(false); return undefined; }
    getOpportunity(id).then((result) => { if (active) setOpportunity(result); }).catch((reason: unknown) => { if (active) setError(reason instanceof ApiError ? reason.message : 'The opportunity service could not be reached.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const sourceUrl = opportunity?.source_url;
  const safeSourceUrl = sourceUrl && isSafeExternalUrl(sourceUrl) ? sourceUrl : null;
  return <div className="app-content"><Link href="/opportunities" className="btn btn-ghost" style={{ paddingLeft: 0, marginBottom: '1.2rem' }} data-testid="link-back-opportunities"><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to opportunities</Link>{loading ? <div className="card service-state" role="status"><div className="loading-pulse" /><strong>Loading opportunity details…</strong><span className="muted">Waiting for the opportunity service.</span></div> : error || !opportunity ? <div className="card"><ServiceState loading={false} error={error} emptyTitle="Opportunity details are not connected" emptyCopy="This route will display the title, organization, requirements, and source link supplied by the backend. No record was inferred." action={<Link href="/opportunities" className="btn btn-outline">Back to library <ArrowRight size={14} /></Link>} /></div> : <div className="details-grid"><div><section className="card detail-hero"><div className="eyebrow">Opportunity / {opportunity.id}</div><h1 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.3rem)', lineHeight: 1, letterSpacing: '-.06em', marginTop: '.8rem' }}>{opportunity.title}</h1><p className="muted" style={{ maxWidth: '590px', lineHeight: 1.7, fontSize: '.85rem', marginTop: '1rem' }}>{opportunity.description || 'Details supplied by the connected opportunity service.'}</p><div className="detail-meta">{opportunity.organization && <span className="pill">{opportunity.organization}</span>}{opportunity.location && <span className="pill">{opportunity.location}</span>}{opportunity.deadline && <span className="pill"><CalendarDays size={12} /> {opportunity.deadline}</span>}</div></section><section className="card" style={{ marginTop: '1rem' }}><div className="card-header"><div className="card-title">Analyze my fit</div><Sparkles size={16} className="muted" /></div><div className="card-body"><div className="readonly-box"><div className="mono eyebrow">CREWAI VIA FASTAPI</div><p style={{ fontSize: '.8rem', lineHeight: 1.6, marginTop: '.45rem' }}>Analysis will use your connected profile, resume evidence, and this opportunity. Scores and eligibility are never calculated in the browser.</p></div><Link href={`/opportunities/${opportunity.id}/analysis?run=1`} className="btn btn-primary" style={{ marginTop: '1rem' }} data-testid="button-detail-analyze"><Sparkles size={14} /> Analyze My Fit</Link></div></section></div><aside className="card"><div className="card-header"><div className="card-title">Actions</div><MoreHorizontal size={16} className="muted" /></div><div className="card-body" style={{ display: 'grid', gap: '.55rem' }}><button className="btn btn-outline" disabled data-testid="button-save-opportunity"><Plus size={14} /> Save opportunity</button>{safeSourceUrl ? <a className="btn btn-outline" href={safeSourceUrl} target="_blank" rel="noreferrer" data-testid="button-open-opportunity"><ExternalLink size={14} /> View Original Opportunity</a> : <button className="btn btn-outline" disabled data-testid="button-open-opportunity"><ExternalLink size={14} /> Official link unavailable</button>}<p className="muted" style={{ fontSize: '.72rem', lineHeight: 1.55, marginTop: '.45rem' }}>Save and source-link actions use backend-supplied records only.</p></div></aside></div>}</div>;
}

const analysisStages = ['Reviewing your profile…', 'Comparing opportunity requirements…', 'Checking eligibility…', 'Identifying gaps…', 'Building your action plan…'];

function StringList({ title, items, emptyCopy }: { title: string; items: string[]; emptyCopy?: string }) {
  return <section className="analysis-section"><div className="card-title">{title}</div>{items.length ? <ul className="analysis-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : emptyCopy ? <p className="muted analysis-empty">{emptyCopy}</p> : null}</section>;
}

function AnalysisResult({ result }: { result: OpportunityAnalysis }) {
  const sourceUrl = result.sourceUrl;
  const safeSourceUrl = sourceUrl && isSafeExternalUrl(sourceUrl) ? sourceUrl : null;
  return <div className="analysis-result">
    <div className="analysis-result-hero">
      {result.matchScore !== undefined && <div>
        <span className="mono eyebrow">MATCH</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', flexWrap: 'wrap' }}>
          <strong className="analysis-score">{result.matchScore}%</strong>
          {result.matchLevel && <span className="pill pill-teal" style={{ textTransform: 'uppercase' }}>{result.matchLevel}</span>}
        </div>
        <span className="muted" style={{ display: 'block', marginTop: '.25rem' }}>Backend match score & level</span>
      </div>}
      {result.eligibilityStatus && <div>
        <span className="mono eyebrow">ELIGIBILITY</span>
        <strong className="analysis-status">{result.eligibilityStatus}</strong>
        {result.eligibilitySummary && <span className="muted" style={{ display: 'block', marginTop: '.25rem' }}>{result.eligibilitySummary}</span>}
      </div>}
    </div>
    <StringList title="Matched skills" items={result.matchedSkills} emptyCopy="No matched skills returned." />
    {result.skillsWithNoEvidence && result.skillsWithNoEvidence.length > 0 && (
      <StringList title="Skills with no evidence" items={result.skillsWithNoEvidence} />
    )}
    <div className="analysis-columns">
      <StringList title="Satisfied" items={result.matchedRequirements} emptyCopy="No satisfied requirements returned." />
      <StringList title="Missing" items={result.missingRequirements} emptyCopy="No missing requirements returned." />
      <StringList title="Needs confirmation" items={result.unknownRequirements} emptyCopy="No unknown requirements returned." />
    </div>
    <div className="analysis-columns">
      <StringList title="Documents" items={result.documentsNeeded} emptyCopy="No documents requested." />
      <StringList title="Blockers" items={result.applicationBlockers} emptyCopy="No confirmed blockers." />
    </div>
    <StringList title="Action plan" items={result.tasks.map((task) => (typeof task === 'string' ? task : task.title))} emptyCopy="No action plan tasks returned." />
    {result.recommendedNextAction && result.recommendedNextAction.trim() !== '' && (
      <div className="readonly-box analysis-next-action">
        <div className="mono eyebrow">NEXT ACTION</div>
        <strong>{result.recommendedNextAction}</strong>
      </div>
    )}
    <div style={{ marginTop: '1.4rem' }}>
      {safeSourceUrl ? (
        <a className="btn btn-outline" href={safeSourceUrl} target="_blank" rel="noreferrer" data-testid="button-analysis-source-link">
          <ExternalLink size={14} /> View Original Opportunity
        </a>
      ) : (
        <button className="btn btn-outline" disabled data-testid="button-analysis-source-link">
          <ExternalLink size={14} /> Official link unavailable
        </button>
      )}
    </div>
  </div>;
}

export function OpportunityAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<OpportunityAnalysis | null>(null);
  const [error, setError] = useState('');
  const shouldRun = new URLSearchParams(location.split('?')[1] || '').get('run') === '1';
  const runAnalysis = useCallback(async () => {
    if (!id) return;
    setStatus('loading');
    setStage(0);
    setResult(null);
    setError('');
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, analysisStages.length - 1)), 3500);
    try {
      const analysis = await analyzeOpportunity(id);
      setResult(analysis);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof ApiError ? err.message : 'We couldn’t complete the analysis right now. Please try again.';
      setError(msg);
    } finally {
      window.clearInterval(timer);
    }
  }, [id]);
  useEffect(() => {
    if (shouldRun) void runAnalysis();
  }, [runAnalysis, shouldRun]);
  return <div className="app-content"><PageHeading eyebrow={`Analysis / ${id || 'unknown'}`} title="Readiness before certainty." description="The analysis surface displays only the response returned by FastAPI and CrewAI." action={<Link href={`/opportunities/${id || 'new'}`} className="btn btn-outline" data-testid="button-analysis-back">Back to opportunity</Link>} /><div className="card analysis-card"><div className="card-body">{status === 'loading' && <div className="analysis-processing" role="status"><div className="ai-processing-orb"><Sparkles size={22} /></div><h2 className="display">Building your read</h2><p className="muted">This progress is visual only while the backend analyzes your context.</p><div className="analysis-stage-list">{analysisStages.map((item, index) => <div className={index <= stage ? 'active' : ''} key={item}><span>{index < stage ? <Check size={13} /> : index === stage ? <span className="status-dot" /> : index + 1}</span>{item}</div>)}</div></div>}{status === 'error' && <div className="analysis-processing" role="alert"><div className="empty-icon"><Sparkles size={23} /></div><h2 className="display">Analysis unavailable</h2><p className="muted">{error}</p><button className="btn btn-primary" onClick={() => void runAnalysis()} data-testid="button-retry-analysis">Retry analysis <ArrowRight size={14} /></button></div>}{status === 'success' && result && <AnalysisResult result={result} />}{status === 'idle' && <div className="analysis-processing"><div className="empty-icon"><Sparkles size={23} /></div><h2 className="display">Analysis is ready when you are</h2><p className="muted">No score or eligibility result is shown until the backend returns one for this opportunity and your connected profile.</p><button className="btn btn-primary" onClick={() => navigate(`/opportunities/${id || 'new'}/analysis?run=1`)} data-testid="button-start-analysis"><Sparkles size={14} /> Analyze My Fit</button></div>}</div></div></div>;
}

export function ApplicationsPage() {
  return <div className="app-content"><PageHeading eyebrow="Execution / pipeline" title="Applications" description="A simple view of what you are preparing, submitting, and following up on." action={<button className="btn btn-primary" disabled data-testid="button-new-application"><Plus size={15} /> New application</button>} /><div className="card"><EmptyState icon={ClipboardList} title="No applications yet" copy="Saved opportunities will appear here when your application workflow is connected. Nothing is pre-populated." action={<Link href="/opportunities" className="btn btn-outline" data-testid="button-applications-browse">Browse opportunities <ArrowRight size={14} /></Link>} /></div></div>;
}

export function TasksPage() {
  return <div className="app-content"><PageHeading eyebrow="Execution / focus" title="Tasks" description="Keep the next concrete action close. Tasks will be created from your real applications and opportunities." action={<button className="btn btn-primary" disabled data-testid="button-new-task"><Plus size={15} /> New task</button>} /><div className="card"><EmptyState icon={ClipboardList} title="Your task list is clear" copy="There are no tasks to show yet. Add an opportunity, then create the first step when the workflow is connected." action={<Link href="/add-opportunity" className="btn btn-outline" data-testid="button-tasks-add">Add an opportunity <ArrowRight size={14} /></Link>} /></div></div>;
}

export function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [resume, setResume] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const addTag = (value: string, setter: (value: string[]) => void, current: string[], clear: () => void) => { const clean = value.trim(); if (clean && !current.includes(clean)) setter([...current, clean]); clear(); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaveState('saving');
    try {
      await updateProfile({ name, school, major, graduationYear: graduationYear ? Number(graduationYear) : undefined, skills, interests });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };
  return <div className="app-content"><PageHeading eyebrow="Workspace / profile" title="Your context" description="The profile is yours to shape. Empty fields are intentional — no student data is assumed." action={<button className="btn btn-primary" form="profile-form" type="submit" disabled={saveState === 'saving'} data-testid="button-save-profile"><Check size={15} /> {saveState === 'saving' ? 'Saving…' : 'Save changes'}</button>} />{saveState === 'saved' && <div className="toast-note" role="status" data-testid="status-profile-saved">Profile saved by the connected service.</div>}{saveState === 'error' && <div className="readonly-box" role="alert" style={{ marginBottom: '1rem' }}>The profile service is not connected yet. No changes were persisted.</div>}<form id="profile-form" onSubmit={save}><div className="details-grid"><div style={{ display: 'grid', gap: '1rem' }}><section className="card"><div className="card-header"><div><div className="card-title">About you</div><div className="muted" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>The basics that help opportunities make sense.</div></div><UserRound size={17} className="muted" /></div><div className="card-body" style={{ display: 'grid', gap: '1rem' }}><div><label className="label" htmlFor="profile-name">Name</label><input id="profile-name" className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" data-testid="input-profile-name" /></div><div><label className="label" htmlFor="profile-school">School or institution</label><input id="profile-school" className="field" value={school} onChange={(event) => setSchool(event.target.value)} placeholder="Where do you study?" data-testid="input-profile-school" /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}><div><label className="label" htmlFor="profile-major">Field of study</label><input id="profile-major" className="field" value={major} onChange={(event) => setMajor(event.target.value)} placeholder="Your major or focus" data-testid="input-profile-major" /></div><div><label className="label" htmlFor="profile-year">Graduation year</label><input id="profile-year" className="field" type="number" value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} placeholder="Year" data-testid="input-profile-year" /></div></div></div></section><section className="card"><div className="card-header"><div><div className="card-title">Skills and interests</div><div className="muted" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>Add signals for future profile matching.</div></div><Zap size={17} className="muted" /></div><div className="card-body" style={{ display: 'grid', gap: '1.1rem' }}><div><label className="label" htmlFor="profile-skills">Skills</label><div className="field tag-input">{skills.map((skill) => <span className="tag" key={skill}>{skill}<button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} aria-label={`Remove ${skill}`}><X size={12} /></button></span>)}<input id="profile-skills" className="field" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(skillInput, setSkills, skills, () => setSkillInput('')); } }} placeholder="Type and press Enter" data-testid="input-profile-skills" /></div></div><div><label className="label" htmlFor="profile-interests">Interests</label><div className="field tag-input">{interests.map((interest) => <span className="tag" key={interest}>{interest}<button type="button" onClick={() => setInterests(interests.filter((item) => item !== interest))} aria-label={`Remove ${interest}`}><X size={12} /></button></span>)}<input id="profile-interests" className="field" value={interestInput} onChange={(event) => setInterestInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(interestInput, setInterests, interests, () => setInterestInput('')); } }} placeholder="Type and press Enter" data-testid="input-profile-interests" /></div></div></div></section></div><aside style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}><section className="card"><div className="card-header"><div className="card-title">Resume</div><FileText size={17} className="muted" /></div><div className="card-body"><div className="readonly-box" style={{ textAlign: 'center' }}>{resume ? <><Check size={20} style={{ color: 'hsl(var(--primary))' }} /><div style={{ fontSize: '.78rem', fontWeight: 800, marginTop: '.4rem' }}>{resume}</div><button type="button" className="btn btn-ghost" onClick={() => setResume('')} data-testid="button-remove-resume"><Trash2 size={13} /> Remove</button></> : <><Upload size={20} className="muted" /><div style={{ fontSize: '.78rem', fontWeight: 800, marginTop: '.4rem' }}>No resume added</div><p className="muted" style={{ fontSize: '.7rem', lineHeight: 1.5, margin: '.35rem 0 .8rem' }}>PDF upload will be available when storage is connected.</p><label className="btn btn-outline" style={{ cursor: 'pointer' }} htmlFor="resume-upload" data-testid="label-upload-resume"><Upload size={13} /> Choose file</label><input id="resume-upload" type="file" accept=".pdf" hidden onChange={(event) => setResume(event.target.files?.[0]?.name || '')} data-testid="input-resume-upload" /></>}</div></div></section><section className="card"><div className="card-header"><div className="card-title">Appearance</div><Settings2 size={17} className="muted" /></div><div className="card-body"><div className="muted" style={{ fontSize: '.72rem', marginBottom: '.65rem' }}>Theme preference</div><div className="theme-options">{(['light', 'dark', 'system'] as const).map((option) => <button type="button" key={option} className={`theme-option${theme === option ? ' active' : ''}`} onClick={() => setTheme(option)} data-testid={`button-theme-${option}`}>{option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'System'}</button>)}</div></div></section></aside></div></form></div>;
}

export function AddOpportunityPage() {
  const [mode, setMode] = useState<'link' | 'manual'>('link');
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const safe = url.length === 0 || isSafeExternalUrl(url);
  return <div className="app-content"><PageHeading eyebrow="Capture / new opportunity" title="Bring it in." description="Paste a public link or enter the essential details by hand. Scraping is intentionally not active in this frontend preview." action={<Link href="/opportunities" className="btn btn-outline" data-testid="button-cancel-add">Cancel</Link>} /><div className="card" style={{ maxWidth: '850px' }}><div className="card-header"><div className="theme-options"><button type="button" className={`theme-option${mode === 'link' ? ' active' : ''}`} onClick={() => { setMode('link'); setSubmitted(false); }} data-testid="button-mode-link"><Link2 size={14} /> Paste a link</button><button type="button" className={`theme-option${mode === 'manual' ? ' active' : ''}`} onClick={() => { setMode('manual'); setSubmitted(false); }} data-testid="button-mode-manual"><FileText size={14} /> Manual entry</button></div><LockKeyhole size={16} className="muted" /></div><div className="card-body">{mode === 'link' ? <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label className="label" htmlFor="opportunity-url">Opportunity URL</label><input id="opportunity-url" className="field" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.org/opportunity" aria-invalid={!safe} data-testid="input-opportunity-url" />{!safe && <div style={{ color: 'hsl(var(--destructive))', fontSize: '.72rem', marginTop: '.45rem' }} role="alert" data-testid="status-invalid-url">Use a complete http:// or https:// URL.</div>}<div className="readonly-box" style={{ marginTop: '1rem', display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}><Globe2 size={16} className="muted" /><div><div style={{ fontSize: '.76rem', fontWeight: 800 }}>Safe by design</div><div className="muted" style={{ fontSize: '.7rem', lineHeight: 1.55, marginTop: '.25rem' }}>Only http and https links are accepted. The link will not be scraped or saved until a service is connected.</div></div></div><button className="btn btn-primary" style={{ marginTop: '1.2rem' }} type="submit" disabled={!url || !safe} data-testid="button-submit-opportunity-link"><ArrowRight size={14} /> Check link readiness</button>{submitted && <div className="readonly-box" role="status" style={{ marginTop: '1rem', fontSize: '.78rem', lineHeight: 1.55 }} data-testid="status-link-not-connected"><strong>Not connected yet.</strong> The URL is valid, but no scraper or persistence service is running. No opportunity was created.</div>}</form> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} style={{ display: 'grid', gap: '1rem' }}><div><label className="label" htmlFor="manual-title">Title</label><input id="manual-title" className="field" placeholder="Opportunity title" required data-testid="input-manual-title" /></div><div><label className="label" htmlFor="manual-organization">Organization</label><input id="manual-organization" className="field" placeholder="Organization or sponsor" required data-testid="input-manual-organization" /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}><div><label className="label" htmlFor="manual-type">Type</label><select id="manual-type" className="field" defaultValue="" required data-testid="select-manual-type"><option value="" disabled>Select type</option>{opportunityFilters.slice(1).map((item) => <option key={item.value}>{item.label.slice(0, -1)}</option>)}</select></div><div><label className="label" htmlFor="manual-deadline">Deadline</label><input id="manual-deadline" className="field" type="date" data-testid="input-manual-deadline" /></div></div><div><label className="label" htmlFor="manual-description">Notes</label><textarea id="manual-description" className="field" rows={4} placeholder="What made this worth saving?" data-testid="input-manual-description" /></div><button className="btn btn-primary" type="submit" data-testid="button-submit-manual-opportunity"><Plus size={14} /> Save to workspace</button>{submitted && <div className="readonly-box" role="status" style={{ fontSize: '.78rem', lineHeight: 1.55 }} data-testid="status-manual-not-connected"><strong>Not connected yet.</strong> This form is ready for the future opportunity service; no data was sent or persisted.</div>}</form>}</div></div></div>;
}