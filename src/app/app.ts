import { Component, computed, effect, inject, signal } from '@angular/core';
import { AtlasMap } from './atlas-map';
import { AtlasService, Borders, EntityProps } from './atlas.service';
import { EntityPanel } from './entity-panel';
import { SNAPSHOTS, formatYear } from './snapshots';

const PLAY_INTERVAL_MS = 1500;

@Component({
  selector: 'app-root',
  imports: [AtlasMap, EntityPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(window:keydown)': 'onKey($event)' },
})
export class App {
  private readonly atlas = inject(AtlasService);

  protected readonly snapshots = SNAPSHOTS;
  protected readonly formatYear = formatYear;
  protected readonly index = signal(SNAPSHOTS.findIndex((s) => s.year === 1492));
  protected readonly snapshot = computed(() => SNAPSHOTS[this.index()]);
  protected readonly borders = signal<Borders | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly selected = signal<EntityProps | null>(null);

  /** Whether the selected entity exists in the year currently shown. */
  protected readonly selectedPresent = computed(() => {
    const name = this.selected()?.NAME;
    return !!name && !!this.borders()?.features.some((f) => f.properties.NAME === name);
  });

  constructor() {
    effect((onCleanup) => {
      const i = this.index();
      let stale = false;
      onCleanup(() => (stale = true));

      this.loading.set(true);
      this.atlas
        .load(SNAPSHOTS[i])
        .then((borders) => {
          if (stale) return;
          this.borders.set(borders);
          this.error.set(null);
          // Warm the cache for the next step of the timeline.
          if (i + 1 < SNAPSHOTS.length) this.atlas.load(SNAPSHOTS[i + 1]).catch(() => {});
        })
        .catch((err: Error) => {
          if (stale) return;
          this.error.set(err.message);
          this.playing.set(false);
        })
        .finally(() => !stale && this.loading.set(false));
    });

    // Advance only after the current year has loaded, so playback never skips frames.
    effect((onCleanup) => {
      if (!this.playing() || this.loading()) return;
      const i = this.index();
      if (i >= SNAPSHOTS.length - 1) {
        this.playing.set(false);
        return;
      }
      const timer = setTimeout(() => this.index.set(i + 1), PLAY_INTERVAL_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected step(delta: number): void {
    this.index.update((i) => Math.min(SNAPSHOTS.length - 1, Math.max(0, i + delta)));
  }

  protected togglePlay(): void {
    if (!this.playing() && this.index() === SNAPSHOTS.length - 1) this.index.set(0);
    this.playing.update((p) => !p);
  }

  protected onSlider(event: Event): void {
    this.index.set(Number((event.target as HTMLInputElement).value));
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowLeft') this.step(-1);
    else if (event.key === 'ArrowRight') this.step(1);
    else if (event.key === ' ') {
      event.preventDefault();
      this.togglePlay();
    } else if (event.key === 'Escape') this.selected.set(null);
  }
}
