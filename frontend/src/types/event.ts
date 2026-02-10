export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  confidence: 'high' | 'medium' | 'low' | 'estimated';
  geocoder: 'nominatim' | 'azure_maps' | 'ai_inferred' | 'curated';
  placeName: string;
  modernEquivalent?: string;
}

export interface EventSource {
  type: 'wikipedia' | 'ai_generated';
  sourceUrl?: string;
  generatedAt?: string;
  modelVersion?: string;
  plausibilityScore?: number;
}

export interface HistoricalEvent {
  id: string;
  isoDate: string;
  source: EventSource;
  title: string;
  description: string;
  year: number;
  categories: string[];
  location: GeoLocation;
  media?: { imageUrl?: string; attribution?: string };
  createdAt: string;
}

export interface EventsResponse {
  data: HistoricalEvent[];
  meta: { total: number; fictional: number; cacheHit: boolean };
}
