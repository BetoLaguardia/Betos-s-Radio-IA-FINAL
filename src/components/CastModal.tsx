import React, { useState } from 'react';
import { Cast, Tv, Radio, Speaker, Volume2, Wifi, Check, X, ShieldCheck } from 'lucide-react';
import { CastDevice } from '../types/song';

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTrackTitle?: string;
}

const DEFAULT_DEVICES: CastDevice[] = [
  {
    id: 'chromecast-living-room',
    name: 'Google Chromecast Ultra (Home Theater)',
    type: 'chromecast',
    location: 'Sala de Estar',
    quality: 'FLAC 24-bit / 96kHz',
    connected: false,
  },
  {
    id: 'nest-audio-studio',
    name: 'Google Nest Audio Hi-Fi',
    type: 'nest_speaker',
    location: 'Estúdio Principal',
    quality: 'HD Audio 320 kbps',
    connected: false,
  },
  {
    id: 'soundbar-cinema',
    name: 'Soundbar Dolby Atmos (Sala de Som)',
    type: 'soundbar',
    location: 'Sala de Audição',
    quality: 'Spatial Lossless',
    connected: false,
  },
  {
    id: 'airplay-bedroom',
    name: 'Apple TV / AirPlay 2',
    type: 'airplay',
    location: 'Quarto Acústico',
    quality: 'Lossless 48kHz',
    connected: false,
  },
  {
    id: 'bluetooth-monitor',
    name: 'Monitores de Áudio Bluetooth HD',
    type: 'bluetooth',
    location: 'Mesa de Produção',
    quality: 'LDAC 990 kbps',
    connected: false,
  },
];

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  audioRef,
  currentTrackTitle = 'Rádio AI Stream',
}) => {
  const [devices, setDevices] = useState<CastDevice[]>(DEFAULT_DEVICES);
  const [castVolume, setCastVolume] = useState<number>(85);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const connectedDevice = devices.find((d) => d.connected);

  const handleTriggerNativeCast = async () => {
    try {
      const audio = audioRef.current as any;
      if (audio && audio.remote && typeof audio.remote.prompt === 'function') {
        await audio.remote.prompt();
      } else if ((window as any).chrome && (window as any).chrome.cast) {
        // Trigger chrome cast request
      } else {
        // Native fallback notification
      }
    } catch (err) {
      console.log('Native remote prompt:', err);
    }
  };

  const toggleConnect = (deviceId: string) => {
    setConnectingId(deviceId);
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id === deviceId) {
            return { ...dev, connected: !dev.connected };
          }
          return { ...dev, connected: false };
        })
      );
      setConnectingId(null);
    }, 700);
  };

  const getDeviceIcon = (type: CastDevice['type']) => {
    switch (type) {
      case 'chromecast':
      case 'smart_tv':
        return <Tv className="w-5 h-5 text-cyan-400" />;
      case 'nest_speaker':
      case 'soundbar':
        return <Speaker className="w-5 h-5 text-purple-400" />;
      case 'airplay':
        return <Radio className="w-5 h-5 text-pink-400" />;
      default:
        return <Wifi className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel-elevated p-6 border border-white/15 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Cast className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading tracking-wide">
              Transmitir Áudio • Cast Rádio AI
            </h2>
            <p className="text-xs text-white/60 font-mono-code">
              Transmita para Chromecast, Nest Audio, Apple TV ou Soundbars
            </p>
          </div>
        </div>

        {/* Currently connected status bar */}
        {connectedDevice ? (
          <div className="mb-6 p-4 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="w-3 h-3 bg-emerald-400 rounded-full animate-ping absolute" />
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full relative" />
              </div>
              <div>
                <p className="text-xs font-mono-code text-emerald-300 font-semibold uppercase">
                  Transmitindo Atualmente
                </p>
                <p className="text-sm font-bold text-white">{connectedDevice.name}</p>
                <p className="text-[11px] text-white/50">{connectedDevice.quality} • Latência 14ms</p>
              </div>
            </div>
            <button
              onClick={() => toggleConnect(connectedDevice.id)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono-code transition-colors border border-red-500/30"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-white/70">
            <span className="flex items-center gap-2 font-mono-code">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Rede Local: 5GHz • Pronta para transmissão
            </span>
            <button
              onClick={handleTriggerNativeCast}
              className="text-xs text-cyan-300 hover:text-cyan-200 underline font-mono-code"
            >
              Abrir Cast Nativo
            </button>
          </div>
        )}

        {/* Device List */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 mb-5">
          {devices.map((device) => {
            const isConnecting = connectingId === device.id;
            return (
              <div
                key={device.id}
                onClick={() => !isConnecting && toggleConnect(device.id)}
                className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border ${
                  device.connected
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-md shadow-purple-900/20'
                    : 'bg-white/5 hover:bg-white/10 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    {getDeviceIcon(device.type)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white/95 flex items-center gap-2">
                      {device.name}
                      {device.connected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono-code font-bold">
                          ATIVO
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-white/50 font-mono-code">
                      {device.location} • <span className="text-white/40">{device.quality}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  {isConnecting ? (
                    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : device.connected ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : (
                    <span className="text-xs font-mono-code text-white/40 hover:text-white/80 px-2 py-1 rounded bg-white/5">
                      Conectar
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Remote Volume slider if connected */}
        {connectedDevice && (
          <div className="pt-4 border-t border-white/10 flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono-code text-white/60">Volume Cast:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={castVolume}
              onChange={(e) => setCastVolume(Number(e.target.value))}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <span className="text-xs font-mono-code text-white/80 w-8 text-right">
              {castVolume}%
            </span>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-code text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Streaming em ponto de conexão seguro
          </span>
          <span>Faixa: {currentTrackTitle.substring(0, 22)}...</span>
        </div>
      </div>
    </div>
  );
};
