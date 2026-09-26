import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" data-testid="link-brand">
      <span className="logo-mark" aria-hidden="true">O</span>
      {!compact && <span>OpportunityOS</span>}
    </Link>
  );
}

export function ExternalMark() {
  return <ArrowUpRight size={13} aria-hidden="true" />;
}