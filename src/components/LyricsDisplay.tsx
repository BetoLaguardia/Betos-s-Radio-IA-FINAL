import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Copy, Check, Maximize2, Minimize2, Type, Sparkles } from 'lucide-react';

interface LyricsDisplayProps {
  lyrics: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek?: (seconds: number) => void;
  title?: string;
  artist?: string;
}

interface ParsedLine {
  id: number;
  raw: string;
  isHeader: boolean;
  text: string;
  tag?: string;
  approxTime: number; // approximate timestamp based on song structure
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  title,
  artist,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [autoScroll, setAutoScroll] = useState(true);

  // Parse lyrics into line items with tags
  const parsedLines = useMemo(() => {
    if (!lyrics) return [];
    const lines = lyrics.split('\n');
    const validLines: string[] = [];
    lines.forEach((l) => {
      const trimmed = l.trim();
      if (trimmed.length > 0) {
        validLines.push(trimmed);
      }
    });

    const totalLines = validLines.length;
    const songDuration = duration > 0 ? duration : 180;

    return validLines.map((line, idx): ParsedLine => {
      const isHeader = line.startsWith('[') && line.endsWith(']');
      let tag = '';
      let text = line;

      if (isHeader) {
        tag = line.substring(1, line.length - 1);
        text = tag;
      }

      // Distribute timestamps roughly across duration for karaoke-like auto highlighting
      const approxTime = (idx / Math.max(1, totalLines)) * songDuration;

      return {
        id: idx,
        raw: line,
        isHeader,
        text,
        tag,
        approxTime,
      };
    });
  }, [lyrics, duration]);

  // Determine active line index based on currentTime
  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLines[i].approxTime) {
        return i;
      }
    }
    return 0;
  }, [currentTime, parsedLines]);

  // Auto-scroll to active line
  useEffect(() => {
    if (!autoScroll || !activeLineRef.current || !containerRef.current) return;
    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeIndex, autoScroll]);

  const handleCopy = () => {
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
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-purple-300 font-mono-code flex items-center gap-1.5">
              Letras ao Vivo • Teleprompter
              {isPlaying && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SINCRONIZANDO
                </span>
              )}
            </h3>
            {isFullscreen && (
              <p className="text-sm font-medium text-white/90">
                {title} — <span className="text-white/60">{artist}</span>
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
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
            title="Copiar letra formatada para o Suno"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors border border-white/5"
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
        className="flex-1 overflow-y-auto pr-2 space-y-3 scroll-smooth py-6 select-text"
      >
        {parsedLines.length === 0 ? (
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
                  className="pt-4 pb-1"
                >
                  <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-mono-code font-bold tracking-wider uppercase bg-purple-900/40 text-purple-300 border border-purple-500/30 shadow-sm">
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
          Linha {activeIndex >= 0 ? activeIndex + 1 : 0} de {parsedLines.length}
        </span>
        <span className="text-purple-400/80">Rádio AI • Teleprompter Lírico</span>
      </div>
    </div>
  );
};
