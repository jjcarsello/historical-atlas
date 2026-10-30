import { Injectable } from '@angular/core';
import { DATA_BASE_URL, Snapshot } from './snapshots';

/** Properties of a polygon in the historical-basemaps dataset. */
export interface EntityProps {
  NAME: string | null;
  /** Sovereign power the entity belongs to, e.g. a colony's empire. */
  SUBJECTO: string | null;
  /** Larger cultural or political group the entity is part of. */
  PARTOF: string | null;
  /** 1 = approximate, 2 = moderately precise, 3 = determined by law. */
  BORDERPRECISION: number | null;
  color: string;
}

export interface Borders {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: EntityProps; geometry: unknown }[];
}

// Muted, map-like tones that stay distinguishable next to each other.
const PALETTE = [
  '#c9a66b', '#b5714f', '#8f9e6b', '#c48a8a', '#b89a7a', '#d2b48c', '#a68aab',
  '#9fb38f', '#d19c6a', '#9a8f6e', '#c7b37a', '#b08060', '#a3a7c9', '#c9928f',
];
const UNCLAIMED = '#e4dac4';

function colorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

@Injectable({ providedIn: 'root' })
export class AtlasService {
  private readonly cache = new Map<string, Promise<Borders>>();

  load(snapshot: Snapshot): Promise<Borders> {
    let request = this.cache.get(snapshot.file);
    if (!request) {
      request = this.fetchBorders(snapshot.file);
      // Drop failed requests so a retry can hit the network again.
      request.catch(() => this.cache.delete(snapshot.file));
      this.cache.set(snapshot.file, request);
    }
    return request;
  }

  private async fetchBorders(file: string): Promise<Borders> {
    const res = await fetch(DATA_BASE_URL + file);
    if (!res.ok) throw new Error(`Failed to load ${file} (${res.status})`);
    const borders: Borders = await res.json();
    for (const feature of borders.features) {
      const p = feature.properties;
      // Color by sovereign so colonies share their empire's color.
      const key = p.SUBJECTO ?? p.NAME;
      p.color = key ? colorFor(key) : UNCLAIMED;
    }
    return borders;
  }
}
