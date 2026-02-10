import { useState } from 'react';
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
  const { data, isLoading, error } = useEvents(date);

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: '100vh', background: '#faf8f4', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #e0ddd5',
      }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#3a3226' }}>🌍 Chrono Atlas</h1>
        <DatePicker value={date} onChange={setDate} />
      </header>

      <main style={{ position: 'relative', padding: '24px 0', flex: 1 }}>
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
          <p style={{ textAlign: 'center', padding: 40, color: '#c44536' }}>Failed to load events</p>
        )}
        {data && (
          <>
            <ChronoMap events={data.data} selectedEvent={selectedEvent} onEventSelect={setSelectedEvent} />
            <p style={{ textAlign: 'center', color: '#8b7355', fontSize: 14, marginTop: 8 }}>
              {data.meta.total} events · {data.meta.fictional} fictional
            </p>
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </>
        )}
      </main>

      <footer style={{
        textAlign: 'center', padding: '12px 0', borderTop: '1px solid #e0ddd5',
        color: '#b5a88a', fontSize: 12, fontFamily: 'system-ui, sans-serif',
        letterSpacing: 0.3,
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
