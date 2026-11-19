import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Type,
  Sparkles,
  Music,
  Timer,
  RotateCcw,
  Save,
  Crosshair,
} from 'lucide-react';

interface LyricsDisplayProps {
  lyrics: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek?: (seconds: number) => void;
  title?: string;
  artist?: string;
  hasSong?: boolean;
  songId?: string;
  isAdmin?: boolean;
  onSaveSyncedLyrics?: (songId: string, syncedLrcLyrics: string) => Promise<void> | void;
}

interface ParsedLine {
  id: number;
  raw: string;
  isHeader: boolean;
  isInstrumental: boolean;
  text: string;
  tag?: string;
  approxTime: number;
}

const SECTION_KEYWORDS = /^(intro|verse|verso|pre-?chorus|pr[eé]-?refr[aã]o|chorus|refr[aã]o|refr[aã]o final|final chorus|bridge|ponte|outro|solo|guitar solo|solo de guitarra|instrumental|instrumental bridge|interlude|hook|breakdown|spoken|ad-?lib)/i;
const INSTRUMENTAL_KEYWORDS = /(intro|solo|instrumental|interlude|guitar|sax|piano break|bridge instrumental)/i;
const LRC_LINE_REGEX = /^((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)$/;
const LRC_TAG_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const LRC_META_REGEX = /^\[(ti|ar|al|au|by|length|offset|re|ve):.*\]$/i;

const SYNC_OFFSETS_KEY = 'betos_radio_sync_offsets_v1';
const CUSTOM_LRC_KEY = 'betos_radio_custom_lrc_v1';

function normalizeComparable(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isBareSectionLabel(line: string): boolean {
  const cleaned = line.replace(/[:\-–—]+$/, '').trim();
  if (cleaned.length > 36) return false;
  return SECTION_KEYWORDS.test(cleaned) && !/[.!?,;]/.test(cleaned);
}

function getSectionPaceMultiplier(tag: string): number {
  const t = tag.toLowerCase();
  if (/chorus|refr[aã]o/.test(t) && !/pr[eé]/.test(t)) return 0.9;
  if (/pre-?chorus|pr[eé]-?refr[aã]o/.test(t)) return 0.95;
  if (/bridge|ponte/.test(t)) return 1.08;
  if (/outro/.test(t)) return 1.1;
  return 1.0;
}

function estimateVocalWeight(text: string, sectionPace: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const vowels = (text.match(/[aeiouáéíóúâêîôûãõàü]/gi) || []).length;
  const base = Math.max(vowels, Math.round(text.trim().length * 0.42));
  return Math.max(4, base + words.length * 1.35) * sectionPace;
}

function formatLrcTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

function loadSavedOffset(songId?: string): number {
  if (!songId) return 0;
  try {
    const raw = localStorage.getItem(SYNC_OFFSETS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return typeof map[songId] === 'number' ? map[songId] : 0;
  } catch {
    return 0;
  }
}

function saveOffset(songId: string | undefined, offset: number): void {
  if (!songId) return;
  try {
    const raw = localStorage.getItem(SYNC_OFFSETS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (offset === 0) {
      delete map[songId];
    } else {
      map[songId] = offset;
    }
    localStorage.setItem(SYNC_OFFSETS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function loadCustomLrc(songId?: string): string | null {
  if (!songId) return null;
  try {
    const raw = localStorage.getItem(CUSTOM_LRC_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return typeof map[songId] === 'string' ? map[songId] : null;
  } catch {
    return null;
  }
}

function saveCustomLrc(songId: string | undefined, lrc: string | null): void {
  if (!songId) return;
  try {
    const raw = localStorage.getItem(CUSTOM_LRC_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (!lrc) {
      delete map[songId];
    } else {
      map[songId] = lrc;
    }
    localStorage.setItem(CUSTOM_LRC_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  title,
  artist,
  hasSong = true,
  songId,
  isAdmin = false,
  onSaveSyncedLyrics,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [autoScroll, setAutoScroll] = useState(true);
  const [syncOffset, setSyncOffset] = useState<number>(() => loadSavedOffset(songId));
  const [customLrc, setCustomLrc] = useState<string | null>(() => loadCustomLrc(songId));

  // Interactive Tap-to-Sync state
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncCursor, setSyncCursor] = useState(0);
  const [recordedTimestamps, setRecordedTimestamps] = useState<Record<number, number>>({});
  const [savingToDb, setSavingToDb] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Load saved offset and custom LRC when song changes
  useEffect(() => {
    setSyncOffset(loadSavedOffset(songId));
    setCustomLrc(loadCustomLrc(songId));
    setIsSyncMode(false);
    setSyncCursor(0);
    setRecordedTimestamps({});
    setSavedNotice(null);
  }, [songId]);

  const handleUpdateOffset = (next: number) => {
    const rounded = Number(next.toFixed(1));
    setSyncOffset(rounded);
    saveOffset(songId, rounded);
  };

  // Prefer server LRC if server lyrics already contain timestamps, otherwise use local custom LRC if recorded
  const serverHasLrc = useMemo(
    () => Boolean(lyrics && /\[\d{1,3}:\d{2}/.test(lyrics)),
    [lyrics]
  );
  const activeSourceLyrics = serverHasLrc ? lyrics : customLrc || lyrics;

  const { parsedLines, hasExactTimestamps } = useMemo(() => {
    if (!hasSong || !activeSourceLyrics || !activeSourceLyrics.trim()) {
      return { parsedLines: [] as ParsedLine[], hasExactTimestamps: false };
    }
    const rawLines = activeSourceLyrics.split(/\r?\n/);

    // 1. Check if lyrics contain LRC timestamps like [00:24.50]
    const lrcParsed: ParsedLine[] = [];
    let foundLrc = false;

    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      if (!trimmed || LRC_META_REGEX.test(trimmed)) continue;

      const match = trimmed.match(LRC_LINE_REGEX);
      if (match) {
        foundLrc = true;
        const tagPart = match[1];
        const lyricText = match[2].trim();
        const tags = Array.from(tagPart.matchAll(LRC_TAG_REGEX));

        for (const t of tags) {
          const mins = parseInt(t[1], 10);
          const secs = parseInt(t[2], 10);
          const fracStr = t[3] || '0';
          const frac = parseInt(fracStr, 10) / Math.pow(10, fracStr.length);
          const timeSec = mins * 60 + secs + frac;

          const isBracketHeader = lyricText.startsWith('[') && lyricText.endsWith(']');
          const cleanText = isBracketHeader
            ? lyricText.slice(1, -1).trim()
            : lyricText || '♪ Instrumental ♪';

          lrcParsed.push({
            id: lrcParsed.length,
            raw: trimmed,
            isHeader: isBracketHeader,
            isInstrumental: !lyricText || INSTRUMENTAL_KEYWORDS.test(cleanText),
            text: cleanText,
            tag: isBracketHeader ? cleanText : undefined,
            approxTime: timeSec,
          });
        }
      }
    }

    if (foundLrc && lrcParsed.length > 0) {
      return {
        parsedLines: lrcParsed.sort((a, b) => a.approxTime - b.approxTime),
        hasExactTimestamps: true,
      };
    }

    // 2. Non-timestamped lyrics: classify lines, strip repeated title header, preserve stanza pauses
    interface DraftLine {
      raw: string;
      isHeader: boolean;
      isInstrumental: boolean;
      text: string;
      tag?: string;
      gapBefore: boolean;
      paceMultiplier: number;
      weight: number;
    }

    const drafts: DraftLine[] = [];
    let pendingGap = false;
    let currentPace = 1.0;
    const normalizedTitle = title ? normalizeComparable(title) : '';

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (drafts.length > 0) pendingGap = true;
        continue;
      }

      const isBracketHeader = trimmed.startsWith('[') && trimmed.endsWith(']');
      const isParenCue =
        trimmed.startsWith('(') && trimmed.endsWith(')') && INSTRUMENTAL_KEYWORDS.test(trimmed);
      const isBareHeader = !isBracketHeader && isBareSectionLabel(trimmed);
      const isTitleLine =
        drafts.length === 0 &&
        normalizedTitle.length > 3 &&
        normalizeComparable(trimmed) === normalizedTitle;

      const cleanHeaderText = isBracketHeader ? trimmed.slice(1, -1).trim() : trimmed;
      const isHeader = isBracketHeader || isBareHeader || isTitleLine;
      const isInstrumental = isParenCue || (isHeader && INSTRUMENTAL_KEYWORDS.test(cleanHeaderText));

      if (isHeader) {
        currentPace = getSectionPaceMultiplier(cleanHeaderText);
      }

      drafts.push({
        raw: trimmed,
        isHeader,
        isInstrumental,
        text: isHeader ? cleanHeaderText : trimmed,
        tag: isHeader ? cleanHeaderText : undefined,
        gapBefore: pendingGap,
        paceMultiplier: currentPace,
        weight: 0,
      });
      pendingGap = false;
    }

    if (drafts.length === 0) {
      return { parsedLines: [] as ParsedLine[], hasExactTimestamps: false };
    }

    const songDuration = duration > 0 ? duration : 180;
    const firstNonHeaderIdx = drafts.findIndex((d) => !d.isHeader);
    const startsWithIntroCue =
      drafts[0]?.isHeader && /^intro/i.test(drafts[0].text) && firstNonHeaderIdx > 0;
    const introLead = startsWithIntroCue
      ? Math.min(18, Math.max(6, songDuration * 0.085))
      : Math.min(12, Math.max(4, songDuration * 0.06));
    const outroTail = Math.min(10, Math.max(3, songDuration * 0.045));
    const activeWindow = Math.max(10, songDuration - introLead - outroTail);

    let totalWeight = 0;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const next = drafts[i + 1];

      if (d.isHeader) {
        const isStandaloneInstrumental =
          d.isInstrumental && (!next || next.isHeader || next.isInstrumental);
        d.weight = isStandaloneInstrumental ? 28 : 0;
      } else if (d.isInstrumental) {
        d.weight = 26;
      } else {
        const gapWeight = d.gapBefore ? 3.5 : 0;
        d.weight = estimateVocalWeight(d.text, d.paceMultiplier) + gapWeight;
      }
      totalWeight += d.weight;
    }

    const safeTotalWeight = Math.max(1, totalWeight);
    let accumulatedWeight = 0;

    const computed = drafts.map((d, idx): ParsedLine => {
      const pauseLead = !d.isHeader && d.gapBefore ? 3.5 : 0;
      const startWeight = accumulatedWeight + (d.isHeader ? 0 : pauseLead * 0.5);
      const approxTime = introLead + (startWeight / safeTotalWeight) * activeWindow;
      accumulatedWeight += d.weight;

      return {
        id: idx,
        raw: d.raw,
        isHeader: d.isHeader,
        isInstrumental: d.isInstrumental,
        text: d.text,
        tag: d.tag,
        approxTime,
      };
    });

    return { parsedLines: computed, hasExactTimestamps: false };
  }, [activeSourceLyrics, duration, hasSong, title]);

  // Helper: find next sung/syncable line index starting at `from`
  const findNextSyncableIndex = useCallback(
    (from: number): number => {
      for (let i = from; i < parsedLines.length; i++) {
        if (!parsedLines[i].isHeader || parsedLines[i].isInstrumental) {
          return i;
        }
      }
      return parsedLines.length;
    },
    [parsedLines]
  );

  // Build LRC text from recorded timestamps and save locally
  const buildSyncedLrcText = useCallback(
    (timestamps: Record<number, number>): string => {
      const out: string[] = [];
      let lastTime = 0;

      for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        if (typeof timestamps[i] === 'number') {
          lastTime = timestamps[i];
        }
        if (line.isHeader && !line.isInstrumental) {
          out.push(`[${line.text}]`);
        } else {
          const ts = typeof timestamps[i] === 'number' ? timestamps[i] : lastTime;
          out.push(`${formatLrcTimestamp(ts)} ${line.text}`);
        }
      }
      return out.join('\n');
    },
    [parsedLines]
  );

  const handleMarkCurrentSyncLine = useCallback(() => {
    if (!isSyncMode || parsedLines.length === 0) return;
    const idx = findNextSyncableIndex(syncCursor);
    if (idx >= parsedLines.length) return;

    const nextMap = { ...recordedTimestamps, [idx]: currentTime };
    setRecordedTimestamps(nextMap);

    const nextIdx = findNextSyncableIndex(idx + 1);
    setSyncCursor(nextIdx);

    // Save progressively to localStorage once all lines or partial lines are stamped
    if (nextIdx >= parsedLines.length) {
      const lrcText = buildSyncedLrcText(nextMap);
      setCustomLrc(lrcText);
      saveCustomLrc(songId, lrcText);
      setIsSyncMode(false);
      setSavedNotice('Sincronia gravada neste aparelho!');
      setTimeout(() => setSavedNotice(null), 3500);
    }
  }, [
    isSyncMode,
    parsedLines.length,
    findNextSyncableIndex,
    syncCursor,
    recordedTimestamps,
    currentTime,
    buildSyncedLrcText,
    songId,
  ]);

  // Spacebar shortcut while in Tap-to-Sync mode
  useEffect(() => {
    if (!isSyncMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleMarkCurrentSyncLine();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSyncMode, handleMarkCurrentSyncLine]);

  const handleAnchorVoiceStartNow = () => {
    const firstSung = parsedLines.find((l) => !l.isHeader || l.isInstrumental);
    if (!firstSung) return;
    // Adjust offset so first sung line matches currentTime right now
    const neededOffset = firstSung.approxTime - currentTime;
    handleUpdateOffset(neededOffset);
    setSavedNotice('Início da voz alinhado!');
    setTimeout(() => setSavedNotice(null), 2200);
  };

  const handleApplyPartialSync = async () => {
    if (Object.keys(recordedTimestamps).length === 0) return;
    const lrcText = buildSyncedLrcText(recordedTimestamps);
    setCustomLrc(lrcText);
    saveCustomLrc(songId, lrcText);
    setIsSyncMode(false);
    setSavedNotice('Sincronia aplicada!');

    if (isAdmin && onSaveSyncedLyrics && songId) {
      setSavingToDb(true);
      try {
        await onSaveSyncedLyrics(songId, lrcText);
        setSavedNotice('Sincronia LRC salva no Supabase!');
      } finally {
        setSavingToDb(false);
      }
    }
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSaveCurrentLrcToDb = async () => {
    if (!isAdmin || !onSaveSyncedLyrics || !songId || !customLrc) return;
    setSavingToDb(true);
    try {
      await onSaveSyncedLyrics(songId, customLrc);
      setSavedNotice('Sincronia LRC salva no Supabase para todos!');
      setTimeout(() => setSavedNotice(null), 3500);
    } finally {
      setSavingToDb(false);
    }
  };

  const handleClearCustomLrc = () => {
    setCustomLrc(null);
    saveCustomLrc(songId, null);
    setRecordedTimestamps({});
    setSyncCursor(0);
    handleUpdateOffset(0);
  };

  // Determine active line index
  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    if (isSyncMode) {
      return Math.min(syncCursor, parsedLines.length - 1);
    }

    const effectiveTime = Math.max(0, currentTime + syncOffset);
    let matchIdx = 0;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (effectiveTime >= parsedLines[i].approxTime) {
        matchIdx = i;
        break;
      }
    }

    if (
      parsedLines[matchIdx]?.isHeader &&
      !parsedLines[matchIdx]?.isInstrumental &&
      parsedLines[matchIdx + 1] &&
      !parsedLines[matchIdx + 1].isHeader &&
      effectiveTime >= parsedLines[matchIdx + 1].approxTime - 0.15
    ) {
      return matchIdx + 1;
    }

    return matchIdx;
  }, [currentTime, syncOffset, parsedLines, isSyncMode, syncCursor]);

  // Auto-scroll ONLY inside the teleprompter container
  useEffect(() => {
    if (!autoScroll || !activeLineRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const el = activeLineRef.current;
    const targetTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  }, [activeIndex, autoScroll]);

  const handleCopy = () => {
    if (!activeSourceLyrics) return;
    navigator.clipboard.writeText(activeSourceLyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'large':
        return 'text-lg md:text-xl';
      case 'huge':
        return 'text-xl md:text-2xl leading-relaxed';
      default:
        return 'text-sm md:text-base';
    }
  };

  return (
    <div
      className={`relative flex flex-col transition-all duration-300 rounded-2xl glass-panel border border-white/10 overflow-hidden ${
        isFullscreen
          ? 'fixed inset-4 z-50 bg-[#08090d]/95 backdrop-blur-2xl shadow-2xl p-6 md:p-10'
          : 'h-[360px] md:h-[420px] p-4'
      }`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-purple-300 font-mono-code flex items-center gap-1.5">
              Letras ao Vivo • Teleprompter
              {isPlaying && hasSong && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {hasExactTimestamps ? 'LRC EXATO' : 'SINCRONIZANDO'}
                </span>
              )}
            </h3>
            {isFullscreen && hasSong && (
              <p className="text-sm font-medium text-white/90">
                {title} — <span className="text-white/60">{artist}</span>
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {hasSong && parsedLines.length > 0 && (
            <>
              {!hasExactTimestamps && isPlaying && (
                <button
                  onClick={handleAnchorVoiceStartNow}
                  title="Clique no instante exato em que o cantor começar a cantar o 1º verso"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono-code transition-all"
                >
                  <Crosshair className="w-3 h-3" />
                  <span className="hidden md:inline">Voz começou agora</span>
                </button>
              )}

              <div
                className="flex items-center bg-white/5 rounded-lg border border-white/5 text-[10px] font-mono-code"
                title="Ajuste fino de sincronia com a voz"
              >
                <button
                  onClick={() => handleUpdateOffset(syncOffset - 0.5)}
                  className="px-1.5 py-1 text-white/60 hover:text-white transition-colors"
                  title="Atrasar letra (-0.5s)"
                >
                  -0.5s
                </button>
                <button
                  onClick={() => handleUpdateOffset(0)}
                  className={`px-1.5 py-1 border-x border-white/10 ${
                    syncOffset !== 0 ? 'text-cyan-300 font-bold' : 'text-white/50'
                  }`}
                  title="Zerar ajuste"
                >
                  {syncOffset === 0 ? 'Sinc' : `${syncOffset > 0 ? '+' : ''}${syncOffset}s`}
                </button>
                <button
                  onClick={() => handleUpdateOffset(syncOffset + 0.5)}
                  className="px-1.5 py-1 text-white/60 hover:text-white transition-colors"
                  title="Adiantar letra (+0.5s)"
                >
                  +0.5s
                </button>
              </div>

              <button
                onClick={() => {
                  const next = !isSyncMode;
                  setIsSyncMode(next);
                  if (next) {
                    setSyncCursor(findNextSyncableIndex(0));
                    setRecordedTimestamps({});
                  }
                }}
                title="Marcar o tempo exato de cada frase enquanto a música toca"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono-code transition-all border ${
                  isSyncMode
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                    : 'bg-white/5 text-white/65 hover:text-white border-white/10'
                }`}
              >
                <Timer className="w-3 h-3" />
                <span className="hidden sm:inline">{isSyncMode ? 'Sair Sinc' : 'Sincronizar'}</span>
              </button>

              {customLrc && !serverHasLrc && isAdmin && onSaveSyncedLyrics && (
                <button
                  onClick={handleSaveCurrentLrcToDb}
                  disabled={savingToDb}
                  title="Salvar marcações de tempo no Supabase para todos os ouvintes"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 text-[10px] font-mono-code font-bold"
                >
                  <Save className="w-3 h-3" />
                  <span>{savingToDb ? 'Salvando...' : 'Salvar LRC'}</span>
                </button>
              )}

              {customLrc && (
                <button
                  onClick={handleClearCustomLrc}
                  title="Limpar sincronização gravada"
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-red-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </>
          )}

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Desativar rolagem automática' : 'Ativar rolagem automática'}
            className={`px-2 py-1 rounded text-[11px] font-mono-code transition-all ${
              autoScroll
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                : 'bg-white/5 text-white/50 hover:text-white/80'
            }`}
          >
            Auto-Scroll
          </button>

          {/* Font Size button */}
          <button
            onClick={() => {
              setFontSize((prev) => (prev === 'normal' ? 'large' : prev === 'large' ? 'huge' : 'normal'));
            }}
            title="Ajustar tamanho da fonte"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={!hasSong || !activeSourceLyrics}
            title="Copiar letra"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors border border-white/5 disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline font-mono-code text-[11px]">
              {copied ? 'Copiado!' : 'Copiar'}
            </span>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Minimizar' : 'Tela cheia'}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive Tap-to-Sync bar */}
      {isSyncMode && hasSong && parsedLines.length > 0 && (
        <div className="mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-code">
          <span className="text-amber-200">
            Toque quando o cantor iniciar o verso destacado (ou use{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20">Espaço</kbd>):
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkCurrentSyncLine}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold transition-colors"
            >
              Marcar Verso ({Object.keys(recordedTimestamps).length})
            </button>
            {Object.keys(recordedTimestamps).length > 0 && (
              <button
                onClick={handleApplyPartialSync}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 font-semibold"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      )}

      {savedNotice && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-[11px] font-mono-code">
          {savedNotice}
        </div>
      )}

      {/* Scrolling lyrics area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto pr-2 space-y-3 scroll-smooth py-6 select-text"
      >
        {!hasSong ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/50 p-6 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 mb-1">
              <Music className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-white/85">
              Selecione uma música para começar
            </p>
            <p className="text-xs text-white/45 max-w-sm font-mono-code leading-relaxed">
              Escolha uma faixa na programação ao lado para ouvir a rádio e acompanhar a letra sincronizada no teleprompter.
            </p>
          </div>
        ) : parsedLines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/40 p-4">
            <p className="text-sm">Nenhuma letra disponível para esta faixa.</p>
            <p className="text-xs text-white/30 mt-1">
              Gere uma letra inédita com temas inteligentes no Estúdio AI ou importe pelo link do Suno.
            </p>
          </div>
        ) : (
          parsedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            if (line.isHeader) {
              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    if (onSeek && !isSyncMode) onSeek(line.approxTime);
                  }}
                  className="pt-4 pb-1 cursor-pointer"
                >
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-mono-code font-bold tracking-wider uppercase border shadow-sm transition-all ${
                      isActive
                        ? 'bg-purple-500/35 text-purple-100 border-purple-400/60 scale-[1.03]'
                        : 'bg-purple-900/40 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {line.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  if (isSyncMode) {
                    const nextMap = { ...recordedTimestamps, [idx]: currentTime };
                    setRecordedTimestamps(nextMap);
                    setSyncCursor(findNextSyncableIndex(idx + 1));
                  } else if (onSeek) {
                    onSeek(line.approxTime);
                  }
                }}
                className={`cursor-pointer transition-all duration-300 rounded-lg px-3 py-1.5 ${getFontSizeClass()} ${
                  isActive
                    ? 'font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200 bg-white/10 border-l-4 border-purple-400 pl-3 scale-[1.02] shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                    : isPast
                    ? 'text-white/45 hover:text-white/80'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {line.text}
              </div>
            );
          })
        )}
      </div>

      {/* Live progress footer banner */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-code text-white/40">
        <span>
          {hasSong
            ? `Linha ${activeIndex >= 0 ? activeIndex + 1 : 0} de ${parsedLines.length}`
            : 'Aguardando seleção de faixa'}
        </span>
        <span className="text-purple-400/80">
          {hasExactTimestamps ? 'LRC Sincronizado' : 'Rádio AI • Teleprompter Lírico'}
        </span>
      </div>
    </div>
  );
};
