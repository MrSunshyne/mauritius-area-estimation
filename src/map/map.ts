import { Map, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Corner } from '../lib/area';
import { fmtLength } from '../lib/units';

setWorkerUrl(workerUrl);

// Esri World Imagery: over Mauritius a Vantor mosaic captured Mar–Jun 2025, 0.34–0.5 m.
// Native tiles stop at z19 (z20 returns a "not yet available" picture), so the source is
// capped there and MapLibre over-zooms it. With an ArcGIS Location Platform key the
// licensed endpoint is used; without one, the public endpoint (fine for trying the app).
const key = import.meta.env.VITE_ARCGIS_API_KEY as string | undefined;
const imageryUrl = key
  ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${key}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const style: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [imageryUrl],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Powered by Esri · Esri, Vantor, Earthstar Geographics, GIS User Community',
    },
    plot: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    preview: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    accuracy: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'accuracy', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 } },
    { id: 'plot-fill', type: 'fill', source: 'plot', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#facc15', 'fill-opacity': 0.22 } },
    { id: 'plot-line', type: 'line', source: 'plot', paint: { 'line-color': '#facc15', 'line-width': 2.5 } },
    { id: 'preview', type: 'line', source: 'preview', paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [2, 2] } },
  ],
};

export const MAURITIUS = { center: [57.57, -20.25] as [number, number], zoom: 9.3 };

export function createMap(container: HTMLElement): Map {
  return new Map({
    container,
    style,
    center: MAURITIUS.center,
    zoom: MAURITIUS.zoom,
    maxZoom: 21,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  });
}

type Pos = [number, number];
const ring = (corners: Corner[]): Pos[] => corners.map((c) => [c.lng, c.lat]);

export interface PlotHandlers {
  onDragStart(index: number): void;
  onDrag(index: number, lng: number, lat: number): void;
  onSelect(index: number): void;
  onInsert(afterIndex: number): void;
}

/** Draws the outline, its corners (tap to select, then drag) and edge lengths (tap to add a corner). */
export class PlotView {
  private corners: Marker[] = [];
  private labels: Marker[] = [];
  private draggedAt = 0;

  constructor(private map: Map, private handlers: PlotHandlers) {}

  update(corners: Corner[], edges: number[], selected: number | null) {
    const pts = ring(corners);
    const features: Feature[] = [];
    if (pts.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
    else if (pts.length === 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
    (this.map.getSource('plot') as GeoJSONSource).setData({ type: 'FeatureCollection', features });

    this.sync(this.corners, corners.length, (i) => {
      const el = document.createElement('button');
      el.className = 'corner';
      el.setAttribute('aria-label', `Corner ${i + 1}`);
      // Only the selected corner drags, so panning the map from on top of a corner is safe.
      const m = new Marker({ element: el, draggable: false });
      m.on('dragstart', () => this.handlers.onDragStart(i));
      m.on('drag', () => {
        const p = m.getLngLat();
        this.handlers.onDrag(i, p.lng, p.lat);
      });
      m.on('dragend', () => (this.draggedAt = performance.now()));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() - this.draggedAt > 300) this.handlers.onSelect(i);
      });
      return m;
    });
    this.corners.forEach((m, i) => {
      m.setLngLat(pts[i]);
      m.getElement().classList.toggle('selected', i === selected);
      m.setDraggable(i === selected);
      m.getElement().classList.toggle('gps', corners[i].source === 'gps');
    });

    this.sync(this.labels, edges.length, (i) => {
      const el = document.createElement('button');
      el.className = 'edge';
      el.title = 'Tap to add a corner here';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlers.onInsert(i);
      });
      return new Marker({ element: el });
    });
    this.labels.forEach((m, i) => {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      m.setLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      m.getElement().textContent = fmtLength(edges[i]);
    });
  }

  /** Dashed guide from the last corner to the crosshair and back to the first. */
  preview(corners: Corner[], show: boolean) {
    const c = this.map.getCenter();
    const pts = ring(corners);
    const coords: Pos[] = !show || pts.length === 0 ? [] : pts.length === 1 ? [pts[0], [c.lng, c.lat]] : [pts[pts.length - 1], [c.lng, c.lat], pts[0]];
    (this.map.getSource('preview') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: coords.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
    });
  }

  /** Index ids of markers are positional, so markers are only created or removed at the end. */
  private sync(list: Marker[], n: number, make: (i: number) => Marker) {
    while (list.length > n) list.pop()!.remove();
    while (list.length < n) list.push(make(list.length).setLngLat([0, 0]).addTo(this.map));
  }
}

/** Blue dot and accuracy circle for the phone's position. */
export class PositionView {
  private dot: Marker | null = null;

  constructor(private map: Map) {}

  update(fix: { lng: number; lat: number; accuracy: number } | null) {
    const src = this.map.getSource('accuracy') as GeoJSONSource;
    if (!fix) {
      this.dot?.remove();
      this.dot = null;
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    if (!this.dot) {
      const el = document.createElement('div');
      el.className = 'me';
      this.dot = new Marker({ element: el }).setLngLat([fix.lng, fix.lat]).addTo(this.map);
    }
    this.dot.setLngLat([fix.lng, fix.lat]);
    const kx = 111_320 * Math.cos((fix.lat * Math.PI) / 180);
    const circle: Pos[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * 2 * Math.PI;
      circle.push([fix.lng + (fix.accuracy * Math.cos(t)) / kx, fix.lat + (fix.accuracy * Math.sin(t)) / 110_574]);
    }
    src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle] } }] });
  }
}
