import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchEvents } from '../services/api';

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * After the current date loads, silently prefetch ±1 day
 * so date navigation feels instant.
 */
export function usePrefetchAdjacentDates(currentDate: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const [month, day] = currentDate.split('-').map(Number);
    // Use a leap year so Feb 29 works
    const base = new Date(2000, month - 1, day);

    const prev = new Date(base);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(base);
    next.setDate(next.getDate() + 1);

    for (const d of [prev, next]) {
      const key = formatDate(d);
      queryClient.prefetchQuery({
        queryKey: ['events', key],
        queryFn: () => fetchEvents(key),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [currentDate, queryClient]);
}
