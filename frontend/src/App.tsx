import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChronoMap } from './components/Map/ChronoMap';
import { EventDetail } from './components/EventDetail/EventDetail';
import { DatePicker } from './components/DatePicker/DatePicker';
import { useEvents } from './hooks/useEvents';
import type { HistoricalEvent } from './types/event';

const queryClient = new QueryClient();

function getTodayDate(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function AppContent() {
  const [date, setDate] = useState(getTodayDate());
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);
  const { data, isLoading, error, refetch } = useEvents(date);

  const [fading, setFading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFading(true);
    const timer = setTimeout(() => setFading(false), 300);
    return () => clearTimeout(timer);
  }, [date]);

  const [cardClosing, setCardClosing] = useState(false);
  const compact = !!selectedEvent && !cardClosing;

  const handleCloseCard = useCallback(() => {
    setCardClosing(true);
    setTimeout(() => {
      setSelectedEvent(null);
      setCardClosing(false);
    }, 750);
  }, []);

  const resetToToday = useCallback(() => {
    setDate(getTodayDate());
    setSelectedEvent(null);
    setCardClosing(false);
  }, []);

  return (
    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", height: '100vh', background: '#F0EEE9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <a
        href="#main-content"
        style={{
          position: 'absolute', left: '-9999px', top: 'auto',
          width: '1px', height: '1px', overflow: 'hidden',
          zIndex: 1000, background: '#4a90a4', color: '#fff',
          padding: '8px 16px', borderRadius: 4,
          fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14,
        }}
        onFocus={(e) => { e.currentTarget.style.left = '8px'; e.currentTarget.style.top = '8px'; e.currentTarget.style.width = 'auto'; e.currentTarget.style.height = 'auto'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; e.currentTarget.style.top = 'auto'; e.currentTarget.style.width = '1px'; e.currentTarget.style.height = '1px'; }}
      >
        Skip to map
      </a>
      <header style={{
        padding: compact ? '6px 24px' : '16px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #e0ddd5',
        transition: 'padding 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <h1
          onClick={resetToToday}
          style={{
            margin: 0, color: '#3a3226', cursor: 'pointer',
            fontSize: compact ? 16 : 24,
            transition: 'font-size 0.75s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          🌍 Chrono Atlas
        </h1>
        <DatePicker value={date} onChange={setDate} />
      </header>

      <main id="main-content" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#8b7355' }}>
            <div style={{
              display: 'inline-block', width: 32, height: 32,
              border: '3px solid #e0ddd5', borderTopColor: '#4a90a4',
              borderRadius: '50%', marginBottom: 16,
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 18, margin: '0 0 6px' }}>Discovering events…</p>
            <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>First load may take up to a minute while we geocode locations</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && (
          <div style={{
            maxWidth: 420, margin: '40px auto', padding: 32, textAlign: 'center',
            border: '1px solid #e0ddd5', borderRadius: 10, background: '#fff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#3a3226', fontFamily: "'Playfair Display', Georgia, serif" }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8b7355', fontFamily: "'Inter', system-ui, sans-serif" }}>
              {error instanceof Error ? error.message : 'Failed to load events'}
            </p>
            <button
              onClick={() => refetch()}
              style={{
                background: '#4a90a4', color: '#fff', border: 'none',
                padding: '8px 20px', borderRadius: 6, fontSize: 14,
                fontFamily: "'Inter', system-ui, sans-serif", cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#3d7a8c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#4a90a4'; }}
            >
              Try again
            </button>
          </div>
        )}
        {data && (
          <>
            <div style={{
              opacity: fading ? 0 : 1,
              height: compact ? 'calc(100vh - 230px)' : 'calc(100vh - 120px)',
              transition: 'opacity 0.3s, height 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <ChronoMap events={data.data} selectedEvent={selectedEvent} onEventSelect={setSelectedEvent} />
              <p style={{ textAlign: 'center', color: '#8b7355', fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif", margin: '4px 0 0' }}>
                {data.meta.total} events · {data.meta.fictional} fictional
              </p>
            </div>
            <EventDetail event={selectedEvent} closing={cardClosing} onCloseRequest={handleCloseCard} />
          </>
        )}
      </main>

      <footer style={{
        textAlign: 'center', borderTop: '1px solid #e0ddd5',
        color: '#7a6e5a', fontSize: 12, fontFamily: "'Inter', system-ui, sans-serif",
        letterSpacing: 0.3,
        padding: compact ? '0' : '12px 0',
        maxHeight: compact ? 0 : 40,
        overflow: 'hidden', opacity: compact ? 0 : 1,
        transition: 'all 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        Chrono Atlas · Data from Wikipedia
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
