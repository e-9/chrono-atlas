import type { HistoricalEvent } from '../../types/event';

interface EventDetailProps {
  event: HistoricalEvent | null;
  onClose: () => void;
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  if (!event) return null;

  const isFictional = event.source.type === 'ai_generated';

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 400,
      background: '#faf8f4', boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
      padding: 24, overflowY: 'auto', zIndex: 1000,
      borderLeft: '1px solid #e0ddd5',
    }}>
      <button
        onClick={onClose}
        style={{
          float: 'right', background: 'none', border: 'none',
          fontSize: 24, cursor: 'pointer', color: '#8b7355',
        }}
      >
        ×
      </button>

      {isFictional && (
        <span style={{
          background: '#4a90a4', color: '#fff',
          padding: '2px 8px', borderRadius: 4, fontSize: 12,
          fontFamily: 'sans-serif', letterSpacing: 0.5,
        }}>
          Fictional
        </span>
      )}

      <h2 style={{ margin: '12px 0 4px', color: '#3a3226', lineHeight: 1.3 }}>
        {event.title}
      </h2>

      <p style={{ color: '#8b7355', fontSize: 14, margin: '0 0 16px' }}>
        Year {event.year} · {event.location.placeName}
        {event.location.modernEquivalent && ` (${event.location.modernEquivalent})`}
      </p>

      <p style={{ color: '#4a4235', lineHeight: 1.6 }}>
        {event.description}
      </p>

      {event.categories.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {event.categories.map((cat) => (
            <span
              key={cat}
              style={{
                background: '#e8e4d9', color: '#6b5d4d',
                padding: '2px 8px', borderRadius: 12, fontSize: 12,
                fontFamily: 'sans-serif',
              }}
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {event.source.sourceUrl && (
        <a
          href={event.source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginTop: 16, color: '#4a90a4', fontSize: 14 }}
        >
          View source →
        </a>
      )}
    </div>
  );
}
