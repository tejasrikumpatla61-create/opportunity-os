import { Bot, ChevronDown, LoaderCircle, Minimize2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { askAssistant } from '@/services/assistantService';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  suggested_actions?: string[];
};

export function OpportunityAi() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [location] = useLocation();

  const oppMatch = location.match(/^\/opportunities\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const opportunityId = oppMatch ? oppMatch[1] : undefined;

  const suggestions = location.startsWith('/profile')
    ? ['What profile context should I add?', 'Which skills should I explain?', 'How should I prepare my resume?']
    : location.startsWith('/opportunities')
      ? ['How should I assess this opportunity?', 'What should I look for in the deadline?', 'What context is missing?']
      : location.startsWith('/tasks')
        ? ['Which task should I start with?', 'How do I break down a deadline?', 'What can I finish today?']
        : ['What should I work on first?', 'What is missing from my profile?', 'Help me break down a deadline'];

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || sending) return;

    setMessage('');
    setError('');
    setLastFailedMessage(null);
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setSending(true);

    try {
      const response = await askAssistant({
        message: text,
        opportunity_id: opportunityId,
      });
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.message,
          suggested_actions: response.suggested_actions,
        },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach the assistant service.';
      setError(errMsg);
      setLastFailedMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  return (
    <>
      {open && (
        <section className="ai-panel" aria-label="Opportunity AI assistant" data-testid="panel-opportunity-ai">
          <header className="ai-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
              <span className="avatar" style={{ background: 'hsl(var(--accent) / .18)', color: 'hsl(var(--accent))' }}><Sparkles size={15} /></span>
              <div>
                <div className="card-title">Opportunity AI</div>
                <div className="mono muted" style={{ fontSize: '.62rem' }}>ASSISTANT ACTIVE</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.2rem' }}>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Minimize Opportunity AI" data-testid="button-minimize-ai"><Minimize2 size={16} /></button>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close Opportunity AI" data-testid="button-close-ai"><X size={16} /></button>
            </div>
          </header>
          <div className="ai-panel-body">
            {messages.length === 0 && (
              <div className="ai-message">
                <strong style={{ color: 'hsl(var(--foreground))' }}>Opportunity AI is online.</strong><br />
                Ask questions about opportunities, application deadlines, requirements, or your profile.
              </div>
            )}
            {messages.map((item, index) => (
              <div
                className="ai-message"
                style={{
                  marginTop: '.65rem',
                  background: item.role === 'user' ? 'hsl(var(--primary) / .09)' : undefined,
                  color: 'hsl(var(--foreground))'
                }}
                key={`${item.role}-${index}`}
              >
                <strong>{item.role === 'user' ? 'You' : 'Opportunity AI'}</strong>
                <p style={{ margin: '.3rem 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.content}</p>
                {item.suggested_actions && item.suggested_actions.length > 0 && (
                  <div style={{ marginTop: '.6rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                    <div className="mono muted" style={{ fontSize: '.6rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Suggested actions</div>
                    {item.suggested_actions.map((action, actionIdx) => (
                      <button
                        key={actionIdx}
                        className="ai-suggestion"
                        style={{ fontSize: '.72rem', padding: '.35rem .6rem' }}
                        onClick={() => sendMessage(action)}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="ai-message" style={{ marginTop: '.65rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <LoaderCircle size={14} className="spin" />
                <span className="muted" style={{ fontSize: '.78rem' }}>Opportunity AI is thinking…</span>
              </div>
            )}
            {error && (
              <div className="readonly-box" role="alert" style={{ marginTop: '.65rem', fontSize: '.75rem', lineHeight: 1.5, borderColor: 'hsl(var(--destructive) / .4)' }}>
                <div style={{ color: 'hsl(var(--destructive))', fontWeight: 600, marginBottom: '.25rem' }}>Assistant request failed</div>
                <div>{error}</div>
                {lastFailedMessage && (
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: '.5rem', padding: '.25rem .6rem', fontSize: '.72rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                    onClick={handleRetry}
                    disabled={sending}
                    data-testid="button-retry-ai"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                )}
              </div>
            )}
            <div style={{ marginTop: '1.1rem' }}>
              <div className="mono muted" style={{ fontSize: '.62rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>Quick questions</div>
              {suggestions.map((suggestion) => (
                <button
                  className="ai-suggestion"
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  data-testid={`button-ai-suggestion-${suggestion.slice(0, 8).replace(/\s/g, '-').toLowerCase()}`}
                >
                  {suggestion}
                  <ChevronDown size={14} style={{ float: 'right', transform: 'rotate(-90deg)' }} />
                </button>
              ))}
            </div>
          </div>
          <form className="ai-compose" onSubmit={(event) => { event.preventDefault(); sendMessage(message); }}>
            <label htmlFor="ai-message" className="sr-only">Message Opportunity AI</label>
            <input
              id="ai-message"
              className="field"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sending}
              placeholder="Ask Opportunity AI..."
              data-testid="input-ai-message"
            />
            <button className="btn btn-primary" type="submit" disabled={sending || !message.trim()} aria-label="Send message" data-testid="button-send-ai">
              {sending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
            </button>
          </form>
        </section>
      )}
      <button className="ai-orb" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close Opportunity AI' : 'Open Opportunity AI'} data-testid="button-open-ai">
        {open ? <X size={19} /> : <Bot size={20} />}
      </button>
    </>
  );
}