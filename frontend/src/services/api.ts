import type { EventsResponse, HistoricalEvent } from '../types/event';

const BASE_URL = '/api/v1';

export async function fetchEvents(date: string): Promise<EventsResponse> {
  const res = await fetch(`${BASE_URL}/events?date=${date}`);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
  return res.json();
}

export async function fetchEvent(id: string): Promise<HistoricalEvent> {
  const res = await fetch(`${BASE_URL}/events/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.statusText}`);
  return res.json();
}
