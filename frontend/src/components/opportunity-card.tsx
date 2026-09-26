import { ArrowRight, CalendarDays, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import type { Opportunity } from '@/types/domain';

function labelize(value?: string) {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShortDate(isoStr?: string) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const type = opportunity.opportunity_type || opportunity.type;
  const verifiedDate = formatShortDate(opportunity.last_verified_at);

  return (
    <article className="card card-hover opportunity-card" data-testid={`card-opportunity-${opportunity.id}`}>
      <div className="opportunity-card-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.4rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
          {type && <span className="pill pill-teal">{labelize(type)}</span>}
          {opportunity.location && <span className="pill"><MapPin size={12} /> {opportunity.location}</span>}
          {opportunity.relevance_score !== undefined && opportunity.relevance_score > 0 && (
            <span className="pill" style={{ background: 'hsl(var(--primary) / .15)', color: 'hsl(var(--primary))', fontWeight: 600 }}>
              {opportunity.relevance_score}% Relevance
            </span>
          )}
        </div>
        <div>
          {opportunity.is_demo ? (
            <span className="pill" style={{ fontSize: '.65rem', opacity: 0.8 }}>Sample listing</span>
          ) : (
            <span className="pill" style={{ background: 'hsl(142 76% 36% / .15)', color: 'hsl(142 76% 36%)', display: 'inline-flex', alignItems: 'center', gap: '.25rem', fontSize: '.68rem', fontWeight: 600 }}>
              <CheckCircle2 size={11} /> Verified source {verifiedDate ? `· ${verifiedDate}` : ''}
            </span>
          )}
        </div>
      </div>
      <h2 className="display opportunity-card-title">{opportunity.title}</h2>
      <p className="muted opportunity-card-organization">
        {opportunity.organization}
        {opportunity.source_name && !opportunity.is_demo && (
          <span className="mono muted" style={{ fontSize: '.7rem', marginLeft: '.5rem' }}>· {opportunity.source_name}</span>
        )}
      </p>
      {opportunity.description && <p className="opportunity-card-description">{opportunity.description}</p>}
      {(opportunity.deadline || opportunity.required_skills?.length) && (
        <div className="opportunity-card-meta">
          {opportunity.deadline && <span><CalendarDays size={13} /> {formatShortDate(opportunity.deadline) || opportunity.deadline}</span>}
          {opportunity.required_skills?.length ? <span>{opportunity.required_skills.length} required skill{opportunity.required_skills.length === 1 ? '' : 's'}</span> : null}
        </div>
      )}
      {opportunity.required_skills?.length ? (
        <div className="opportunity-card-skills">
          {opportunity.required_skills.slice(0, 4).map((skill) => <span className="pill" key={skill}>{skill}</span>)}
        </div>
      ) : null}
      <div className="opportunity-card-actions">
        <Link href={`/opportunities/${opportunity.id}`} className="btn btn-outline" data-testid={`button-view-opportunity-${opportunity.id}`}>
          View Details <ArrowRight size={14} />
        </Link>
        <Link href={`/opportunities/${opportunity.id}/analysis?run=1`} className="btn btn-primary" data-testid={`button-analyze-opportunity-${opportunity.id}`}>
          <Sparkles size={14} /> Analyze My Fit
        </Link>
      </div>
      {!opportunity.source_url && <span className="mono muted opportunity-card-source">SOURCE LINK PENDING</span>}
    </article>
  );
}