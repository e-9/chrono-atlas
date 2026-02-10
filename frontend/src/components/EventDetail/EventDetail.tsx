import { useEffect, useRef } from 'react';
import type { HistoricalEvent } from '../../types/event';

interface EventDetailProps {
  event: HistoricalEvent | null;
  onClose: () => void;
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll card into view when event selected
  useEffect(() => {
    if (event && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [event]);

  if (!event) return null;

  const isFictional = event.source.type === 'ai_generated';

  return (
    <div
      ref={cardRef}
      style={{
        maxWidth: 720, margin: '16px auto 0', padding: '0 24px',
        animation: 'fadeSlideUp 0.35s ease',
      }}
    >
      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div style={{
        background: '#fff', borderRadius: 10,
        border: '1px solid #e0ddd5',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Header row with image */}
        <div style={{ display: 'flex', gap: 0 }}>
          {event.media?.imageUrl && (
            <img
              src={event.media.imageUrl}
              alt={event.title}
              style={{
                width: 180, minHeight: 140, objectFit: 'cover',
                flexShrink: 0, borderRight: '1px solid #e0ddd5',
              }}
            />
          )}

          <div style={{ padding: '16px 20px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  background: isFictional ? '#4a90a4' : '#c44536',
                  color: '#fff', padding: '2px 10px', borderRadius: 4,
                  fontSize: 12, fontFamily: 'system-ui, sans-serif',
                  fontWeight: 600, letterSpacing: 0.3,
                }}>
                  {isFictional ? 'Fictional' : `Year ${event.year}`}
                </span>
                <span style={{
                  color: '#8b7355', fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  📍 {event.location.placeName}
                  {event.location.modernEquivalent && ` · ${event.location.modernEquivalent}`}
                </span>
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', fontSize: 20,
                  cursor: 'pointer', color: '#b5a88a', padding: '0 0 0 12px',
                  lineHeight: 1, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <h3 style={{
              margin: '10px 0 8px', color: '#3a3226', lineHeight: 1.35,
              fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 17,
              fontWeight: 600,
            }}>
              {event.title}
            </h3>

            <p style={{
              color: '#4a4235', lineHeight: 1.6, fontSize: 14, margin: 0,
            }}>
              {event.description}
            </p>
          </div>
        </div>

        {/* Footer: categories + source link */}
        <div style={{
          padding: '10px 20px', borderTop: '1px solid #f0ede6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {event.categories.map((cat) => (
              <span
                key={cat}
                style={{
                  background: '#f0ede6', color: '#6b5d4d',
                  padding: '2px 8px', borderRadius: 10, fontSize: 11,
                  fontFamily: 'system-ui, sans-serif',
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
              style={{ color: '#4a90a4', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}
            >
              Wikipedia →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
