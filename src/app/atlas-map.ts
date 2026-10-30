import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { GeoJSON } from 'geojson';
import { GeoJSONSource, Map as MlMap, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import { Borders, EntityProps } from './atlas.service';

const EMPTY: Borders = { type: 'FeatureCollection', features: [] };

@Component({
  selector: 'app-atlas-map',
  template: `
    <div #container class="map"></div>
    <button class="projection-toggle" type="button" (click)="toggleProjection()">
      {{ globe() ? 'Flat map' : 'Globe' }}
    </button>
  `,
  styles: `
    :host { position: absolute; inset: 0; }
    .map { position: absolute; inset: 0; }
    .projection-toggle { position: absolute; left: 16px; bottom: 112px; }
    @media (max-width: 640px) { .projection-toggle { bottom: 150px; } }
  `,
})
export class AtlasMap implements OnDestroy {
  readonly borders = input<Borders | null>(null);
  readonly selectedName = input<string | null>(null);
  readonly entitySelect = output<EntityProps | null>();

  protected readonly globe = signal(true);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly ready = signal(false);
  private map?: MlMap;

  constructor() {
    afterNextRender(() => this.init());

    effect(() => {
      const borders = this.borders();
      if (this.ready() && borders) {
        this.map!.getSource<GeoJSONSource>('borders')!.setData(borders as GeoJSON);
      }
    });

    effect(() => {
      const name = this.selectedName();
      if (this.ready()) this.map!.setFilter('borders-selected', ['==', ['get', 'NAME'], name ?? '']);
    });
  }

  protected toggleProjection(): void {
    this.globe.update((g) => !g);
    this.map?.setProjection({ type: this.globe() ? 'globe' : 'mercator' });
  }

  private init(): void {
    // MapLibre finds its worker relative to its own module, which breaks once bundled,
    // so the worker is copied to /maplibre at build time (see angular.json assets).
    setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);

    const map = new MlMap({
      container: this.container().nativeElement,
      center: [20, 30],
      zoom: 1.6,
      renderWorldCopies: false,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: {
          borders: {
            type: 'geojson',
            data: EMPTY as GeoJSON,
            attribution:
              'Borders: <a href="https://github.com/aourednik/historical-basemaps" target="_blank">historical-basemaps</a> (GPL-3.0)',
          },
        },
        layers: [
          { id: 'ocean', type: 'background', paint: { 'background-color': '#b9cbc8' } },
          {
            id: 'borders-fill',
            type: 'fill',
            source: 'borders',
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.9 },
          },
          {
            id: 'borders-hover',
            type: 'fill',
            source: 'borders',
            filter: ['==', ['get', 'NAME'], ''],
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.25 },
          },
          {
            id: 'borders-line',
            type: 'line',
            source: 'borders',
            paint: { 'line-color': '#4a3b2a', 'line-width': 0.6, 'line-opacity': 0.55 },
          },
          {
            id: 'borders-selected',
            type: 'line',
            source: 'borders',
            filter: ['==', ['get', 'NAME'], ''],
            paint: { 'line-color': '#2a1b0b', 'line-width': 2.5 },
          },
        ],
      },
    });
    this.map = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const tooltip = new Popup({ closeButton: false, closeOnClick: false, className: 'hover-tip' });
    let hovered: string | null = null;

    map.on('mousemove', 'borders-fill', (e) => {
      const name = (e.features?.[0]?.properties['NAME'] as string | undefined) ?? null;
      map.getCanvas().style.cursor = name ? 'pointer' : '';
      if (name !== hovered) {
        hovered = name;
        map.setFilter('borders-hover', ['==', ['get', 'NAME'], name ?? '']);
      }
      if (name) tooltip.setLngLat(e.lngLat).setText(name).addTo(map);
      else tooltip.remove();
    });
    map.on('mouseleave', 'borders-fill', () => {
      hovered = null;
      map.getCanvas().style.cursor = '';
      map.setFilter('borders-hover', ['==', ['get', 'NAME'], '']);
      tooltip.remove();
    });
    map.on('click', (e) => {
      const [feature] = map.queryRenderedFeatures(e.point, { layers: ['borders-fill'] });
      const props = feature?.properties as EntityProps | undefined;
      this.entitySelect.emit(props?.NAME ? props : null);
    });

    map.on('load', () => this.ready.set(true));
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
