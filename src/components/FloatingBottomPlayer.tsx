import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Cast,
  FileText,
  ListMusic,
  Disc3,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Song } from '../types/song';
import { AudioVisualizer } from './AudioVisualizer';
import { LyricsDisplay } from './LyricsDisplay';

interface FloatingBottomPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  isRadioMode: boolean;
  isCastActive: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onOpenCast: () => void;
  onTogglePlaylist: () => void;
  isPlaylistOpen: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export const FloatingBottomPlayer: React.FC<FloatingBottomPlayerProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  isRepeat,
  isRadioMode,
  isCastActive,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onOpenCast,
  onTogglePlaylist,
  isPlaylistOpen,
  audioRef,
}) => {
  const [isLyricsExpanded, setIsLyricsExpanded] = useState<boolean>(false);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-300">
      {/* EXPANDABLE SYNCHRONIZED LYRICS DRAWER (Slides up above the player) */}
      {isLyricsExpanded && (
        <div className="w-full max-w-5xl mx-auto px-4 mb-2 animate-fade-in">
          <div className="relative shadow-2xl">
            <div className="flex items-center justify-between p-3 bg-[#0c0d14]/95 backdrop-blur-2xl border-t border-x border-white/15 rounded-t-2xl">
              <span className="text-xs font-mono-code text-amber-300 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Letras Sincronizadas da Transmissão
              </span>
              <button
                onClick={() => setIsLyricsExpanded(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <LyricsDisplay
              lyrics={currentSong?.lyrics || ''}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={onSeek}
              title={currentSong?.title}
              artist={currentSong?.artist}
            />
          </div>
        </div>
      )}

      {/* STICKY BOTTOM PLAYER BAR */}
      <div className="w-full bg-[#08090d]/95 backdrop-blur-2xl border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Track Info & Spinning Vinyl Disc */}
          <div className="flex items-center gap-3.5 min-w-0 w-full md:w-1/4">
            <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}>
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/20 bg-neutral-900">
                <img
                  src={currentSong?.coverUrl || '/logo.jpg'}
                  alt={currentSong?.title || 'Capa'}
                  className={`w-full h-full object-cover transition-transform duration-500 ${
                    isPlaying ? 'scale-105' : ''
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.jpg';
                  }}
                />
              </div>

              {/* Mini vinyl disc indicator */}
              <div
                className={`absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neutral-950 border border-neutral-700 shadow-md flex items-center justify-center pointer-events-none -z-10 ${
                  isPlaying ? 'animate-spin-slow' : ''
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                {currentSong?.title || "Beto's Radio - Sintonize"}
              </h4>
              <p className="text-[11px] text-white/60 truncate font-mono-code">
                {currentSong?.artist || 'Estúdio Hi-Fi'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono-code text-amber-300/90 font-bold uppercase">
                  104.2 FM • No Ar
                </span>
              </div>
            </div>
          </div>

          {/* Center: Playback Controls & Scrubber Bar */}
          <div className="flex-1 w-full max-w-xl flex flex-col items-center gap-1.5">
            {/* Control buttons */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={onToggleShuffle}
                title="Aleatório"
                className={`p-1.5 rounded-full transition-colors ${
                  isShuffle ? 'text-amber-400 bg-amber-500/20' : 'text-white/40 hover:text-white'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onPrev}
                title="Anterior"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              {/* Glowing Play/Pause */}
              <button
                onClick={onPlayPause}
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-black" />
                ) : (
                  <Play className="w-4 h-4 fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={onNext}
                title="Próxima"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={onToggleRepeat}
                title="Repetir"
                className={`p-1.5 rounded-full transition-colors ${
                  isRepeat ? 'text-amber-400 bg-amber-500/20' : 'text-white/40 hover:text-white'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Time Slider Bar */}
            <div className="w-full flex items-center gap-2 text-[10px] font-mono-code text-white/40">
              <span className="w-8 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 relative transition-all"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
                </div>
              </div>
              <span className="w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Cast, Lyrics Toggle, Playlist Toggle & Volume */}
          <div className="flex items-center gap-2.5 justify-end w-full md:w-1/4">
            {/* Lyrics Toggle Button */}
            <button
              onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono-code transition-all border ${
                isLyricsExpanded
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
              }`}
              title="Passar letra da música em tempo real"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Letras</span>
              {isLyricsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>

            {/* Playlist Drawer Toggle */}
            <button
              onClick={onTogglePlaylist}
              className={`p-2 rounded-xl text-xs font-mono-code transition-all border ${
                isPlaylistOpen
                  ? 'bg-purple-500/25 text-purple-300 border-purple-400'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
              }`}
              title="Abrir fila de reprodução"
            >
              <ListMusic className="w-3.5 h-3.5" />
            </button>

            {/* Cast Button */}
            <button
              onClick={onOpenCast}
              className={`p-2 rounded-xl text-xs font-mono-code transition-all border ${
                isCastActive
                  ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
              }`}
              title="Transmitir áudio para Chromecast / caixas de som"
            >
              <Cast className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            {/* Volume control */}
            <div className="hidden lg:flex items-center gap-1.5 ml-1">
              <button onClick={onToggleMute} className="text-white/50 hover:text-white">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
