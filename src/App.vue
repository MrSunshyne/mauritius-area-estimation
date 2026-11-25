<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { LngLatBounds, type Map } from 'maplibre-gl';
import { createMap, PlotView, PositionView } from './map/map';
import { crosshairSigma, measure, type Corner } from './lib/area';
import { averagePosition, gps, startGps } from './lib/gps';
import { quote as makeQuote } from './lib/pricing';
import { decodeShape, encodeShape, loadDraft, loadPlots, loadSettings, saveDraft, savePlots, saveSettings, type SavedPlot } from './lib/store';
import { fmt, fmtLength, fmtM2, fmtRs, toUnits } from './lib/units';
import QuoteSheet from './components/QuoteSheet.vue';
import PlotsSheet from './components/PlotsSheet.vue';

const mapEl = ref<HTMLElement>();
const map = shallowRef<Map>();
let plotView: PlotView;
let positionView: PositionView;

const draft = loadDraft();
const corners = ref<Corner[]>(draft.corners);
const job = reactive(draft.job);
const settings = reactive(loadSettings());
const plots = ref<SavedPlot[]>(loadPlots());
const selected = ref<number | null>(null);
const sheet = ref<null | 'quote' | 'plots'>(null);
const toast = ref('');
const undoStack = shallowRef<Corner[][]>([]);
let followNextFix = false;

const m = computed(() => measure(corners.value));
const units = computed(() => toUnits(m.value.area));
const q = computed(() => makeQuote(m.value.area, job, settings));
const pct = computed(() => (m.value.area > 0 ? (m.value.uncertainty / m.value.area) * 100 : 0));

function say(text: string) {
  toast.value = text;
  setTimeout(() => toast.value === text && (toast.value = ''), 3500);
}

function remember() {
  undoStack.value = [...undoStack.value.slice(-99), corners.value.map((c) => ({ ...c }))];
}

function center() {
  const c = map.value!.getCenter();
  return { lng: c.lng, lat: c.lat };
}

function addOrMoveCorner() {
  if (!map.value) return;
  const c = center();
  const sigma = crosshairSigma(map.value.getZoom(), c.lat);
  remember();
  if (selected.value !== null) {
    corners.value[selected.value] = { ...c, sigma, source: 'map' };
    selected.value = null;
  } else {
    corners.value.push({ ...c, sigma, source: 'map' });
  }
  if (map.value.getZoom() < 17) say('Zoom in closer for more precise corners.');
}

function undo() {
  const prev = undoStack.value.at(-1);
  undoStack.value = undoStack.value.slice(0, -1);
  if (prev) {
    corners.value = prev;
    selected.value = null;
  }
}

function deleteSelected() {
  if (selected.value === null) return;
  remember();
  corners.value.splice(selected.value, 1);
  selected.value = null;
}

function clearAll() {
  if (corners.value.length && !confirm('Clear this outline?')) return;
  remember();
  corners.value = [];
  selected.value = null;
  undoStack.value = undoStack.value.slice(-1);
}

function locate() {
  startGps();
  if (gps.fix) {
    map.value?.flyTo({ center: [gps.fix.lng, gps.fix.lat], zoom: Math.max(map.value.getZoom(), 18) });
  } else {
    followNextFix = true;
  }
}

const averaging = ref<null | { n: number; accuracy: number; left: number; stop: () => void }>(null);

async function gpsCorner() {
  startGps();
  const seconds = 10;
  const progress = reactive({ n: 0, accuracy: Infinity, left: seconds, stop: () => {} });
  averaging.value = progress;
  const run = averagePosition(seconds * 1000, (n, accuracy) => Object.assign(progress, { n, accuracy }));
  progress.stop = run.stop;
  const tick = setInterval(() => progress.left > 0 && progress.left--, 1000);
  const fix = await run.result;
  clearInterval(tick);
  averaging.value = null;
  if (!fix) return say(gps.error || 'No GPS position yet. Try again outside, away from walls.');
  remember();
  const corner: Corner = { lng: fix.lng, lat: fix.lat, sigma: fix.sigma, source: 'gps' };
  if (selected.value !== null) {
    corners.value[selected.value] = corner;
    selected.value = null;
  } else {
    corners.value.push(corner);
  }
  say(`Corner from ${fix.fixes} GPS fixes, ±${fmt(fix.accuracy, 1)} m.`);
}

function fitPlot(list = corners.value) {
  if (!map.value || list.length === 0) return;
  const b = new LngLatBounds();
  for (const c of list) b.extend([c.lng, c.lat]);
  map.value.fitBounds(b, { padding: { top: 170, bottom: 190, left: 40, right: 40 }, maxZoom: 19.5, duration: 600 });
}

function summary(): string {
  const u = units.value;
  const lines = [
    `Area: ${fmtM2(u.m2)} (±${fmt(pct.value, 0)}%)`,
    `= ${fmt(u.perches, 1)} perches = ${fmt(u.arpents, 2)} arpents`,
    `Perimeter: ${fmtLength(m.value.perimeter)}`,
  ];
  if (m.value.area > 0) {
    lines.push(`Estimate: ${fmtRs(q.value.mid.price)} (${fmtRs(q.value.low.price)}–${fmtRs(q.value.high.price)}), about ${fmt(q.value.mid.days, 1)} day(s)`);
  }
  return lines.join('\n');
}

function shareLink(): string {
  return `${location.origin}${location.pathname}#${encodeShape(corners.value)}`;
}

async function share() {
  const text = summary();
  const url = shareLink();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Plot area', text, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`);
  say('Copied to the clipboard.');
}

function savePlot() {
  const name = prompt('Name this plot', `Plot ${new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`);
  if (name === null) return;
  plots.value.unshift({
    id: crypto.randomUUID(),
    name: name.trim() || 'Plot',
    savedAt: new Date().toISOString(),
    corners: corners.value.map((c) => ({ ...c })),
    job: JSON.parse(JSON.stringify(job)),
    area: m.value.area,
  });
  savePlots(plots.value);
  say('Saved on this phone.');
}

function openPlot(p: SavedPlot) {
  remember();
  corners.value = p.corners.map((c) => ({ ...c }));
  Object.assign(job, JSON.parse(JSON.stringify(p.job)));
  selected.value = null;
  sheet.value = null;
  fitPlot(p.corners);
}

function deletePlot(id: string) {
  plots.value = plots.value.filter((p) => p.id !== id);
  savePlots(plots.value);
}

watch([corners, job], () => saveDraft(corners.value, job), { deep: true });
watch(settings, () => saveSettings(settings), { deep: true });
watch(
  () => gps.fix,
  (fix) => {
    positionView?.update(fix);
    if (fix && followNextFix && map.value) {
      followNextFix = false;
      map.value.flyTo({ center: [fix.lng, fix.lat], zoom: 18.5 });
    }
  },
);
watch([corners, selected], () => {
  if (!plotView) return;
  plotView.update(corners.value, m.value.edges, selected.value);
  plotView.preview(corners.value, selected.value === null);
}, { deep: true });

onMounted(() => {
  const mp = createMap(mapEl.value!);
  map.value = mp;
  mp.on('load', () => {
    plotView = new PlotView(mp, {
      onDragStart(i) {
        remember();
        selected.value = i;
      },
      onDrag(i, lng, lat) {
        corners.value[i] = { ...corners.value[i], lng, lat, sigma: crosshairSigma(mp.getZoom(), lat), source: 'map' };
      },
      onSelect(i) {
        selected.value = selected.value === i ? null : i;
        if (selected.value !== null) mp.easeTo({ center: [corners.value[i].lng, corners.value[i].lat], duration: 300 });
      },
      onInsert(i) {
        remember();
        const a = corners.value[i];
        const b = corners.value[(i + 1) % corners.value.length];
        corners.value.splice(i + 1, 0, { lng: (a.lng + b.lng) / 2, lat: (a.lat + b.lat) / 2, sigma: Math.max(a.sigma, b.sigma), source: 'map' });
        selected.value = i + 1;
        mp.easeTo({ center: [corners.value[i + 1].lng, corners.value[i + 1].lat], duration: 300 });
      },
    });
    positionView = new PositionView(mp);
    plotView.update(corners.value, m.value.edges, selected.value);
    mp.on('move', () => plotView.preview(corners.value, selected.value === null));

    const shared = decodeShape(location.hash);
    if (shared) {
      corners.value = shared;
      window.history.replaceState(null, '', location.pathname);
      fitPlot(shared);
    } else if (corners.value.length) {
      fitPlot();
    } else {
      locate();
    }
  });
});
</script>

<template>
  <div ref="mapEl" class="map"></div>
  <div class="reticle" :class="{ moving: selected !== null }" aria-hidden="true"></div>

  <header v-if="m.area > 0 || selected === null" class="readout" @click="m.area > 0 && (sheet = 'quote')">
    <template v-if="m.area > 0">
      <div class="big">{{ fmtM2(units.m2) }} <small>±{{ fmt(pct, pct < 10 ? 1 : 0) }}%</small></div>
      <div class="sub">
        <b>{{ fmt(units.perches, 1) }}</b> perches · <b>{{ fmt(units.arpents, 2) }}</b> arpents ·
        {{ fmt(units.hectares, 3) }} ha
      </div>
      <div class="sub muted">
        Perimeter {{ fmtLength(m.perimeter) }} · {{ corners.length }} corners · ±{{ fmt(m.uncertainty, 0) }} m²
      </div>
      <div v-if="m.selfIntersecting" class="warn">Edges cross, so this area is wrong. Tap a corner and move it.</div>
    </template>
    <div v-else class="hint">
      Pan the map so the <b>+</b> sits on a corner of the plot, then press <b>+ Corner</b>. Go round the plot.
    </div>
  </header>

  <div class="side">
    <button class="round" :class="{ on: gps.status === 'on', wait: gps.status === 'waiting' }" title="My position" @click="locate">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" fill="none" /></svg>
    </button>
    <button class="round" title="Show the whole plot" :disabled="!corners.length" @click="fitPlot()">
      <svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" /></svg>
    </button>
    <button class="round" title="Saved plots" @click="sheet = 'plots'">
      <svg viewBox="0 0 24 24"><path d="M5 4h14v16l-7-4-7 4z" fill="none" /></svg>
    </button>
  </div>

  <div v-if="toast" class="toast">{{ toast }}</div>
  <div v-if="gps.status === 'error'" class="toast error">{{ gps.error }}</div>

  <footer class="bar">
    <div v-if="averaging" class="averaging">
      <div>
        Hold still on the corner… {{ averaging.left }} s<br />
        <small>{{ averaging.n }} fixes{{ averaging.n ? `, best ±${fmt(averaging.accuracy, 1)} m` : '' }}</small>
      </div>
      <button class="primary" @click="averaging.stop()">Use now</button>
    </div>
    <template v-else>
      <div class="row">
        <button :disabled="!undoStack.length" @click="undo">Undo</button>
        <button class="primary" @click="addOrMoveCorner">{{ selected !== null ? 'Move corner here' : '+ Corner' }}</button>
        <button title="Put a corner where you stand (averages GPS for 10 s)" @click="gpsCorner">
          {{ selected !== null ? 'Move to GPS' : 'GPS corner' }}
        </button>
      </div>
      <div class="row small">
        <template v-if="selected !== null">
          <button @click="deleteSelected">Delete corner</button>
          <button @click="selected = null">Done</button>
        </template>
        <template v-else>
          <button class="quote" :disabled="m.area === 0" @click="sheet = 'quote'">
            {{ m.area > 0 ? `${fmtRs(q.mid.price)} · ${fmt(q.mid.days, 1)} d` : 'Quote' }}
          </button>
          <button :disabled="m.area === 0" @click="savePlot">Save</button>
          <button :disabled="m.area === 0" @click="share">Share</button>
          <button :disabled="!corners.length" @click="clearAll">Clear</button>
        </template>
      </div>
    </template>
  </footer>

  <QuoteSheet v-if="sheet === 'quote'" :area="m.area" :job="job" :settings="settings" :quote="q" @close="sheet = null" />
  <PlotsSheet v-if="sheet === 'plots'" :plots="plots" @open="openPlot" @delete="deletePlot" @close="sheet = null" />
</template>
