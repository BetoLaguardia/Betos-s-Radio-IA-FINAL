const DURATION_CACHE_KEY = 'betos_radio_real_durations_v1';

export function loadCachedDurations(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DURATION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, number>;
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function saveCachedDuration(audioUrl: string, durationSeconds: number): void {
  if (!audioUrl || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
  try {
    const current = loadCachedDurations();
    current[audioUrl] = Math.round(durationSeconds);
    localStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

export function probeAudioDuration(audioUrl: string, timeoutMs = 12000): Promise<number | null> {
  return new Promise((resolve) => {
    if (!audioUrl || typeof window === 'undefined') {
      resolve(null);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    let timer: number | undefined;

    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('error', onError);
      audio.src = '';
      audio.load();
    };

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        finish(Math.round(d));
      }
    };

    const onError = () => {
      finish(null);
    };

    timer = window.setTimeout(() => finish(null), timeoutMs);

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('error', onError);
    audio.src = audioUrl;
  });
}

export async function getAudioDurationFromFile(file: File): Promise<number | undefined> {
  if (typeof window === 'undefined') return undefined;
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await probeAudioDuration(objectUrl, 8000);
    return duration ?? undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
