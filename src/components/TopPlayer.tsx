import React from 'react';
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
  Users,
  Check,
  Radio,
  Disc3,
  Heart,
  Share2,
} from 'lucide-react';
import { Song } from '../types/song';
import { AudioVisualizer } from './AudioVisualizer';
import { useAdmin } from '../context/AdminContext';

interface TopPlayerProps {
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
  onToggleRadioMode: () => void;
  onOpenCast: () => void;
  onOpenComposer: () => void;
  onOpenBandModal: () => void;
  isLiked?: boolean;
  isShared?: boolean;
  onToggleLike?: () => void;
  onShare?: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export const TopPlayer: React.FC<TopPlayerProps> = ({
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
  onToggleRadioMode,
  onOpenCast,
  onOpenComposer,
  onOpenBandModal,
  isLiked = false,
  isShared = false,
  onToggleLike,
  onShare,
  audioRef,
}) => {
  const { isAdmin } = useAdmin();

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full rounded-3xl glass-panel-elevated p-6 md:p-8 border border-white/15 shadow-2xl overflow-hidden">
      {/* Ambient background glow from album art */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-25 pointer-events-none transition-all duration-1000"
        style={{
          background: isPlaying
            ? 'radial-gradient(circle, rgba(168,85,247,0.8) 0%, rgba(6,182,212,0.6) 100%)'
            : 'radial-gradient(circle, rgba(100,116,139,0.3) 0%, rgba(30,41,59,0.2) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
        {/* Left: Vinyl & Album Art Showcase */}
        <div className="relative flex-shrink-0 group">
          {/* Vinyl disc sliding out when playing */}
          <div
            className={`absolute top-0 left-0 w-44 h-44 md:w-52 md:h-52 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-2xl flex items-center justify-center transition-all duration-700 ease-out pointer-events-none ${
              isPlaying
                ? 'translate-x-12 md:translate-x-16 rotate-45'
                : 'translate-x-2'
            }`}
          >
            {/* Vinyl grooves */}
            <div className="w-full h-full rounded-full border border-neutral-700/40 p-2 flex items-center justify-center">
              <div className="w-full h-full rounded-full border border-neutral-700/60 p-3 flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-neutral-700/80 p-4 flex items-center justify-center">
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-white/40 flex items-center justify-center ${
                      isPlaying ? 'animate-spin-slow' : 'animate-spin-pause'
                    }`}
                  >
                    <Disc3 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sleeve Cover Art */}
          <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-400/30 z-10 bg-neutral-900">
            <img
              src={currentSong?.coverUrl || '/logo.jpg'}
              alt={currentSong?.title || 'Capa'}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpg';
              }}
            />

            {/* Live broadcast badge overlay */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-amber-500/30 text-[10px] font-mono-code font-bold tracking-wider text-amber-300">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
              {isRadioMode ? "BETO'S RADIO NO AR" : 'REPRODUÇÃO HI-FI'}
            </div>

            {/* Suno tag indicator */}
            {currentSong?.sunoId && (
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-cyan-950/80 backdrop-blur-md border border-cyan-400/40 text-[9px] font-mono-code font-bold text-cyan-300">
                SUNO AI
              </div>
            )}
          </div>
        </div>

        {/* Center/Right: Song Details, Visualizer & Controls */}
        <div className="flex-1 w-full min-w-0 flex flex-col justify-between space-y-4">
          {/* Top metadata row */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono-code bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  {currentSong?.mood || 'Contemplativo & Poético'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono-code bg-white/5 text-cyan-300 border border-white/10">
                  {currentSong?.rhythm || 'Andante Moderno'}
                </span>
              </div>

              {/* Station Mode Toggle Button */}
              <button
                onClick={onToggleRadioMode}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-code font-semibold transition-all border ${
                  isRadioMode
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'
                }`}
                title="Alternar modo Rádio AI contínua 24/7"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isRadioMode ? 'Rádio 24h: Ligada' : 'Modo Rádio'}</span>
              </button>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold font-heading text-white tracking-tight truncate">
              {currentSong?.title || 'Selecione uma música para tocar'}
            </h1>
            <p className="text-sm md:text-base text-white/70 font-mono-code mt-0.5 truncate">
              {currentSong ? (
                <>
                  {currentSong.artist || 'Estúdio Rádio AI'} •{' '}
                  <span className="text-white/40">{currentSong.album || 'Catálogo Digital'}</span>
                </>
              ) : (
                <span className="text-white/50">
                  Escolha uma música na programação ao lado para iniciar a reprodução
                </span>
              )}
            </p>
          </div>

          {/* Audio Visualizer Component */}
          <div className="py-1">
            <AudioVisualizer
              isPlaying={isPlaying}
              audioRef={audioRef}
              colorTheme={isRadioMode ? 'cyan' : 'purple'}
              barCount={42}
            />
          </div>

          {/* Time Scrub Bar */}
          <div className="space-y-1">
            <div className="relative w-full h-2 rounded-full bg-white/10 cursor-pointer group flex items-center">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 transition-all pointer-events-none relative"
                style={{ width: `${progressPercentage}%` }}
              >
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>

            <div className="flex justify-between text-[11px] font-mono-code text-white/50">
              <span>{formatTime(currentTime)}</span>
              <span
                title={
                  duration > 0 && (isPlaying || currentTime > 0)
                    ? 'Tempo restante (contagem regressiva) / Duração total'
                    : 'Duração total da faixa'
                }
                className={isPlaying ? 'text-cyan-300 font-semibold' : ''}
              >
                {duration > 0 && (isPlaying || currentTime > 0)
                  ? `-${formatTime(Math.max(0, duration - currentTime))} / ${formatTime(duration)}`
                  : formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Main Controls & Utility buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* Left Tools: Like, Share, Suno Prompt & Band Persona */}
            <div className="flex flex-wrap items-center gap-2">
              {currentSong && onToggleLike && (
                <button
                  onClick={onToggleLike}
                  title={isLiked ? 'Remover curtida' : 'Curtir música'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-code font-semibold border transition-all active:scale-95 ${
                    isLiked
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/45 shadow-sm shadow-pink-500/20'
                      : 'bg-white/5 hover:bg-pink-500/10 text-white/75 hover:text-pink-300 border-white/10 hover:border-pink-500/30'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-transform ${
                      isLiked ? 'fill-pink-400 text-pink-400 scale-110' : ''
                    }`}
                  />
                  <span>{isLiked ? 'Curtido' : 'Curtir'}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[10px]">
                    {currentSong.likes || 0}
                  </span>
                </button>
              )}

              {currentSong && onShare && (
                <button
                  onClick={onShare}
                  title="Compartilhar música com capa do álbum"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-code font-semibold border transition-all active:scale-95 ${
                    isShared
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 hover:bg-purple-500/15 text-white/75 hover:text-purple-200 border-white/10 hover:border-purple-500/30'
                  }`}
                >
                  {isShared ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Link copiado!</span>
                    </>
                  ) : (
                    <>
                      <img
                        src={currentSong.coverUrl || '/logo.jpg'}
                        alt={currentSong.title}
                        className="w-4 h-4 rounded object-cover border border-white/25 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.jpg';
                        }}
                      />
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Compartilhar</span>
                    </>
                  )}
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={onOpenBandModal}
                  title="Ver e criar integrantes da banda no Nano Banana (Admin)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono-code border border-amber-500/25 transition-all"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Integrantes (Nano Banana)</span>
                </button>
              )}
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={onToggleShuffle}
                title={isShuffle ? 'Desativar ordem aleatória' : 'Ordem aleatória'}
                className={`p-2 rounded-full transition-colors ${
                  isShuffle ? 'text-purple-400 bg-purple-500/20' : 'text-white/40 hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={onPrev}
                title="Música anterior"
                className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {/* Central Glowing Play/Pause */}
              <button
                onClick={onPlayPause}
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-purple-500/30 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white translate-x-0.5" />
                )}
              </button>

              <button
                onClick={onNext}
                title="Próxima música"
                className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={onToggleRepeat}
                title={isRepeat ? 'Repetição ativada' : 'Repetir'}
                className={`p-2 rounded-full transition-colors ${
                  isRepeat ? 'text-purple-400 bg-purple-500/20' : 'text-white/40 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Cast Button & Volume */}
            <div className="flex items-center gap-3">
              {/* Cast Button */}
              <button
                onClick={onOpenCast}
                title="Transmitir diretamente para TV, Chromecast ou caixas de som"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition-all border ${
                  isCastActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-md shadow-cyan-500/20 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
                }`}
              >
                <Cast className="w-4 h-4 text-cyan-400" />
                <span>Cast</span>
              </button>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={onToggleMute}
                  className="p-1.5 text-white/60 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-16 md:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
