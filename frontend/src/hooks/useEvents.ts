import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../services/api';

export function useEvents(date: string) {
  return useQuery({
    queryKey: ['events', date],
    queryFn: async () => {
      const t0 = performance.now();
      const result = await fetchEvents(date);
      console.log(`[perf] API fetch ${date}: ${Math.round(performance.now() - t0)}ms, ${result.data.length} events`);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    gcTime: 30 * 60 * 1000,
  });
}
