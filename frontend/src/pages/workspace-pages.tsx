import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, CheckSquare, Circle,
  CircleHelp, ClipboardList, Clock3, Compass, ExternalLink,
  FileText, Filter, Globe2, Inbox, Link2, LockKeyhole, MoreHorizontal, Plus, Search,
  Settings2, Sparkles, Square, Target, Trash2, Upload, UserRound, X, Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { OpportunityCard } from '@/components/opportunity-card';
import { analyzeOpportunity } from '@/services/analysisService';
import { ApiError } from '@/services/api-client';
import { getOpportunity, listOpportunities } from '@/services/opportunityService';
import { getCurrentProfile, updateProfile } from '@/services/profileService';
import {
  listApplications,
  trackApplication,
  updateApplicationStatus,
  deleteApplication,
  type ApplicationItem,
} from '@/services/applicationService';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  saveActionPlanTasks,
  type TaskItem,
} from '@/services/taskService';
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
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [tracking, setTracking] = useState(false);
  const [trackFeedback, setTrackFeedback] = useState('');

  useEffect(() => {
    let active = true;
    if (!id) { setLoading(false); return undefined; }
    getOpportunity(id).then((result) => { if (active) setOpportunity(result); }).catch((reason: unknown) => { if (active) setError(reason instanceof ApiError ? reason.message : 'The opportunity service could not be reached.'); }).finally(() => { if (active) setLoading(false); });
    listApplications().then((apps) => { if (active) setApplications(apps); }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const trackedApp = applications.find((a) => a.opportunity_id === id);

  const handleTrackApplication = async () => {
    if (!id || tracking) return;
    setTracking(true);
    setTrackFeedback('');
    try {
      const created = await trackApplication(id, 'planning');
      setApplications((prev) => [...prev, created]);
      setTrackFeedback('Application tracked in your pipeline.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not track application.';
      setTrackFeedback(msg);
      listApplications().then(setApplications).catch(() => {});
    } finally {
      setTracking(false);
    }
  };

  const sourceUrl = opportunity?.source_url;
  const safeSourceUrl = sourceUrl && isSafeExternalUrl(sourceUrl) ? sourceUrl : null;
  return (
    <div className="app-content">
      <Link href="/opportunities" className="btn btn-ghost" style={{ paddingLeft: 0, marginBottom: '1.2rem' }} data-testid="link-back-opportunities">
        <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to opportunities
      </Link>
      {loading ? (
        <div className="card service-state" role="status">
          <div className="loading-pulse" />
          <strong>Loading opportunity details…</strong>
          <span className="muted">Waiting for the opportunity service.</span>
        </div>
      ) : error || !opportunity ? (
        <div className="card">
          <ServiceState
            loading={false}
            error={error}
            emptyTitle="Opportunity details are not connected"
            emptyCopy="This route will display the title, organization, requirements, and source link supplied by the backend. No record was inferred."
            action={<Link href="/opportunities" className="btn btn-outline">Back to library <ArrowRight size={14} /></Link>}
          />
        </div>
      ) : (
        <div className="details-grid">
          <div>
            <section className="card detail-hero">
              <div className="eyebrow">Opportunity / {opportunity.id}</div>
              <h1 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.3rem)', lineHeight: 1, letterSpacing: '-.06em', marginTop: '.8rem' }}>
                {opportunity.title}
              </h1>
              <p className="muted" style={{ maxWidth: '590px', lineHeight: 1.7, fontSize: '.85rem', marginTop: '1rem' }}>
                {opportunity.description || 'Details supplied by the connected opportunity service.'}
              </p>
              <div className="detail-meta">
                {opportunity.organization && <span className="pill">{opportunity.organization}</span>}
                {opportunity.location && <span className="pill">{opportunity.location}</span>}
                {opportunity.deadline && <span className="pill"><CalendarDays size={12} /> {opportunity.deadline}</span>}
                {trackedApp && <span className="pill pill-teal"><CheckCircle2 size={12} /> Tracked ({trackedApp.display_status})</span>}
              </div>
            </section>
            <section className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <div className="card-title">Analyze my fit</div>
                <Sparkles size={16} className="muted" />
              </div>
              <div className="card-body">
                <div className="readonly-box">
                  <div className="mono eyebrow">CREWAI VIA FASTAPI</div>
                  <p style={{ fontSize: '.8rem', lineHeight: 1.6, marginTop: '.45rem' }}>
                    Analysis will use your connected profile, resume evidence, and this opportunity. Scores and eligibility are never calculated in the browser.
                  </p>
                </div>
                <Link href={`/opportunities/${opportunity.id}/analysis?run=1`} className="btn btn-primary" style={{ marginTop: '1rem' }} data-testid="button-detail-analyze">
                  <Sparkles size={14} /> Analyze My Fit
                </Link>
              </div>
            </section>
          </div>
          <aside className="card">
            <div className="card-header">
              <div className="card-title">Actions</div>
              <MoreHorizontal size={16} className="muted" />
            </div>
            <div className="card-body" style={{ display: 'grid', gap: '.65rem' }}>
              {trackedApp ? (
                <Link href="/applications" className="btn btn-outline" data-testid="button-view-application">
                  <CheckCircle2 size={14} style={{ color: 'hsl(var(--primary))' }} /> View Application ({trackedApp.display_status})
                </Link>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={tracking}
                  onClick={handleTrackApplication}
                  data-testid="button-track-opportunity"
                >
                  <Plus size={14} /> {tracking ? 'Tracking…' : 'Track Application'}
                </button>
              )}
              {trackFeedback && (
                <p className="mono muted" style={{ fontSize: '.72rem', color: 'hsl(var(--primary))' }}>
                  {trackFeedback}
                </p>
              )}
              {safeSourceUrl ? (
                <a className="btn btn-outline" href={safeSourceUrl} target="_blank" rel="noreferrer" data-testid="button-open-opportunity">
                  <ExternalLink size={14} /> View Original Opportunity
                </a>
              ) : (
                <button className="btn btn-outline" disabled data-testid="button-open-opportunity">
                  <ExternalLink size={14} /> Official link unavailable
                </button>
              )}
              <p className="muted" style={{ fontSize: '.72rem', lineHeight: 1.55, marginTop: '.45rem' }}>
                Tracked applications persist in your private student dashboard.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

const analysisStages = ['Reviewing your profile…', 'Comparing opportunity requirements…', 'Checking eligibility…', 'Identifying gaps…', 'Building your action plan…'];

function StringList({ title, items, emptyCopy }: { title: string; items: string[]; emptyCopy?: string }) {
  return <section className="analysis-section"><div className="card-title">{title}</div>{items.length ? <ul className="analysis-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : emptyCopy ? <p className="muted analysis-empty">{emptyCopy}</p> : null}</section>;
}

function AnalysisResult({
  result,
  opportunityId,
  isAlreadyTracked,
  onTrack,
  tracking,
  onSaveTasks,
  savingTasks,
  savedTasksMessage,
}: {
  result: OpportunityAnalysis;
  opportunityId: string;
  isAlreadyTracked: boolean;
  onTrack: () => void;
  tracking: boolean;
  onSaveTasks: () => void;
  savingTasks: boolean;
  savedTasksMessage: string;
}) {
  const sourceUrl = result.sourceUrl;
  const safeSourceUrl = sourceUrl && isSafeExternalUrl(sourceUrl) ? sourceUrl : null;
  return (
    <div className="analysis-result">
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
      
      <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '1.2rem', marginTop: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem', flexWrap: 'wrap', gap: '.6rem' }}>
          <div className="card-title">Action plan</div>
          {result.tasks && result.tasks.length > 0 && (
            savedTasksMessage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <span className="pill pill-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                  <CheckCircle2 size={13} /> {savedTasksMessage}
                </span>
                <Link href="/tasks" className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.35rem .75rem' }} data-testid="button-view-tasks">
                  View Tasks <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ fontSize: '.75rem', padding: '.45rem .85rem' }}
                disabled={savingTasks}
                onClick={onSaveTasks}
                data-testid="button-save-action-plan"
              >
                <Sparkles size={14} /> {savingTasks ? 'Saving tasks…' : 'Save Action Plan to Tasks'}
              </button>
            )
          )}
        </div>
        <ul className="analysis-list">
          {result.tasks.map((task, idx) => (
            <li key={idx}>{typeof task === 'string' ? task : task.title}</li>
          ))}
        </ul>
      </div>

      {result.recommendedNextAction && result.recommendedNextAction.trim() !== '' && (
        <div className="readonly-box analysis-next-action" style={{ marginTop: '1.2rem' }}>
          <div className="mono eyebrow">NEXT ACTION</div>
          <strong>{result.recommendedNextAction}</strong>
        </div>
      )}

      <div style={{ marginTop: '1.6rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {isAlreadyTracked ? (
          <Link href="/applications" className="btn btn-outline" data-testid="button-analysis-view-app">
            <CheckCircle2 size={14} style={{ color: 'hsl(var(--primary))' }} /> View in Applications
          </Link>
        ) : (
          <button
            className="btn btn-primary"
            disabled={tracking}
            onClick={onTrack}
            data-testid="button-analysis-track"
          >
            <Plus size={14} /> {tracking ? 'Tracking…' : 'Track Application'}
          </button>
        )}
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
    </div>
  );
}

export function OpportunityAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<OpportunityAnalysis | null>(null);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [tracking, setTracking] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [savedTasksMessage, setSavedTasksMessage] = useState('');

  const shouldRun = new URLSearchParams(location.split('?')[1] || '').get('run') === '1';

  useEffect(() => {
    let active = true;
    listApplications().then((apps) => { if (active) setApplications(apps); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const isAlreadyTracked = Boolean(id && applications.some((a) => a.opportunity_id === id));

  const handleTrack = async () => {
    if (!id || tracking) return;
    setTracking(true);
    try {
      const created = await trackApplication(id);
      setApplications((prev) => [...prev, created]);
    } catch {
      listApplications().then(setApplications).catch(() => {});
    } finally {
      setTracking(false);
    }
  };

  const handleSaveTasks = async () => {
    if (!id || !result?.tasks?.length || savingTasks) return;
    setSavingTasks(true);
    try {
      const res = await saveActionPlanTasks(id, result.tasks);
      setSavedTasksMessage(res.message || 'Action plan saved to Tasks');
      listApplications().then(setApplications).catch(() => {});
    } catch (err: unknown) {
      setSavedTasksMessage('Failed to save tasks.');
    } finally {
      setSavingTasks(false);
    }
  };

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

  return (
    <div className="app-content">
      <PageHeading
        eyebrow={`Analysis / ${id || 'unknown'}`}
        title="Readiness before certainty."
        description="The analysis surface displays only the response returned by FastAPI and CrewAI."
        action={<Link href={`/opportunities/${id || 'new'}`} className="btn btn-outline" data-testid="button-analysis-back">Back to opportunity</Link>}
      />
      <div className="card analysis-card">
        <div className="card-body">
          {status === 'loading' && (
            <div className="analysis-processing" role="status">
              <div className="ai-processing-orb"><Sparkles size={22} /></div>
              <h2 className="display">Building your read</h2>
              <p className="muted">This progress is visual only while the backend analyzes your context.</p>
              <div className="analysis-stage-list">
                {analysisStages.map((item, index) => (
                  <div className={index <= stage ? 'active' : ''} key={item}>
                    <span>{index < stage ? <Check size={13} /> : index === stage ? <span className="status-dot" /> : index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
          {status === 'error' && (
            <div className="analysis-processing" role="alert">
              <div className="empty-icon"><Sparkles size={23} /></div>
              <h2 className="display">Analysis unavailable</h2>
              <p className="muted">{error}</p>
              <button className="btn btn-primary" onClick={() => void runAnalysis()} data-testid="button-retry-analysis">
                Retry analysis <ArrowRight size={14} />
              </button>
            </div>
          )}
          {status === 'success' && result && (
            <AnalysisResult
              result={result}
              opportunityId={id || ''}
              isAlreadyTracked={isAlreadyTracked}
              onTrack={handleTrack}
              tracking={tracking}
              onSaveTasks={handleSaveTasks}
              savingTasks={savingTasks}
              savedTasksMessage={savedTasksMessage}
            />
          )}
          {status === 'idle' && (
            <div className="analysis-processing">
              <div className="empty-icon"><Sparkles size={23} /></div>
              <h2 className="display">Analysis is ready when you are</h2>
              <p className="muted">No score or eligibility result is shown until the backend returns one for this opportunity and your connected profile.</p>
              <button className="btn btn-primary" onClick={() => navigate(`/opportunities/${id || 'new'}/analysis?run=1`)} data-testid="button-start-analysis">
                <Sparkles size={14} /> Analyze My Fit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listApplications();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    setUpdatingId(appId);
    try {
      const updated = await updateApplicationStatus(appId, newStatus);
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
    } catch {
      // Refresh on error
      loadData();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (appId: string) => {
    if (!window.confirm('Are you sure you want to remove this tracked application?')) return;
    try {
      await deleteApplication(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch {
      loadData();
    }
  };

  const filteredApps = useMemo(() => {
    if (filterStatus === 'all') return applications;
    return applications.filter((a) => {
      const s = a.status.toLowerCase();
      const ds = a.display_status.toLowerCase();
      const fs = filterStatus.toLowerCase();
      return s === fs || ds === fs;
    });
  }, [applications, filterStatus]);

  return (
    <div className="app-content">
      <PageHeading
        eyebrow="Execution / pipeline"
        title="Applications"
        description="Track your real applications, monitor completion progress, and move from preparation to submission."
        action={
          <Link href="/opportunities" className="btn btn-primary" data-testid="button-applications-browse-new">
            <Plus size={15} /> Track new opportunity
          </Link>
        }
      />

      <div className="filters" style={{ flexWrap: 'wrap', gap: '.6rem', marginBottom: '1.2rem' }}>
        <button
          className={`theme-option${filterStatus === 'all' ? ' active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All ({applications.length})
        </button>
        <button
          className={`theme-option${filterStatus === 'interested' ? ' active' : ''}`}
          onClick={() => setFilterStatus('interested')}
        >
          Interested ({applications.filter((a) => a.display_status === 'Interested').length})
        </button>
        <button
          className={`theme-option${filterStatus === 'preparing' ? ' active' : ''}`}
          onClick={() => setFilterStatus('preparing')}
        >
          Preparing ({applications.filter((a) => a.display_status === 'Preparing').length})
        </button>
        <button
          className={`theme-option${filterStatus === 'applied' ? ' active' : ''}`}
          onClick={() => setFilterStatus('applied')}
        >
          Applied ({applications.filter((a) => a.display_status === 'Applied').length})
        </button>
      </div>

      {loading ? (
        <div className="card service-state" role="status">
          <div className="loading-pulse" />
          <strong>Loading tracked applications…</strong>
          <span className="muted">Fetching pipeline from Supabase.</span>
        </div>
      ) : error ? (
        <div className="card service-state" role="alert">
          <AlertCircle size={24} style={{ color: 'hsl(var(--destructive))' }} />
          <strong>Failed to load applications</strong>
          <span className="muted">{error}</span>
          <button className="btn btn-outline" onClick={loadData} style={{ marginTop: '.8rem' }}>
            Try again
          </button>
        </div>
      ) : !filteredApps.length ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={filterStatus === 'all' ? 'No applications yet' : `No ${filterStatus} applications`}
            copy={
              filterStatus === 'all'
                ? 'Track internships, hackathons, or scholarships to monitor progress and action plans.'
                : 'No opportunities currently match this status filter.'
            }
            action={
              <Link href="/opportunities" className="btn btn-outline" data-testid="button-applications-browse">
                Browse opportunities <ArrowRight size={14} />
              </Link>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredApps.map((app) => {
            const opp = app.opportunity;
            return (
              <div key={app.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <span className="pill pill-teal" style={{ fontWeight: 700 }}>
                        {app.display_status}
                      </span>
                      {opp?.opportunity_type && <span className="pill">{opp.opportunity_type}</span>}
                      {opp?.deadline && (
                        <span className="pill">
                          <CalendarDays size={12} /> Deadline: {opp.deadline}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '.6rem', fontFamily: 'var(--app-font-display)' }}>
                      <Link href={`/opportunities/${app.opportunity_id}`}>
                        {opp?.title || `Opportunity ${app.opportunity_id}`}
                      </Link>
                    </h3>
                    {opp?.organization && (
                      <p className="muted" style={{ fontSize: '.8rem', marginTop: '.2rem' }}>
                        {opp.organization} {opp.location ? `• ${opp.location}` : ''}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <label htmlFor={`status-select-${app.id}`} className="sr-only">Update Status</label>
                    <select
                      id={`status-select-${app.id}`}
                      className="field"
                      style={{ fontSize: '.75rem', padding: '.35rem .6rem' }}
                      value={app.status}
                      disabled={updatingId === app.id}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    >
                      <option value="planning">Interested</option>
                      <option value="in_progress">Preparing</option>
                      <option value="submitted">Applied</option>
                    </select>
                    <button
                      className="icon-btn"
                      title="Remove application"
                      onClick={() => handleDelete(app.id)}
                      data-testid={`button-delete-app-${app.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '1.2rem', background: 'hsl(var(--muted) / .5)', padding: '.75rem 1rem', borderRadius: '.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.75rem', marginBottom: '.4rem' }}>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      Task Progress: {app.progress_percentage}%
                    </span>
                    <span className="muted">
                      {app.task_count > 0
                        ? `${app.completed_task_count} of ${app.task_count} tasks completed`
                        : 'No tasks saved yet'}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'hsl(var(--muted))', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${app.progress_percentage}%`,
                        background: 'hsl(var(--primary))',
                        transition: 'width .3s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <Link href={`/opportunities/${app.opportunity_id}/analysis?run=1`} className="btn btn-outline" style={{ fontSize: '.75rem' }}>
                    <Sparkles size={13} /> View Fit Analysis
                  </Link>
                  <Link href={`/tasks`} className="btn btn-outline" style={{ fontSize: '.75rem' }}>
                    <CheckSquare size={13} /> View Tasks
                  </Link>
                  {opp?.source_url && isSafeExternalUrl(opp.source_url) && (
                    <a className="btn btn-ghost" href={opp.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '.75rem' }}>
                      <ExternalLink size={13} /> Official Link
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newAppId, setNewAppId] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedTasks, fetchedApps] = await Promise.all([listTasks(), listApplications()]);
      setTasks(fetchedTasks);
      setApplications(fetchedApps);
      if (fetchedApps.length > 0 && !newAppId) {
        setNewAppId(fetchedApps[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [newAppId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTask = async (task: TaskItem) => {
    const newStatus = task.is_completed ? 'pending' : 'completed';
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, is_completed: newStatus === 'completed' } : t))
    );
    try {
      await updateTask(task.id, { status: newStatus });
    } catch {
      loadData();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch {
      loadData();
    }
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAppId || creating) return;
    setCreating(true);
    try {
      const created = await createTask({
        application_id: newAppId,
        title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate || undefined,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTitle('');
      setShowAddModal(false);
    } catch {
      loadData();
    } finally {
      setCreating(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'incomplete') return !t.is_completed;
      if (filter === 'completed') return t.is_completed;
      return true;
    });
  }, [tasks, filter]);

  return (
    <div className="app-content">
      <PageHeading
        eyebrow="Execution / focus"
        title="Tasks"
        description="Turn deadlines and AI recommendations into checked-off milestones before application windows close."
        action={
          applications.length > 0 ? (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} data-testid="button-new-task">
              <Plus size={15} /> New task
            </button>
          ) : (
            <Link href="/opportunities" className="btn btn-primary" data-testid="button-new-task-link">
              <Plus size={15} /> Track opportunity first
            </Link>
          )
        }
      />

      {/* Filter tabs */}
      <div className="filters" style={{ flexWrap: 'wrap', gap: '.6rem', marginBottom: '1.2rem' }}>
        <button
          className={`theme-option${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({tasks.length})
        </button>
        <button
          className={`theme-option${filter === 'incomplete' ? ' active' : ''}`}
          onClick={() => setFilter('incomplete')}
        >
          Pending ({tasks.filter((t) => !t.is_completed).length})
        </button>
        <button
          className={`theme-option${filter === 'completed' ? ' active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({tasks.filter((t) => t.is_completed).length})
        </button>
      </div>

      {loading ? (
        <div className="card service-state" role="status">
          <div className="loading-pulse" />
          <strong>Loading student tasks…</strong>
          <span className="muted">Fetching execution list.</span>
        </div>
      ) : error ? (
        <div className="card service-state" role="alert">
          <AlertCircle size={24} style={{ color: 'hsl(var(--destructive))' }} />
          <strong>Failed to load tasks</strong>
          <span className="muted">{error}</span>
          <button className="btn btn-outline" onClick={loadData} style={{ marginTop: '.8rem' }}>
            Try again
          </button>
        </div>
      ) : !filteredTasks.length ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={filter === 'all' ? 'Your task list is clear' : `No ${filter} tasks`}
            copy={
              filter === 'all'
                ? 'Tasks help you finish requirements on time. Generate an action plan on any opportunity analysis or create a custom task.'
                : 'No tasks match the active filter.'
            }
            action={
              <Link href="/opportunities" className="btn btn-outline" data-testid="button-tasks-browse">
                Browse opportunities <ArrowRight size={14} />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ display: 'grid' }}>
            {filteredTasks.map((task) => {
              const prioColor =
                task.priority === 'critical'
                  ? 'hsl(var(--destructive))'
                  : task.priority === 'high'
                  ? 'hsl(38 92% 50%)'
                  : 'hsl(var(--muted-foreground))';

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid hsl(var(--border))',
                    background: task.is_completed ? 'hsl(var(--muted) / .2)' : 'transparent',
                    transition: 'background .15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem', flex: 1 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleToggleTask(task)}
                      aria-label={task.is_completed ? 'Mark incomplete' : 'Mark complete'}
                      style={{ color: task.is_completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                      data-testid={`checkbox-task-${task.id}`}
                    >
                      {task.is_completed ? <CheckSquare size={19} /> : <Square size={19} />}
                    </button>
                    <div>
                      <div
                        style={{
                          fontSize: '.88rem',
                          fontWeight: 600,
                          textDecoration: task.is_completed ? 'line-through' : 'none',
                          color: task.is_completed ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.25rem', flexWrap: 'wrap' }}>
                        {task.opportunity_title && (
                          <span className="mono" style={{ fontSize: '.68rem', color: 'hsl(var(--primary))' }}>
                            {task.opportunity_title}
                          </span>
                        )}
                        <span className="pill" style={{ fontSize: '.62rem', borderColor: prioColor, color: prioColor }}>
                          {task.priority.toUpperCase()}
                        </span>
                        {task.due_date && (
                          <span className="muted" style={{ fontSize: '.68rem', display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
                            <Clock3 size={11} /> Due: {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    className="icon-btn"
                    title="Delete task"
                    onClick={() => handleDeleteTask(task.id)}
                    data-testid={`button-delete-task-${task.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="onboarding-backdrop" role="presentation">
          <div className="card" style={{ width: 'min(500px, 95vw)', padding: '1.5rem', animation: 'panel-in .2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--app-font-display)' }}>Create task</h3>
              <button className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className="label" htmlFor="task-title">Task Title</label>
                <input
                  id="task-title"
                  className="field"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Request transcript from university registrar"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label" htmlFor="task-app">Linked Application</label>
                <select
                  id="task-app"
                  className="field"
                  value={newAppId}
                  onChange={(e) => setNewAppId(e.target.value)}
                  required
                >
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.opportunity?.title || `Application ${a.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
                <div>
                  <label className="label" htmlFor="task-prio">Priority</label>
                  <select
                    id="task-prio"
                    className="field"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="task-due">Due Date</label>
                  <input
                    id="task-due"
                    type="date"
                    className="field"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || !newTitle.trim()}>
                  {creating ? 'Saving…' : 'Add task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // PART A FIX: Hydrate profile on mount from backend
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    getCurrentProfile()
      .then((p) => {
        if (!active || !p) return;
        setName(p.name || '');
        setSchool(p.school || p.college || '');
        setMajor(p.major || p.branch || p.degree || '');
        setGraduationYear(
          p.graduationYear ? String(p.graduationYear) : p.studyYear ? String(p.studyYear) : ''
        );
        setSkills(p.skills || []);
        setInterests(p.interests || []);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load existing profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const addTag = (value: string, setter: (value: string[]) => void, current: string[], clear: () => void) => {
    const clean = value.trim();
    if (clean && !current.includes(clean)) setter([...current, clean]);
    clear();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaveState('saving');
    try {
      await updateProfile({
        name,
        school,
        college: school,
        major,
        branch: major,
        graduationYear: graduationYear ? Number(graduationYear) : undefined,
        studyYear: graduationYear ? Number(graduationYear) : undefined,
        skills,
        interests,
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  if (loading) {
    return (
      <div className="app-content">
        <PageHeading
          eyebrow="Workspace / profile"
          title="Your context"
          description="Retrieving your profile context from Supabase…"
        />
        <div className="card service-state" role="status">
          <div className="loading-pulse" />
          <strong>Loading your profile…</strong>
          <span className="muted">Fetching existing student attributes.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-content">
      <PageHeading
        eyebrow="Workspace / profile"
        title="Your context"
        description="The profile is yours to shape. Your preferences guide opportunity recommendations and fit calculations."
        action={
          <button
            className="btn btn-primary"
            form="profile-form"
            type="submit"
            disabled={saveState === 'saving'}
            data-testid="button-save-profile"
          >
            <Check size={15} /> {saveState === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        }
      />
      {saveState === 'saved' && (
        <div className="toast-note" role="status" data-testid="status-profile-saved">
          Profile saved successfully.
        </div>
      )}
      {saveState === 'error' && (
        <div className="readonly-box" role="alert" style={{ marginBottom: '1rem' }}>
          The profile service could not persist changes. Please try again.
        </div>
      )}
      {loadError && (
        <div className="readonly-box" role="alert" style={{ marginBottom: '1rem', color: 'hsl(var(--destructive))' }}>
          Notice: {loadError}
        </div>
      )}
      <form id="profile-form" onSubmit={save}>
        <div className="details-grid">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">About you</div>
                  <div className="muted" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                    The basics that help opportunities make sense.
                  </div>
                </div>
                <UserRound size={17} className="muted" />
              </div>
              <div className="card-body" style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label className="label" htmlFor="profile-name">Name</label>
                  <input
                    id="profile-name"
                    className="field"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    data-testid="input-profile-name"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="profile-school">School or institution</label>
                  <input
                    id="profile-school"
                    className="field"
                    value={school}
                    onChange={(event) => setSchool(event.target.value)}
                    placeholder="Where do you study?"
                    data-testid="input-profile-school"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
                  <div>
                    <label className="label" htmlFor="profile-major">Field of study / Branch</label>
                    <input
                      id="profile-major"
                      className="field"
                      value={major}
                      onChange={(event) => setMajor(event.target.value)}
                      placeholder="e.g. Computer Science and Engineering"
                      data-testid="input-profile-major"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="profile-year">Study Year / Graduation Year</label>
                    <input
                      id="profile-year"
                      className="field"
                      type="number"
                      value={graduationYear}
                      onChange={(event) => setGraduationYear(event.target.value)}
                      placeholder="e.g. 2"
                      data-testid="input-profile-year"
                    />
                  </div>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Skills and interests</div>
                  <div className="muted" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                    Key signals for AI fit and opportunity matching.
                  </div>
                </div>
                <Zap size={17} className="muted" />
              </div>
              <div className="card-body" style={{ display: 'grid', gap: '1.1rem' }}>
                <div>
                  <label className="label" htmlFor="profile-skills">Skills</label>
                  <div className="field tag-input">
                    {skills.map((skill) => (
                      <span className="tag" key={skill}>
                        {skill}
                        <button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} aria-label={`Remove ${skill}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="profile-skills"
                      className="field"
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag(skillInput, setSkills, skills, () => setSkillInput(''));
                        }
                      }}
                      placeholder="Type skill and press Enter"
                      data-testid="input-profile-skills"
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="profile-interests">Interests</label>
                  <div className="field tag-input">
                    {interests.map((interest) => (
                      <span className="tag" key={interest}>
                        {interest}
                        <button type="button" onClick={() => setInterests(interests.filter((item) => item !== interest))} aria-label={`Remove ${interest}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="profile-interests"
                      className="field"
                      value={interestInput}
                      onChange={(event) => setInterestInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag(interestInput, setInterests, interests, () => setInterestInput(''));
                        }
                      }}
                      placeholder="Type interest and press Enter"
                      data-testid="input-profile-interests"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
          <aside style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
            <section className="card">
              <div className="card-header">
                <div className="card-title">Resume</div>
                <FileText size={17} className="muted" />
              </div>
              <div className="card-body">
                <div className="readonly-box" style={{ textAlign: 'center' }}>
                  {resume ? (
                    <>
                      <Check size={20} style={{ color: 'hsl(var(--primary))' }} />
                      <div style={{ fontSize: '.78rem', fontWeight: 800, marginTop: '.4rem' }}>{resume}</div>
                      <button type="button" className="btn btn-ghost" onClick={() => setResume('')} data-testid="button-remove-resume">
                        <Trash2 size={13} /> Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="muted" />
                      <div style={{ fontSize: '.78rem', fontWeight: 800, marginTop: '.4rem' }}>No resume added</div>
                      <p className="muted" style={{ fontSize: '.7rem', lineHeight: 1.5, margin: '.35rem 0 .8rem' }}>
                        PDF upload will be available when storage is connected.
                      </p>
                      <label className="btn btn-outline" style={{ cursor: 'pointer' }} htmlFor="resume-upload" data-testid="label-upload-resume">
                        <Upload size={13} /> Choose file
                      </label>
                      <input id="resume-upload" type="file" accept=".pdf" hidden onChange={(event) => setResume(event.target.files?.[0]?.name || '')} data-testid="input-resume-upload" />
                    </>
                  )}
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <div className="card-title">Appearance</div>
                <Settings2 size={17} className="muted" />
              </div>
              <div className="card-body">
                <div className="muted" style={{ fontSize: '.72rem', marginBottom: '.65rem' }}>Theme preference</div>
                <div className="theme-options">
                  {(['light', 'dark', 'system'] as const).map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`theme-option${theme === option ? ' active' : ''}`}
                      onClick={() => setTheme(option)}
                      data-testid={`button-theme-${option}`}
                    >
                      {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'System'}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

export function AddOpportunityPage() {
  const [mode, setMode] = useState<'link' | 'manual'>('link');
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const safe = url.length === 0 || isSafeExternalUrl(url);
  return <div className="app-content"><PageHeading eyebrow="Capture / new opportunity" title="Bring it in." description="Paste a public link or enter the essential details by hand. Scraping is intentionally not active in this frontend preview." action={<Link href="/opportunities" className="btn btn-outline" data-testid="button-cancel-add">Cancel</Link>} /><div className="card" style={{ maxWidth: '850px' }}><div className="card-header"><div className="theme-options"><button type="button" className={`theme-option${mode === 'link' ? ' active' : ''}`} onClick={() => { setMode('link'); setSubmitted(false); }} data-testid="button-mode-link"><Link2 size={14} /> Paste a link</button><button type="button" className={`theme-option${mode === 'manual' ? ' active' : ''}`} onClick={() => { setMode('manual'); setSubmitted(false); }} data-testid="button-mode-manual"><FileText size={14} /> Manual entry</button></div><LockKeyhole size={16} className="muted" /></div><div className="card-body">{mode === 'link' ? <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label className="label" htmlFor="opportunity-url">Opportunity URL</label><input id="opportunity-url" className="field" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.org/opportunity" aria-invalid={!safe} data-testid="input-opportunity-url" />{!safe && <div style={{ color: 'hsl(var(--destructive))', fontSize: '.72rem', marginTop: '.45rem' }} role="alert" data-testid="status-invalid-url">Use a complete http:// or https:// URL.</div>}<div className="readonly-box" style={{ marginTop: '1rem', display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}><Globe2 size={16} className="muted" /><div><div style={{ fontSize: '.76rem', fontWeight: 800 }}>Safe by design</div><div className="muted" style={{ fontSize: '.7rem', lineHeight: 1.55, marginTop: '.25rem' }}>Only http and https links are accepted. The link will not be scraped or saved until a service is connected.</div></div></div><button className="btn btn-primary" style={{ marginTop: '1.2rem' }} type="submit" disabled={!url || !safe} data-testid="button-submit-opportunity-link"><ArrowRight size={14} /> Check link readiness</button>{submitted && <div className="readonly-box" role="status" style={{ marginTop: '1rem', fontSize: '.78rem', lineHeight: 1.55 }} data-testid="status-link-not-connected"><strong>Not connected yet.</strong> The URL is valid, but no scraper or persistence service is running. No opportunity was created.</div>}</form> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} style={{ display: 'grid', gap: '1rem' }}><div><label className="label" htmlFor="manual-title">Title</label><input id="manual-title" className="field" placeholder="Opportunity title" required data-testid="input-manual-title" /></div><div><label className="label" htmlFor="manual-organization">Organization</label><input id="manual-organization" className="field" placeholder="Organization or sponsor" required data-testid="input-manual-organization" /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}><div><label className="label" htmlFor="manual-type">Type</label><select id="manual-type" className="field" defaultValue="" required data-testid="select-manual-type"><option value="" disabled>Select type</option>{opportunityFilters.slice(1).map((item) => <option key={item.value}>{item.label.slice(0, -1)}</option>)}</select></div><div><label className="label" htmlFor="manual-deadline">Deadline</label><input id="manual-deadline" className="field" type="date" data-testid="input-manual-deadline" /></div></div><div><label className="label" htmlFor="manual-description">Notes</label><textarea id="manual-description" className="field" rows={4} placeholder="What made this worth saving?" data-testid="input-manual-description" /></div><button className="btn btn-primary" type="submit" data-testid="button-submit-manual-opportunity"><Plus size={14} /> Save to workspace</button>{submitted && <div className="readonly-box" role="status" style={{ fontSize: '.78rem', lineHeight: 1.55 }} data-testid="status-manual-not-connected"><strong>Not connected yet.</strong> This form is ready for the future opportunity service; no data was sent or persisted.</div>}</form>}</div></div></div>;
}