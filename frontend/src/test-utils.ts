import type { HistoricalEvent } from './types/event';

export function mockEvent(overrides: Partial<HistoricalEvent> = {}): HistoricalEvent {
  return {
    id: 'evt-001',
    isoDate: '2001-07-04',
    title: 'Signing of the Declaration',
    description: 'A pivotal moment in history.',
    year: 1776,
    categories: ['politics', 'military'],
    source: { type: 'wikipedia', sourceUrl: 'https://en.wikipedia.org/wiki/Example' },
    location: {
      type: 'Point',
      coordinates: [-75.15, 39.95],
      confidence: 'high',
      geocoder: 'nominatim',
      placeName: 'Philadelphia',
      modernEquivalent: 'Philadelphia, PA',
    },
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
