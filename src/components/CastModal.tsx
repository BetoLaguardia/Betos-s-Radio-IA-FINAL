import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cast,
  Tv,
  Radio,
  Speaker,
  Volume2,
  Wifi,
  X,
  ShieldCheck,
  Bluetooth,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Song } from '../types/song';

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentSong: Song | null;
  isPlaying: boolean;
  onCastActiveChange: (active: boolean) => void;
  externalError?: string | null;
  externalStatus?: string | null;
  onEnsureTrackLoaded?: () => boolean;
}

function toAbsoluteUrl(url?: string): string {
  if (!url) return `${window.location.origin}/logo.jpg`;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return `${window.location.origin}/logo.jpg`;
  }
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  audioRef,
  currentSong,
  isPlaying,
  onCastActiveChange,
  externalError,
  externalStatus,
  onEnsureTrackLoaded,
}) => {
  const [castAvailable, setCastAvailable] = useState<boolean>(false);
  const [castState, setCastState] = useState<string>('NOT_CONNECTED');
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [remotePlaybackAvailable, setRemotePlaybackAvailable] = useState<boolean | null>(null);
  const [audioOutputLabel, setAudioOutputLabel] = useState<string | null>(null);
  const [audioOutputsCount, setAudioOutputsCount] = useState<number>(0);
  const [castVolume, setCastVolume] = useState<number>(85);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const castInitializedRef = useRef<boolean>(false);
  const remotePlayerRef = useRef<any>(null);
  const remoteControllerRef = useRef<any>(null);
  const lastLoadedCastTrackIdRef = useRef<string | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const canSelectAudioOutput =
    typeof navigator !== 'undefined' &&
    Boolean((navigator.mediaDevices as any)?.selectAudioOutput);

  const loadSongToCastSession = useCallback(
    async (session: any, song: Song | null) => {
      if (!session || !song?.audioUrl) return;
      const chromeCast = (window as any).chrome?.cast;
      if (!chromeCast?.media) return;

      try {
        const mediaInfo = new chromeCast.media.MediaInfo(
          toAbsoluteUrl(song.audioUrl),
          'audio/mpeg'
        );
        const metadata = new chromeCast.media.MusicTrackMediaMetadata();
        metadata.title = song.title || "Beto's Radio";
        metadata.artist = song.artist || "Beto's Radio";
        metadata.albumName = song.album || 'Transmissão Hi-Fi';
        metadata.images = [new chromeCast.Image(toAbsoluteUrl(song.coverUrl))];
        mediaInfo.metadata = metadata;

        const request = new chromeCast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        await session.loadMedia(request);
        lastLoadedCastTrackIdRef.current = song.id;

        // Pause local element so audio plays cleanly on the Cast device only
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      } catch (err) {
        console.warn('Erro ao enviar faixa para Chromecast:', err);
      }
    },
    [audioRef]
  );

  // Initialize Google Cast Web Sender SDK when available
  useEffect(() => {
    const initCast = () => {
      if (castInitializedRef.current) return;
      const w = window as any;
      const castFramework = w.cast?.framework;
      const chromeCast = w.chrome?.cast;
      if (!castFramework || !chromeCast) return;

      try {
        castInitializedRef.current = true;
        const context = castFramework.CastContext.getInstance();
        context.setOptions({
          receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        setCastAvailable(true);
        setCastState(String(context.getCastState()));

        const player = new castFramework.RemotePlayer();
        const controller = new castFramework.RemotePlayerController(player);
        remotePlayerRef.current = player;
        remoteControllerRef.current = controller;

        const syncFromContext = () => {
          const state = String(context.getCastState());
          setCastState(state);
          const session = context.getCurrentSession();
          if (session) {
            const devName = session.getCastDevice?.()?.friendlyName || 'Dispositivo Chromecast';
            setConnectedDeviceName(devName);
            onCastActiveChange(true);
            setErrorMessage(null);
            setStatusMessage(`Conectado a ${devName}`);
          } else {
            setConnectedDeviceName(null);
            lastLoadedCastTrackIdRef.current = null;
            onCastActiveChange(false);
          }
        };

        context.addEventListener(
          castFramework.CastContextEventType.CAST_STATE_CHANGED,
          syncFromContext
        );
        context.addEventListener(
          castFramework.CastContextEventType.SESSION_STATE_CHANGED,
          (evt: any) => {
            syncFromContext();
            const session = context.getCurrentSession();
            if (
              session &&
              (evt.sessionState === castFramework.SessionState.SESSION_STARTED ||
                evt.sessionState === castFramework.SessionState.SESSION_RESUMED)
            ) {
              void loadSongToCastSession(session, currentSong);
            }
          }
        );

        syncFromContext();
      } catch (err) {
        console.warn('Falha ao inicializar Google Cast SDK:', err);
      }
    };

    initCast();
    window.addEventListener('gcast-ready', initCast);
    const poll = window.setInterval(() => {
      if ((window as any).cast?.framework) {
        initCast();
        window.clearInterval(poll);
      }
    }, 600);

    return () => {
      window.removeEventListener('gcast-ready', initCast);
      window.clearInterval(poll);
    };
  }, [currentSong, loadSongToCastSession, onCastActiveChange]);

  // Keep connected Chromecast updated when changing songs
  useEffect(() => {
    const w = window as any;
    const context = w.cast?.framework?.CastContext?.getInstance?.();
    const session = context?.getCurrentSession?.();
    if (session && currentSong?.id && lastLoadedCastTrackIdRef.current !== currentSong.id) {
      void loadSongToCastSession(session, currentSong);
    }
  }, [currentSong?.id, loadSongToCastSession]);

  // Sync external direct-cast error/status messages when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (externalError) setErrorMessage(externalError);
    if (externalStatus) setStatusMessage(externalStatus);
  }, [isOpen, externalError, externalStatus]);

  // Listen to real W3C Remote Playback (Android Chrome) & Safari AirPlay connection events
  useEffect(() => {
    const audio = audioRef.current as any;
    if (!audio) return;

    const handleConnecting = () => {
      setErrorMessage(null);
      setStatusMessage('Conectando ao aparelho...');
    };

    const handleConnect = () => {
      setConnectedDeviceName('Dispositivo Cast / TV');
      onCastActiveChange(true);
      setErrorMessage(null);
      setStatusMessage('Conectado! Transmitindo áudio.');
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    };

    const handleDisconnect = () => {
      setConnectedDeviceName(null);
      onCastActiveChange(false);
      setStatusMessage('Transmissão desconectada.');
    };

    const handleAirPlayChange = () => {
      if (audio.webkitCurrentPlaybackTargetIsWireless) {
        setConnectedDeviceName('Apple AirPlay');
        onCastActiveChange(true);
        setErrorMessage(null);
        setStatusMessage('Transmitindo via AirPlay.');
      } else {
        setConnectedDeviceName(null);
        onCastActiveChange(false);
      }
    };

    const remote = audio.remote;
    if (remote && typeof remote.addEventListener === 'function') {
      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);
    }
    audio.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);

    return () => {
      if (remote && typeof remote.removeEventListener === 'function') {
        remote.removeEventListener('connecting', handleConnecting);
        remote.removeEventListener('connect', handleConnect);
        remote.removeEventListener('disconnect', handleDisconnect);
      }
      audio.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);
    };
  }, [audioRef, onCastActiveChange]);

  // Watch W3C Remote Playback availability & enumerate audio outputs when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelWatch: (() => void) | undefined;

    const audio = audioRef.current as any;
    if (audio?.remote && typeof audio.remote.watchAvailability === 'function') {
      audio.remote
        .watchAvailability((available: boolean) => {
          setRemotePlaybackAvailable(available);
        })
        .then((callbackId: number) => {
          cancelWatch = () => {
            audio.remote.cancelWatchAvailability?.(callbackId).catch(() => {});
          };
        })
        .catch(() => {
          setRemotePlaybackAvailable(null);
        });
    }

    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => {
          const outputs = devs.filter((d) => d.kind === 'audiooutput');
          setAudioOutputsCount(outputs.length);
        })
        .catch(() => {});
    }

    return () => {
      cancelWatch?.();
    };
  }, [isOpen, audioRef]);

  if (!isOpen) return null;

  const handleOpenRealCast = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSearching(true);

    try {
      const w = window as any;
      const context = w.cast?.framework?.CastContext?.getInstance?.();
      const audio = audioRef.current as any;
      const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

      // 1. On Android Chrome: W3C Remote Playback API opens the native Android Cast chooser directly
      if (isAndroid && audio?.remote && typeof audio.remote.prompt === 'function') {
        onEnsureTrackLoaded?.();
        await audio.remote.prompt();
        if (audio.remote.state === 'connected') {
          setConnectedDeviceName('Dispositivo Cast / TV');
          onCastActiveChange(true);
          setStatusMessage('Transmitindo para o dispositivo selecionado.');
        } else {
          setStatusMessage('Seletor de transmissão do Android aberto.');
        }
        return;
      }

      // 2. Desktop Chrome: Google Cast Web Sender SDK
      if (context && typeof context.requestSession === 'function') {
        await context.requestSession();
        const session = context.getCurrentSession();
        if (session) {
          const devName = session.getCastDevice?.()?.friendlyName || 'Dispositivo Cast';
          setConnectedDeviceName(devName);
          onCastActiveChange(true);
          if (currentSong) {
            await loadSongToCastSession(session, currentSong);
          }
          setStatusMessage(`Transmitindo para ${devName}`);
        }
        return;
      }

      // 3. Fallback: W3C Remote Playback API (Android / Edge / Chrome)
      if (audio?.remote && typeof audio.remote.prompt === 'function') {
        onEnsureTrackLoaded?.();
        await audio.remote.prompt();
        if (audio.remote.state === 'connected') {
          setConnectedDeviceName('Dispositivo Cast / TV');
          onCastActiveChange(true);
        }
        setStatusMessage('Seletor de transmissão remoto aberto.');
        return;
      }

      // 4. Fallback: Safari / iOS AirPlay Picker
      if (audio && typeof audio.webkitShowPlaybackTargetPicker === 'function') {
        onEnsureTrackLoaded?.();
        audio.webkitShowPlaybackTargetPicker();
        setStatusMessage('Seletor AirPlay aberto.');
        return;
      }

      setErrorMessage(
        isInIframe
          ? 'O navegador bloqueia a descoberta de Chromecast dentro do iframe de preview. Abra a rádio diretamente em https://betosradio.com no Chrome ou use "Transmitir" no menu do navegador.'
          : 'Este navegador não suporta Google Cast nativo. No Chrome (Android/PC), use o menu ⋮ → Transmitir (Cast). No iPhone/Mac, use o Safari (AirPlay).'
      );
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      const msg = String(err?.message || err || '');
      if (code === 'cancel' || code === 'AbortError' || /cancel|abort/i.test(msg)) {
        setStatusMessage('Seleção de aparelho cancelada.');
      } else if (/no_devices_found|NotFoundError/i.test(`${code} ${msg}`)) {
        setErrorMessage(
          'Nenhum Chromecast/TV encontrado na mesma rede Wi-Fi. Verifique se o celular/PC e a TV estão no mesmo Wi-Fi.'
        );
      } else if (/InvalidStateError|NotSupportedError/i.test(`${code} ${msg}`)) {
        setErrorMessage(
          'Selecione ou dê Play em uma música antes de transmitir, ou use o menu ⋮ → Transmitir do Chrome.'
        );
      } else if (/NotAllowedError|SecurityError/i.test(`${code} ${msg}`) || isInIframe) {
        setErrorMessage(
          'O navegador bloqueou o Cast nesta janela (iframe/permissão). Acesse diretamente em https://betosradio.com no Google Chrome para detectar seus aparelhos na rede.'
        );
      } else {
        setErrorMessage(
          `Não foi possível abrir o seletor Cast (${msg || 'recurso indisponível neste navegador'}). Tente pelo menu do Chrome (⋮ → Transmitir) ou AirPlay no Safari.`
        );
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAudioOutput = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const audio = audioRef.current as any;

    if (!canSelectAudioOutput || typeof audio?.setSinkId !== 'function') {
      setErrorMessage(
        'A seleção direta de caixa Bluetooth/USB pelo site é suportada apenas no Chrome/Edge Desktop. No celular, conecte seu aparelho Bluetooth normalmente nas configurações do aparelho.'
      );
      return;
    }

    try {
      const device = await (navigator.mediaDevices as any).selectAudioOutput();
      if (device?.deviceId) {
        await audio.setSinkId(device.deviceId);
        const label = device.label || 'Caixa de som / Bluetooth selecionada';
        setAudioOutputLabel(label);
        onCastActiveChange(true);
        setStatusMessage(`Áudio direcionado para: ${label}`);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
        setErrorMessage(err?.message || 'Não foi possível selecionar a saída de áudio.');
      }
    }
  };

  const handleDisconnectCast = () => {
    try {
      const w = window as any;
      const context = w.cast?.framework?.CastContext?.getInstance?.();
      const session = context?.getCurrentSession?.();
      if (session) {
        session.endSession(true);
      }
    } catch {
      // ignore
    }
    setConnectedDeviceName(null);
    setAudioOutputLabel(null);
    lastLoadedCastTrackIdRef.current = null;
    onCastActiveChange(false);
    setStatusMessage('Transmissão desconectada.');
  };

  const handleCastVolumeChange = (val: number) => {
    setCastVolume(val);
    try {
      const player = remotePlayerRef.current;
      const controller = remoteControllerRef.current;
      if (player && controller && player.canControlVolume) {
        player.volumeLevel = val / 100;
        controller.setVolumeLevel();
      }
    } catch {
      // ignore
    }
  };

  const hasDevicesDetected =
    castState === 'NOT_CONNECTED' ||
    castState === 'CONNECTING' ||
    castState === 'CONNECTED' ||
    remotePlaybackAvailable === true;

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
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Cast className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading tracking-wide">
              Transmitir Áudio • Cast Real
            </h2>
            <p className="text-xs text-white/60 font-mono-code">
              Detecta Chromecast, Google TV, Nest Audio, AirPlay e Bluetooth reais
            </p>
          </div>
        </div>

        {/* Iframe warning if running inside AI Studio preview */}
        {isInIframe && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs font-mono-code flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <span>
              Em janelas de preview (iframe), navegadores restringem o scanner de rede local do Cast. Para descobrir sua TV/Chromecast, acesse diretamente{' '}
              <strong className="text-white">betosradio.com</strong> no Chrome ou Safari.
            </span>
          </div>
        )}

        {/* Active connection banner */}
        {(connectedDeviceName || audioOutputLabel) && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center flex-shrink-0">
                <span className="w-3 h-3 bg-emerald-400 rounded-full animate-ping absolute" />
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full relative" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono-code text-emerald-300 font-bold uppercase">
                  Transmitindo Agora
                </p>
                <p className="text-sm font-bold text-white truncate">
                  {connectedDeviceName || audioOutputLabel}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnectCast}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono-code transition-colors border border-red-500/30 flex-shrink-0"
            >
              Desconectar
            </button>
          </div>
        )}

        {/* Real network & SDK status */}
        <div className="mb-4 p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs font-mono-code">
          <div className="flex items-center justify-between text-white/80">
            <span className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              Google Cast SDK:
            </span>
            <span className={castAvailable ? 'text-emerald-300 font-semibold' : 'text-white/50'}>
              {castAvailable
                ? hasDevicesDetected
                  ? 'Pronto (aparelhos disponíveis)'
                  : 'Ativo (buscando na rede Wi-Fi)'
                : 'Usando API nativa / AirPlay'}
            </span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-[11px]">
            <span>Saídas de áudio detectadas no dispositivo:</span>
            <span>{audioOutputsCount > 0 ? `${audioOutputsCount} saída(s)` : 'Padrão do sistema'}</span>
          </div>
        </div>

        {/* Status / Error feedback */}
        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs font-mono-code">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-mono-code">
            {errorMessage}
          </div>
        )}

        {/* Real Action Buttons */}
        <div className="space-y-3 mb-5">
          <button
            onClick={handleOpenRealCast}
            disabled={isSearching}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-cyan-500/25 via-purple-500/25 to-pink-500/25 hover:from-cyan-500/35 hover:to-purple-500/35 border border-cyan-400/40 flex items-center justify-between transition-all text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/30">
                {isSearching ? (
                  <RefreshCw className="w-5 h-5 text-cyan-300 animate-spin" />
                ) : (
                  <Tv className="w-5 h-5 text-cyan-300" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Procurar Aparelhos Cast / TV / AirPlay
                </h4>
                <p className="text-xs text-white/60 font-mono-code">
                  Abre a lista real de Chromecast, Google TV, Nest e Apple AirPlay na sua rede
                </p>
              </div>
            </div>
            <Cast className="w-4 h-4 text-cyan-300 flex-shrink-0" />
          </button>

          <button
            onClick={handleSelectAudioOutput}
            className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-400/25">
                <Bluetooth className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Selecionar Caixa Bluetooth / Saída de Som
                </h4>
                <p className="text-xs text-white/50 font-mono-code">
                  {canSelectAudioOutput
                    ? 'Escolher dispositivo de áudio conectado ao computador'
                    : 'No celular, conecte o Bluetooth pelo sistema; no PC use Chrome/Edge'}
                </p>
              </div>
            </div>
            <Speaker className="w-4 h-4 text-purple-300 flex-shrink-0" />
          </button>
        </div>

        {/* Remote Volume slider if Cast session is connected */}
        {connectedDeviceName && (
          <div className="pt-4 border-t border-white/10 flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono-code text-white/60">Volume Cast:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={castVolume}
              onChange={(e) => handleCastVolumeChange(Number(e.target.value))}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <span className="text-xs font-mono-code text-white/80 w-8 text-right">
              {castVolume}%
            </span>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-code text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Descoberta real via Cast / AirPlay
          </span>
          <span className="truncate max-w-[180px]">
            {currentSong?.title ? `${isPlaying ? '▶ ' : ''}${currentSong.title}` : 'Nenhuma faixa selecionada'}
          </span>
        </div>
      </div>
    </div>
  );
};
