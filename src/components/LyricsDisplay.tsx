import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Copy, Check, Maximize2, Minimize2, Type, Sparkles, Music } from 'lucide-react';

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

function isBareSectionLabel(line: string): boolean {
  const cleaned = line.replace(/[:\-–—]+$/, '').trim();
  if (cleaned.length > 36) return false;
  return SECTION_KEYWORDS.test(cleaned) && !/[.!?,;]/.test(cleaned);
}

function estimateVocalWeight(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  // Estimate sung phrasing weight from character/vowel density + word count
  const vowels = (text.match(/[aeiouáéíóúâêîôûãõàü]/gi) || []).length;
  const base = Math.max(vowels, Math.round(text.trim().length * 0.42));
  return Math.max(4, base + words.length * 1.4);
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [autoScroll, setAutoScroll] = useState(true);
  const [syncOffset, setSyncOffset] = useState(0);

  // Reset sync nudge when changing tracks
  useEffect(() => {
    setSyncOffset(0);
  }, [songId]);

  // Parse lyrics with exact LRC timestamps when present, or vocal-paced timing otherwise
  const parsedLines = useMemo(() => {
    if (!hasSong || !lyrics || !lyrics.trim()) return [];
    const rawLines = lyrics.split(/\r?\n/);

    // 1. Check if lyrics contain LRC timestamps like [00:24.50]
    const lrcParsed: ParsedLine[] = [];
    let hasLrcTimestamps = false;

    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      if (!trimmed || LRC_META_REGEX.test(trimmed)) continue;

      const match = trimmed.match(LRC_LINE_REGEX);
      if (match) {
        hasLrcTimestamps = true;
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

    if (hasLrcTimestamps && lrcParsed.length > 0) {
      return lrcParsed.sort((a, b) => a.approxTime - b.approxTime);
    }

    // 2. Non-timestamped lyrics: classify lines and preserve stanza gap pauses
    interface DraftLine {
      raw: string;
      isHeader: boolean;
      isInstrumental: boolean;
      text: string;
      tag?: string;
      gapBefore: boolean;
      weight: number;
    }

    const drafts: DraftLine[] = [];
    let pendingGap = false;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (drafts.length > 0) pendingGap = true;
        continue;
      }

      const isBracketHeader = trimmed.startsWith('[') && trimmed.endsWith(']');
      const isParenCue = trimmed.startsWith('(') && trimmed.endsWith(')') && INSTRUMENTAL_KEYWORDS.test(trimmed);
      const isBareHeader = !isBracketHeader && isBareSectionLabel(trimmed);

      const cleanHeaderText = isBracketHeader ? trimmed.slice(1, -1).trim() : trimmed;
      const isHeader = isBracketHeader || isBareHeader;
      const isInstrumental = isParenCue || (isHeader && INSTRUMENTAL_KEYWORDS.test(cleanHeaderText));

      drafts.push({
        raw: trimmed,
        isHeader,
        isInstrumental,
        text: isHeader ? cleanHeaderText : trimmed,
        tag: isHeader ? cleanHeaderText : undefined,
        gapBefore: pendingGap,
        weight: 0,
      });
      pendingGap = false;
    }

    if (drafts.length === 0) return [];

    // Remove trailing title line if the very first line just repeats the song title
    const songDuration = duration > 0 ? duration : 180;

    // Realistic intro lead-in before vocals enter & outro tail
    const firstNonHeaderIdx = drafts.findIndex((d) => !d.isHeader);
    const startsWithIntroCue =
      drafts[0]?.isHeader && /^intro/i.test(drafts[0].text) && firstNonHeaderIdx > 0;
    const introLead = startsWithIntroCue
      ? Math.min(16, Math.max(5, songDuration * 0.08))
      : Math.min(11, Math.max(3.5, songDuration * 0.055));
    const outroTail = Math.min(8, Math.max(2, songDuration * 0.04));
    const activeWindow = Math.max(10, songDuration - introLead - outroTail);

    // Assign pacing weights
    let totalWeight = 0;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const next = drafts[i + 1];

      if (d.isHeader) {
        // An instrumental section header that has NO sung lines before the next header (e.g. [Guitar Solo])
        // represents an actual instrumental break in the music.
        const isStandaloneInstrumental =
          d.isInstrumental && (!next || next.isHeader || next.isInstrumental);
        d.weight = isStandaloneInstrumental ? 26 : 0;
      } else if (d.isInstrumental) {
        d.weight = 24;
      } else {
        const gapWeight = d.gapBefore ? 3.5 : 0;
        d.weight = estimateVocalWeight(d.text) + gapWeight;
      }
      totalWeight += d.weight;
    }

    const safeTotalWeight = Math.max(1, totalWeight);
    let accumulatedWeight = 0;

    return drafts.map((d, idx): ParsedLine => {
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
  }, [lyrics, duration, hasSong]);

  // Determine active line index based on currentTime + manual syncOffset
  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    const effectiveTime = Math.max(0, currentTime + syncOffset);

    let matchIdx = 0;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (effectiveTime >= parsedLines[i].approxTime) {
        matchIdx = i;
        break;
      }
    }

    // If a section header shares the exact start timestamp of the line right below it,
    // highlight the actual lyric line instead of getting stuck on the header tag.
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
  }, [currentTime, syncOffset, parsedLines]);

  // Auto-scroll ONLY inside the teleprompter container (avoids scrolling the outer page)
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
    if (!lyrics) return;
    navigator.clipboard.writeText(lyrics);
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
                  SINCRONIZANDO
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
        <div className="flex items-center gap-1.5">
          {hasSong && parsedLines.length > 0 && (
            <div
              className="hidden sm:flex items-center bg-white/5 rounded-lg border border-white/5 text-[10px] font-mono-code"
              title="Ajuste fino de sincronia com a voz"
            >
              <button
                onClick={() => setSyncOffset((v) => Number((v - 0.5).toFixed(1)))}
                className="px-1.5 py-1 text-white/60 hover:text-white transition-colors"
                title="Adiantar letra (-0.5s)"
              >
                -0.5s
              </button>
              <button
                onClick={() => setSyncOffset(0)}
                className={`px-1.5 py-1 border-x border-white/10 ${
                  syncOffset !== 0 ? 'text-cyan-300 font-bold' : 'text-white/50'
                }`}
                title="Zerar ajuste de sincronia"
              >
                {syncOffset === 0 ? 'Sinc' : `${syncOffset > 0 ? '+' : ''}${syncOffset}s`}
              </button>
              <button
                onClick={() => setSyncOffset((v) => Number((v + 0.5).toFixed(1)))}
                className="px-1.5 py-1 text-white/60 hover:text-white transition-colors"
                title="Atrasar letra (+0.5s)"
              >
                +0.5s
              </button>
            </div>
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
            disabled={!hasSong || !lyrics}
            title="Copiar letra formatada para o Suno"
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
                    if (onSeek) onSeek(line.approxTime);
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
                  if (onSeek) onSeek(line.approxTime);
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
        <span className="text-purple-400/80">Rádio AI • Teleprompter Lírico</span>
      </div>
    </div>
  );
};
