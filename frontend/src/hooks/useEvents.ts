import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../services/api';

export function useEvents(date: string) {
  return useQuery({
    queryKey: ['events', date],
    queryFn: () => fetchEvents(date),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // First load can take ~30-60s due to geocoding
    gcTime: 30 * 60 * 1000,
  });
}
