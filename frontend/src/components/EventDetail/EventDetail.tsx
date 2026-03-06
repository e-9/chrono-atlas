import { useEffect, useRef, useCallback } from 'react';
import type { HistoricalEvent } from '../../types/event';

const TRANSITION_MS = 750;

interface EventDetailProps {
  event: HistoricalEvent | null;
  closing: boolean;
  onCloseRequest: () => void;
}

/** Suppress placeName from display when it already appears in modernEquivalent */
function formatLocation(placeName: string, modernEquivalent?: string): string {
  if (!modernEquivalent) return placeName;
  if (modernEquivalent.toLowerCase().startsWith(placeName.toLowerCase())) return modernEquivalent;
  return `${placeName} · ${modernEquivalent}`;
}

export function EventDetail({ event, closing, onCloseRequest }: EventDetailProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll card into view when event selected
  useEffect(() => {
    if (event && cardRef.current && !closing) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [event, closing]);

  // Escape key closes card
  const stableClose = useCallback(() => onCloseRequest(), [onCloseRequest]);
  useEffect(() => {
    if (!event || closing) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') stableClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [event, closing, stableClose]);

  if (!event) return null;

  const isFictional = event.source.type === 'ai_generated';
  const hasImage = !!event.media?.imageUrl;

  return (
    <div
      ref={cardRef}
      style={{
        maxWidth: 720, margin: '16px auto 0', padding: '0 24px',
        animation: `${closing ? 'fadeSlideDown' : 'fadeSlideUp'} ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        opacity: closing ? 0 : 1,
        transform: closing ? 'translateY(12px)' : 'translateY(0)',
      }}
    >
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideDown { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(12px); } }
        .event-card-body { display: flex; gap: 0; }
        .event-card-img { width: 200px; min-height: 160px; object-fit: cover; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); }
        .event-card-placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(232,150,79,0.08) 0%, rgba(13,27,42,0.4) 100%); }
        .event-card-title { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        @media (max-width: 480px) {
          .event-card-body { flex-direction: column; }
          .event-card-img { width: 100%; min-height: 120px; max-height: 160px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
        }
      `}</style>

      <div style={{
        background: 'rgba(13,27,42,0.95)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden', backdropFilter: 'blur(16px)',
      }}>
        {/* Content: side-by-side on desktop, stacked on mobile via CSS media query */}
        <div className="event-card-body">
          {hasImage ? (
            <img
              src={event.media!.imageUrl}
              alt={event.title}
              className="event-card-img"
            />
          ) : (
            <div className="event-card-img event-card-placeholder" aria-hidden="true">
              <span style={{
                fontFamily: "'Cinzel', serif", fontSize: 32, fontWeight: 600,
                color: 'rgba(232,150,79,0.25)', letterSpacing: '0.05em',
              }}>
                {event.year}
              </span>
            </div>
          )}

          <div style={{ padding: '20px 24px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  background: isFictional ? 'rgba(74,144,164,0.2)' : 'rgba(232,150,79,0.15)',
                  color: isFictional ? '#6db8cc' : '#e8964f',
                  padding: '3px 12px', borderRadius: 4,
                  fontSize: 13, fontFamily: "'Cinzel', serif",
                  fontWeight: 600, letterSpacing: '0.05em',
                }}>
                  {isFictional ? 'Fictional' : `${event.year}`}
                </span>
                <span style={{
                  color: '#7a8a9e', fontSize: 13,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                }}>
                  {formatLocation(event.location.placeName, event.location.modernEquivalent)}
                </span>
              </div>

              <button
                onClick={onCloseRequest}
                aria-label="Close"
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e0dde4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6a7e'; }}
                style={{
                  background: 'none', border: 'none', fontSize: 18,
                  cursor: 'pointer', color: '#5a6a7e',
                  padding: '4px 4px 4px 12px', minWidth: 32, minHeight: 32,
                  lineHeight: 1, flexShrink: 0, transition: 'color 0.15s',
                }}
              >
                ×
              </button>
            </div>

            <h3 className="event-card-title" style={{
              margin: '12px 0 10px', color: '#e8e4d9', lineHeight: 1.4,
              fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18,
              fontWeight: 600,
            }}>
              {event.title}
            </h3>

            <p style={{
              color: '#8a96a6', lineHeight: 1.7, fontSize: 14, margin: 0,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              {event.description}
            </p>
          </div>
        </div>

        {/* Footer: categories + source link */}
        <div style={{
          padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {event.categories.map((cat) => (
              <span
                key={cat}
                style={{
                  background: 'rgba(255,255,255,0.05)', color: '#6b7d93',
                  padding: '3px 10px', borderRadius: 12, fontSize: 11,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  letterSpacing: '0.02em', textTransform: 'uppercase',
                }}
              >
                {cat}
              </span>
            ))}
          </div>
          {event.source.sourceUrl && (
            <a
              href={event.source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#6db8cc', fontSize: 12, fontFamily: "'Inter', system-ui, sans-serif",
                textDecoration: 'none', letterSpacing: '0.03em',
              }}
            >
              Read on Wikipedia →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
