import React from 'react';
import {
  Cast,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Bluetooth,
  Speaker,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ExternalLink,
  Power,
} from 'lucide-react';
import { Song } from '../types/song';
import type { CastConnectionMode } from '../hooks/useYouTubeCast';

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isCastActive: boolean;
  castMode: CastConnectionMode;
  castAvailable: boolean;
  castSdkState: string;
  connectedDeviceName: string | null;
  remotePlaybackAvailable: boolean | null;
  audioOutputsCount: number;
  canSelectAudioOutput: boolean;
  castVolume: number;
  isCastMuted: boolean;
  isSearching: boolean;
  isInIframe: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onLaunchNativeCast: () => void;
  onSelectAudioOutput: () => void;
  onDisconnectCast: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCastVolumeChange: (val: number) => void;
  onCastToggleMute: () => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  isCastActive,
  castMode,
  castAvailable,
  castSdkState,
  connectedDeviceName,
  remotePlaybackAvailable,
  audioOutputsCount,
  canSelectAudioOutput,
  castVolume,
  isCastMuted,
  isSearching,
  isInIframe,
  statusMessage,
  errorMessage,
  onLaunchNativeCast,
  onSelectAudioOutput,
  onDisconnectCast,
  onPlayPause,
  onPrev,
  onNext,
  onCastVolumeChange,
  onCastToggleMute,
}) => {
  if (!isOpen) return null;

  const hasDevicesDetected =
    castSdkState === 'NOT_CONNECTED' ||
    castSdkState === 'CONNECTING' ||
    castSdkState === 'CONNECTED' ||
    remotePlaybackAvailable === true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-[#181920] border border-white/15 text-white shadow-2xl overflow-hidden"
      >
        {/* YouTube-style Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#121318]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCastActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'bg-white/10 text-white'
              }`}
            >
              <Cast className={`w-5 h-5 ${isSearching ? 'animate-pulse text-cyan-400' : ''}`} />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading tracking-wide">
                {isCastActive ? 'Transmitindo agora' : 'Transmitir para um dispositivo'}
              </h2>
              <p className="text-[11px] text-white/50 font-mono-code">
                {isCastActive
                  ? connectedDeviceName || 'Dispositivo conectado'
                  : 'Chromecast, Smart TV, Google TV, AirPlay'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Iframe warning if inside AI Studio preview */}
          {isInIframe && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs font-mono-code space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Dentro da janela de preview (iframe), o navegador bloqueia a busca de TVs na rede local. Para usar o Cast igual ao YouTube, abra a rádio em uma aba normal:
                </span>
              </div>
              <a
                href="https://betosradio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir betosradio.com
              </a>
            </div>
          )}

          {/* Connected YouTube-Style Remote Control Card */}
          {isCastActive && (
            <div className="rounded-xl bg-[#20222c] border border-cyan-400/35 p-4 space-y-4 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={currentSong?.coverUrl || '/logo.jpg'}
                    alt={currentSong?.title || "Beto's Radio"}
                    className="w-12 h-12 rounded-lg object-cover border border-white/15 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo.jpg';
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono-code font-bold text-cyan-300 uppercase">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Na TV • {connectedDeviceName || 'Dispositivo Cast'}
                    </div>
                    <p className="text-sm font-bold text-white truncate">
                      {currentSong?.title || "Beto's Radio"}
                    </p>
                    <p className="text-xs text-white/60 truncate font-mono-code">
                      {currentSong?.artist || 'Estúdio Hi-Fi'}
                    </p>
                  </div>
                </div>
              </div>

              {/* YouTube TV Remote Playback Controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={onPrev}
                  title="Faixa anterior na TV"
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button
                  onClick={onPlayPause}
                  title={isPlaying ? 'Pausar na TV' : 'Reproduzir na TV'}
                  className="w-12 h-12 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black translate-x-0.5" />
                  )}
                </button>
                <button
                  onClick={onNext}
                  title="Próxima faixa na TV"
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
              </div>

              {/* Cast Volume Slider */}
              {castMode === 'chromecast' && (
                <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
                  <button
                    onClick={onCastToggleMute}
                    title={isCastMuted ? 'Ativar som da TV' : 'Silenciar TV'}
                    className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {isCastMuted || castVolume === 0 ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isCastMuted ? 0 : castVolume}
                    onChange={(e) => onCastVolumeChange(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="text-xs font-mono-code text-white/70 w-9 text-right tabular-nums">
                    {isCastMuted ? 0 : castVolume}%
                  </span>
                </div>
              )}

              {/* Disconnect button (YouTube style) */}
              <button
                onClick={onDisconnectCast}
                className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-mono-code font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Power className="w-3.5 h-3.5" />
                Desconectar
              </button>
            </div>
          )}

          {/* Status & Error feedback */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs font-mono-code">
              {statusMessage}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-mono-code">
              {errorMessage}
            </div>
          )}

          {/* Available Devices / Cast Picker (YouTube list style) */}
          <div className="space-y-2">
            <button
              onClick={onLaunchNativeCast}
              disabled={isSearching}
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 flex items-center justify-between transition-all text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                  {isSearching ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Tv className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isCastActive
                      ? 'Trocar dispositivo Cast / TV'
                      : 'Procurar TV / Chromecast / AirPlay'}
                  </h4>
                  <p className="text-[11px] text-white/55 font-mono-code">
                    {hasDevicesDetected
                      ? 'Aparelhos detectados na rede • Toque para escolher'
                      : 'Abre o seletor oficial de transmissão do dispositivo'}
                  </p>
                </div>
              </div>
              <Cast className="w-4 h-4 text-cyan-300 flex-shrink-0" />
            </button>

            {/* Official Google Cast Web Launcher component on Desktop Chrome */}
            {castAvailable && (
              <div className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-white/75 font-mono-code">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>Seletor nativo Google Chrome Cast:</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 p-1">
                  {React.createElement('google-cast-launcher', {
                    style: {
                      width: '22px',
                      height: '22px',
                      display: 'block',
                      cursor: 'pointer',
                      '--connected-color': '#22d3ee',
                      '--disconnected-color': '#ffffff',
                    },
                  })}
                </div>
              </div>
            )}

            {/* Bluetooth / PC Audio Output */}
            <button
              onClick={onSelectAudioOutput}
              className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-400/25 text-purple-300">
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    Caixa Bluetooth / Saída de Som ({audioOutputsCount > 0 ? audioOutputsCount : 'Padrão'})
                  </h4>
                  <p className="text-[11px] text-white/50 font-mono-code">
                    {canSelectAudioOutput
                      ? 'Escolher saída de áudio conectada ao PC'
                      : 'No celular, conecte o Bluetooth nas configurações do sistema'}
                  </p>
                </div>
              </div>
              <Speaker className="w-4 h-4 text-purple-300 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
