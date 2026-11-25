import { reactive } from 'vue';

export interface Fix {
  lng: number;
  lat: number;
  /** 68% confidence radius, metres (Geolocation API). */
  accuracy: number;
}

export const gps = reactive({
  status: 'off' as 'off' | 'waiting' | 'on' | 'error',
  error: '',
  fix: null as Fix | null,
});

let watchId: number | null = null;
const listeners = new Set<(f: Fix) => void>();

export function startGps() {
  if (watchId !== null) return;
  if (!('geolocation' in navigator)) {
    gps.status = 'error';
    gps.error = 'This browser has no location.';
    return;
  }
  gps.status = 'waiting';
  gps.error = '';
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const fix = { lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy };
      gps.fix = fix;
      gps.status = 'on';
      gps.error = '';
      for (const l of listeners) l(fix);
    },
    (e) => {
      if (e.code === e.PERMISSION_DENIED) {
        gps.status = 'error';
        gps.error = 'Location is blocked. Allow it for this site in the browser settings.';
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
      } else if (gps.status !== 'on') {
        gps.error = 'Still looking for your position…';
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
}

export interface AveragedFix extends Fix {
  fixes: number;
  /** 1-sigma error per axis, metres. */
  sigma: number;
}

/**
 * Averages fixes for `ms` (or until `stop()`), weighting each by 1/accuracy² and dropping
 * fixes much worse than the best one. Phone GPS errors drift slowly, so this helps less
 * than √n; sigma is therefore taken from the typical accuracy, not divided by √n.
 */
export function averagePosition(ms: number, onProgress: (n: number, accuracy: number) => void) {
  const fixes: Fix[] = [];
  const { promise: result, resolve: done } = Promise.withResolvers<AveragedFix | null>();
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    listeners.delete(onFix);
    clearTimeout(timer);
    if (fixes.length === 0) return done(null);
    const best = Math.min(...fixes.map((f) => f.accuracy));
    const kept = fixes.filter((f) => f.accuracy <= Math.max(8, best * 2));
    let w = 0, lng = 0, lat = 0, acc = 0;
    for (const f of kept) {
      const wi = 1 / f.accuracy ** 2;
      w += wi;
      lng += f.lng * wi;
      lat += f.lat * wi;
      acc += f.accuracy * wi;
    }
    const accuracy = acc / w;
    done({ lng: lng / w, lat: lat / w, accuracy, fixes: kept.length, sigma: accuracy / 1.51 });
  };
  const onFix = (f: Fix) => {
    fixes.push(f);
    onProgress(fixes.length, Math.min(...fixes.map((x) => x.accuracy)));
  };

  listeners.add(onFix);
  if (gps.fix) onFix(gps.fix);
  const timer = setTimeout(finish, ms);
  return { result, stop: finish };
}
