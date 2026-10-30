import { Component, input, output, resource } from '@angular/core';
import { EntityProps } from './atlas.service';

interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
}

const PRECISION = ['', 'Approximate', 'Moderately precise', 'Determined by law'];

@Component({
  selector: 'app-entity-panel',
  template: `
    <button class="close" type="button" aria-label="Close" (click)="closed.emit()">×</button>
    <h2>{{ entity().NAME }}</h2>
    @if (!present()) {
      <p class="absent">Not on the map in {{ yearLabel() }}.</p>
    }
    <dl>
      @if (entity().SUBJECTO && entity().SUBJECTO !== entity().NAME) {
        <dt>Subject of</dt>
        <dd>{{ entity().SUBJECTO }}</dd>
      }
      @if (entity().PARTOF && entity().PARTOF !== entity().NAME) {
        <dt>Part of</dt>
        <dd>{{ entity().PARTOF }}</dd>
      }
      @if (entity().BORDERPRECISION) {
        <dt>Borders</dt>
        <dd>{{ precision[entity().BORDERPRECISION!] }}</dd>
      }
    </dl>

    @if (summary.isLoading()) {
      <p class="muted">Loading from Wikipedia…</p>
    } @else if (summary.value(); as wiki) {
      @if (wiki.thumbnail) {
        <img [src]="wiki.thumbnail" [alt]="wiki.title" />
      }
      @if (wiki.title !== entity().NAME) {
        <p class="muted">Closest Wikipedia article: {{ wiki.title }}</p>
      }
      <p>{{ wiki.extract }}</p>
      <a [href]="wiki.url" target="_blank" rel="noopener">Read more on Wikipedia →</a>
    } @else {
      <p class="muted">No matching Wikipedia article found.</p>
    }
  `,
})
export class EntityPanel {
  readonly entity = input.required<EntityProps>();
  readonly present = input(true);
  readonly yearLabel = input('');
  readonly closed = output<void>();

  protected readonly precision = PRECISION;

  protected readonly summary = resource({
    params: () => this.entity().NAME ?? undefined,
    loader: async ({ params: name, abortSignal }) =>
      // Dataset names often aren't article titles, so fall back to a search.
      (await fetchSummary(name, abortSignal)) ??
      (await fetchSummary(await searchTitle(name, abortSignal), abortSignal)),
  });
}

async function fetchSummary(title: string | null, signal: AbortSignal): Promise<WikiSummary | null> {
  if (!title) return null;
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    { signal },
  );
  if (!res.ok) return null;
  const page = await res.json();
  if (page.type === 'disambiguation') return null;
  return {
    title: page.title,
    extract: page.extract,
    url: page.content_urls?.desktop?.page,
    thumbnail: page.thumbnail?.source,
  };
}

async function searchTitle(query: string, signal: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '1',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.search?.[0]?.title ?? null;
}
