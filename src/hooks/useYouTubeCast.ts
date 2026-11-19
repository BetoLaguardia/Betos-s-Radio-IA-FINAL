import { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '../types/song';

export type CastConnectionMode = 'none' | 'chromecast' | 'remote' | 'airplay' | 'sink';

interface UseYouTubeCastOptions {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  songs: Song[];
  currentSong: Song | null;
  currentSongIndex: number | null;
  onSelectSongIndex: (index: number) => void;
  onSyncPlayState: (playing: boolean) => void;
  onSyncTime: (time: number) => void;
  onSyncDuration: (duration: number) => void;
  onSongStartedOnCast?: (songId: string) => void;
  onOpenCastModal: () => void;
}

function toAbsoluteUrl(url?: string): string {
  if (!url) return `${window.location.origin}/logo.jpg`;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return `${window.location.origin}/logo.jpg`;
  }
}

function inferAudioMimeType(url?: string): string {
  const lower = (url || '').toLowerCase().split('?')[0];
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'audio/mpeg';
}

export function useYouTubeCast({
  audioRef,
  songs,
  currentSong,
  currentSongIndex,
  onSelectSongIndex,
  onSyncPlayState,
  onSyncTime,
  onSyncDuration,
  onSongStartedOnCast,
  onOpenCastModal,
}: UseYouTubeCastOptions) {
  const [castAvailable, setCastAvailable] = useState(false);
  const [castSdkState, setCastSdkState] = useState<string>('NO_DEVICES_AVAILABLE');
  const [castMode, setCastMode] = useState<CastConnectionMode>('none');
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [remotePlaybackAvailable, setRemotePlaybackAvailable] = useState<boolean | null>(null);
  const [audioOutputsCount, setAudioOutputsCount] = useState<number>(0);
  const [castVolume, setCastVolume] = useState<number>(85);
  const [isCastMuted, setIsCastMuted] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const castInitializedRef = useRef(false);
  const remotePlayerRef = useRef<any>(null);
  const remoteControllerRef = useRef<any>(null);
  const lastLoadedCastTrackIdRef = useRef<string | null>(null);
  const castModeRef = useRef<CastConnectionMode>('none');
  castModeRef.current = castMode;

  // Latest state refs so Google Cast listeners never capture stale closures
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const currentSongIndexRef = useRef(currentSongIndex);
  currentSongIndexRef.current = currentSongIndex;

  const callbacksRef = useRef({
    onSelectSongIndex,
    onSyncPlayState,
    onSyncTime,
    onSyncDuration,
    onSongStartedOnCast,
    onOpenCastModal,
  });
  callbacksRef.current = {
    onSelectSongIndex,
    onSyncPlayState,
    onSyncTime,
    onSyncDuration,
    onSongStartedOnCast,
    onOpenCastModal,
  };

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const canSelectAudioOutput =
    typeof navigator !== 'undefined' &&
    Boolean((navigator.mediaDevices as any)?.selectAudioOutput);
  const isCastActive = castMode !== 'none';

  const buildCastMediaInfo = useCallback((chromeCast: any, song: Song) => {
    const absAudio = toAbsoluteUrl(song.audioUrl);
    const absCover = toAbsoluteUrl(song.coverUrl);
    const mediaInfo = new chromeCast.media.MediaInfo(absAudio, inferAudioMimeType(song.audioUrl));
    mediaInfo.streamType = chromeCast.media.StreamType.BUFFERED;
    if (song.duration && Number.isFinite(song.duration) && song.duration > 0) {
      mediaInfo.duration = song.duration;
    }
    mediaInfo.customData = { songId: song.id };

    const metadata = new chromeCast.media.MusicTrackMediaMetadata();
    metadata.title = song.title || "Beto's Radio";
    metadata.artist = song.artist || "Beto's Radio";
    metadata.albumName = song.album || "Beto's Radio • 104.2 FM";
    metadata.images = [new chromeCast.Image(absCover)];
    mediaInfo.metadata = metadata;
    return mediaInfo;
  }, []);

  const loadSongOrQueueToCast = useCallback(
    async (session: any, targetSong: Song | null, resumeSeconds = 0) => {
      if (!session) return;
      const chromeCast = (window as any).chrome?.cast;
      if (!chromeCast?.media) return;

      const list = songsRef.current;
      const effectiveSong = targetSong || list[0] || null;
      if (!effectiveSong?.audioUrl) return;

      try {
        // Pause local <audio> cleanly so audio plays exclusively on the Cast device
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }

        const startIdx = Math.max(
          0,
          list.findIndex((s) => s.id === effectiveSong.id)
        );
        const orderedSongs =
          list.length > 0
            ? [...list.slice(startIdx), ...list.slice(0, startIdx)].slice(0, 25)
            : [effectiveSong];

        const queueSupported =
          typeof chromeCast.media.QueueItem === 'function' &&
          typeof chromeCast.media.QueueLoadRequest === 'function' &&
          typeof session.queueLoad === 'function' &&
          orderedSongs.length > 1;

        if (queueSupported) {
          try {
            const queueItems = orderedSongs.map((s, idx) => {
              const info = buildCastMediaInfo(chromeCast, s);
              const item = new chromeCast.media.QueueItem(info);
              item.autoplay = true;
              item.preloadTime = 4;
              if (idx === 0 && resumeSeconds > 1) {
                item.startTime = Math.floor(resumeSeconds);
              }
              return item;
            });

            const queueReq = new chromeCast.media.QueueLoadRequest(queueItems);
            queueReq.startIndex = 0;
            if (chromeCast.media.RepeatMode?.ALL) {
              queueReq.repeatMode = chromeCast.media.RepeatMode.ALL;
            }
            await session.queueLoad(queueReq);
            lastLoadedCastTrackIdRef.current = effectiveSong.id;
            callbacksRef.current.onSyncPlayState(true);
            callbacksRef.current.onSongStartedOnCast?.(effectiveSong.id);
            return;
          } catch (queueErr) {
            console.warn('QueueLoad fallback to single LoadRequest:', queueErr);
          }
        }

        const mediaInfo = buildCastMediaInfo(chromeCast, effectiveSong);
        const request = new chromeCast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        if (resumeSeconds > 1) {
          request.currentTime = Math.floor(resumeSeconds);
        }
        await session.loadMedia(request);
        lastLoadedCastTrackIdRef.current = effectiveSong.id;
        callbacksRef.current.onSyncPlayState(true);
        callbacksRef.current.onSongStartedOnCast?.(effectiveSong.id);
      } catch (err) {
        console.warn('Erro ao carregar faixa no Chromecast:', err);
      }
    },
    [audioRef, buildCastMediaInfo]
  );

  // Initialize Google Cast Web Sender SDK at app level (identical to YouTube Web)
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
        setCastSdkState(String(context.getCastState()));

        const player = new castFramework.RemotePlayer();
        const controller = new castFramework.RemotePlayerController(player);
        remotePlayerRef.current = player;
        remoteControllerRef.current = controller;

        const syncSessionState = () => {
          const state = String(context.getCastState());
          setCastSdkState(state);
          const session = context.getCurrentSession();
          if (session) {
            const devName = session.getCastDevice?.()?.friendlyName || 'TV / Chromecast';
            setConnectedDeviceName(devName);
            setCastMode('chromecast');
            setErrorMessage(null);
            setStatusMessage(`Transmitindo para ${devName}`);
          } else if (castModeRef.current === 'chromecast') {
            setConnectedDeviceName(null);
            setCastMode('none');
            lastLoadedCastTrackIdRef.current = null;
          }
        };

        context.addEventListener(
          castFramework.CastContextEventType.CAST_STATE_CHANGED,
          syncSessionState
        );

        context.addEventListener(
          castFramework.CastContextEventType.SESSION_STATE_CHANGED,
          (evt: any) => {
            syncSessionState();
            const session = context.getCurrentSession();
            if (
              session &&
              (evt.sessionState === castFramework.SessionState.SESSION_STARTED ||
                evt.sessionState === castFramework.SessionState.SESSION_RESUMED)
            ) {
              let songToCast = currentSongRef.current;
              if (!songToCast && songsRef.current.length > 0) {
                songToCast = songsRef.current[0];
                callbacksRef.current.onSelectSongIndex(0);
              }
              const currentPos = audioRef.current?.currentTime || 0;
              void loadSongOrQueueToCast(session, songToCast, currentPos);
            } else if (evt.sessionState === castFramework.SessionState.SESSION_ENDED) {
              setConnectedDeviceName(null);
              setCastMode('none');
              lastLoadedCastTrackIdRef.current = null;
              setStatusMessage('Transmissão encerrada.');
            }
          }
        );

        const eventType = castFramework.RemotePlayerEventType;
        controller.addEventListener(eventType.IS_PAUSED_CHANGED, () => {
          if (castModeRef.current !== 'chromecast') return;
          callbacksRef.current.onSyncPlayState(!player.isPaused);
        });

        controller.addEventListener(eventType.CURRENT_TIME_CHANGED, () => {
          if (castModeRef.current !== 'chromecast') return;
          if (typeof player.currentTime === 'number' && Number.isFinite(player.currentTime)) {
            callbacksRef.current.onSyncTime(player.currentTime);
          }
        });

        controller.addEventListener(eventType.DURATION_CHANGED, () => {
          if (castModeRef.current !== 'chromecast') return;
          if (typeof player.duration === 'number' && player.duration > 0) {
            callbacksRef.current.onSyncDuration(player.duration);
          }
        });

        controller.addEventListener(eventType.VOLUME_LEVEL_CHANGED, () => {
          if (typeof player.volumeLevel === 'number') {
            setCastVolume(Math.round(player.volumeLevel * 100));
          }
        });

        controller.addEventListener(eventType.IS_MUTED_CHANGED, () => {
          setIsCastMuted(Boolean(player.isMuted));
        });

        controller.addEventListener(eventType.MEDIA_INFO_CHANGED, () => {
          if (castModeRef.current !== 'chromecast') return;
          const info = player.mediaInfo;
          if (!info) return;
          const songId = info.customData?.songId;
          const contentId = info.contentId;
          const idx = songsRef.current.findIndex(
            (s) =>
              (songId && s.id === songId) ||
              (contentId && toAbsoluteUrl(s.audioUrl) === contentId)
          );
          if (idx !== -1 && idx !== currentSongIndexRef.current) {
            lastLoadedCastTrackIdRef.current = songsRef.current[idx].id;
            callbacksRef.current.onSelectSongIndex(idx);
            callbacksRef.current.onSongStartedOnCast?.(songsRef.current[idx].id);
          }
        });

        syncSessionState();
      } catch (err) {
        console.warn('Falha ao inicializar Google Cast SDK:', err);
      }
    };

    initCast();
    window.addEventListener('gcast-ready', initCast);
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      if ((window as any).cast?.framework) {
        initCast();
        window.clearInterval(poll);
      } else if (attempts > 40) {
        window.clearInterval(poll);
      }
    }, 500);

    return () => {
      window.removeEventListener('gcast-ready', initCast);
      window.clearInterval(poll);
    };
  }, [audioRef, loadSongOrQueueToCast]);

  // Smooth teleprompter & timer progress while playing on Chromecast
  useEffect(() => {
    if (castMode !== 'chromecast') return;
    const timer = window.setInterval(() => {
      const player = remotePlayerRef.current;
      if (player && player.isConnected && !player.isPaused && typeof player.currentTime === 'number') {
        callbacksRef.current.onSyncTime(player.currentTime);
      }
    }, 350);
    return () => window.clearInterval(timer);
  }, [castMode]);

  // Keep Chromecast updated when user switches songs locally
  useEffect(() => {
    if (castMode !== 'chromecast' || !currentSong?.id) return;
    if (lastLoadedCastTrackIdRef.current === currentSong.id) return;
    const w = window as any;
    const session = w.cast?.framework?.CastContext?.getInstance?.()?.getCurrentSession?.();
    if (session) {
      void loadSongOrQueueToCast(session, currentSong, 0);
    }
  }, [castMode, currentSong?.id, currentSong, loadSongOrQueueToCast]);

  // Listen to W3C Remote Playback (Android Chrome) & Apple AirPlay events
  useEffect(() => {
    const audio = audioRef.current as any;
    if (!audio) return;

    audio.disableRemotePlayback = false;

    const handleConnecting = () => {
      setErrorMessage(null);
      setStatusMessage('Conectando ao aparelho...');
    };

    const handleConnect = () => {
      setConnectedDeviceName('TV / Aparelho Remoto');
      setCastMode('remote');
      setErrorMessage(null);
      setStatusMessage('Transmitindo áudio para o dispositivo selecionado!');
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    };

    const handleDisconnect = () => {
      if (castModeRef.current === 'remote') {
        setConnectedDeviceName(null);
        setCastMode('none');
        setStatusMessage('Transmissão desconectada.');
      }
    };

    const handleAirPlayChange = () => {
      if (audio.webkitCurrentPlaybackTargetIsWireless) {
        setConnectedDeviceName('Apple AirPlay');
        setCastMode('airplay');
        setErrorMessage(null);
        setStatusMessage('Transmitindo via Apple AirPlay.');
      } else if (castModeRef.current === 'airplay') {
        setConnectedDeviceName(null);
        setCastMode('none');
      }
    };

    const remote = audio.remote;
    if (remote && typeof remote.addEventListener === 'function') {
      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);
    }
    audio.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);

    let cancelWatch: (() => void) | undefined;
    if (remote && typeof remote.watchAvailability === 'function') {
      remote
        .watchAvailability((available: boolean) => {
          setRemotePlaybackAvailable(available);
        })
        .then((id: number) => {
          cancelWatch = () => {
            remote.cancelWatchAvailability?.(id).catch(() => {});
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
          setAudioOutputsCount(devs.filter((d) => d.kind === 'audiooutput').length);
        })
        .catch(() => {});
    }

    return () => {
      cancelWatch?.();
      if (remote && typeof remote.removeEventListener === 'function') {
        remote.removeEventListener('connecting', handleConnecting);
        remote.removeEventListener('connect', handleConnect);
        remote.removeEventListener('disconnect', handleDisconnect);
      }
      audio.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);
    };
  }, [audioRef]);

  // Preload first audio silently on pointerdown/touchstart so RemotePlayback never hits InvalidStateError
  const prepareCast = useCallback(() => {
    const audio = audioRef.current as any;
    if (!audio) return;
    audio.disableRemotePlayback = false;
    if (!audio.currentSrc && songsRef.current.length > 0) {
      const firstUrl = songsRef.current[0]?.audioUrl;
      if (firstUrl) {
        audio.setAttribute('data-loaded-url', firstUrl);
        audio.src = firstUrl;
        audio.load();
      }
    }
  }, [audioRef]);

  const ensureTrackSelectedSync = useCallback((): Song | null => {
    const audio = audioRef.current as any;
    const active = currentSongRef.current;
    if (active?.audioUrl) {
      if (audio && audio.getAttribute('data-loaded-url') !== active.audioUrl) {
        audio.setAttribute('data-loaded-url', active.audioUrl);
        audio.src = active.audioUrl;
        audio.load();
      }
      return active;
    }

    const first = songsRef.current[0];
    if (first?.audioUrl) {
      if (audio && audio.getAttribute('data-loaded-url') !== first.audioUrl) {
        audio.setAttribute('data-loaded-url', first.audioUrl);
        audio.src = first.audioUrl;
        audio.load();
      }
      callbacksRef.current.onSelectSongIndex(0);
      return first;
    }
    return null;
  }, [audioRef]);

  // Open real browser Cast chooser synchronously without breaking transient user activation
  const launchNativeCastChooser = useCallback(
    (openModalOnUnavailable: boolean) => {
      setErrorMessage(null);
      setStatusMessage(null);

      const audio = audioRef.current as any;
      const w = window as any;
      const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
      const context = w.cast?.framework?.CastContext?.getInstance?.();

      ensureTrackSelectedSync();
      if (audio) {
        audio.disableRemotePlayback = false;
      }

      // 1. Desktop Chrome: Google Cast Web Sender SDK (exact YouTube Cast experience)
      if (!isAndroid && context && typeof context.requestSession === 'function') {
        const currentSdkState = String(context.getCastState());
        if (currentSdkState === 'NO_DEVICES_AVAILABLE') {
          if (openModalOnUnavailable) {
            setStatusMessage(
              'Buscando TVs e Chromecast na rede Wi-Fi... Você também pode usar o botão nativo do Chrome abaixo.'
            );
            callbacksRef.current.onOpenCastModal();
          } else {
            setErrorMessage(
              'Nenhum Chromecast/TV encontrado no mesmo Wi-Fi. Verifique se a TV e o dispositivo estão na mesma rede.'
            );
          }
          return;
        }

        setIsSearching(true);
        Promise.resolve(context.requestSession())
          .then(() => {
            const session = context.getCurrentSession?.();
            if (session) {
              const devName = session.getCastDevice?.()?.friendlyName || 'TV / Chromecast';
              setConnectedDeviceName(devName);
              setCastMode('chromecast');
              setStatusMessage(`Transmitindo para ${devName}`);
            }
          })
          .catch((err: any) => {
            const code = err?.code || err?.name || '';
            const msg = String(err?.message || err || '');
            if (code === 'cancel' || code === 'AbortError' || /cancel|abort/i.test(msg)) {
              return;
            }
            if (/no_devices_found|NotFoundError/i.test(`${code} ${msg}`)) {
              setErrorMessage(
                'Nenhum Chromecast/TV encontrado na mesma rede Wi-Fi.'
              );
            } else if (/NotAllowedError|SecurityError/i.test(`${code} ${msg}`) || isInIframe) {
              setErrorMessage(
                'O navegador bloqueia a descoberta Cast dentro do iframe de preview. Abra https://betosradio.com diretamente.'
              );
            } else {
              setErrorMessage(
                'Não foi possível iniciar o Cast pelo atalho. Tente novamente pelo painel abaixo ou menu ⋮ → Transmitir.'
              );
            }
            if (openModalOnUnavailable) {
              callbacksRef.current.onOpenCastModal();
            }
          })
          .finally(() => {
            setIsSearching(false);
          });
        return;
      }

      // 2. Android Chrome / Edge / Mobile: W3C Remote Playback called SYNCHRONOUSLY inside click
      if (audio?.remote && typeof audio.remote.prompt === 'function') {
        setIsSearching(true);
        Promise.resolve(audio.remote.prompt())
          .then(() => {
            if (audio.remote.state === 'connected') {
              setConnectedDeviceName('TV / Chromecast');
              setCastMode('remote');
              setStatusMessage('Transmitindo para o dispositivo selecionado!');
            }
          })
          .catch((err: any) => {
            const code = err?.code || err?.name || '';
            const msg = String(err?.message || err || '');
            if (code === 'AbortError' || /cancel|abort/i.test(msg)) {
              return;
            }
            if (/InvalidStateError/i.test(`${code} ${msg}`)) {
              setStatusMessage(
                'Faixa pronta para transmissão! Toque em "Procurar TV / Chromecast" abaixo para abrir a lista de aparelhos.'
              );
            } else if (/NotFoundError|no_devices_found/i.test(`${code} ${msg}`)) {
              setErrorMessage(
                'Nenhum Chromecast ou Smart TV encontrado neste Wi-Fi. Verifique se o celular e a TV estão na mesma rede.'
              );
            } else if (/NotSupportedError/i.test(`${code} ${msg}`)) {
              setErrorMessage(
                'Este aparelho/navegador não liberou o seletor Cast direto para áudio. No Android Chrome, toque no menu ⋮ → Transmitir.'
              );
            } else if (/NotAllowedError|SecurityError/i.test(`${code} ${msg}`) || isInIframe) {
              setErrorMessage(
                'O navegador bloqueia o Cast em janelas incorporadas (iframe). Abra https://betosradio.com no Chrome.'
              );
            } else {
              setErrorMessage(
                `Não foi possível abrir o seletor Cast (${msg || 'recurso indisponível'}).`
              );
            }
            if (openModalOnUnavailable) {
              callbacksRef.current.onOpenCastModal();
            }
          })
          .finally(() => {
            setIsSearching(false);
          });
        return;
      }

      // 3. Apple Safari / iOS AirPlay Picker (synchronous)
      if (audio && typeof audio.webkitShowPlaybackTargetPicker === 'function') {
        try {
          audio.webkitShowPlaybackTargetPicker();
          setStatusMessage('Seletor AirPlay aberto.');
        } catch {
          if (openModalOnUnavailable) {
            callbacksRef.current.onOpenCastModal();
          }
        }
        return;
      }

      // 4. Desktop Chrome fallback if CastContext wasn't ready yet
      if (context && typeof context.requestSession === 'function') {
        setIsSearching(true);
        Promise.resolve(context.requestSession())
          .catch(() => {
            if (openModalOnUnavailable) callbacksRef.current.onOpenCastModal();
          })
          .finally(() => setIsSearching(false));
        return;
      }

      // 5. Fallback: Open YouTube-style Cast sheet with guidance & Bluetooth output
      if (isInIframe) {
        setErrorMessage(
          'O navegador bloqueia a descoberta de Chromecast dentro do iframe de preview. Abra diretamente em https://betosradio.com.'
        );
      }
      if (openModalOnUnavailable) {
        callbacksRef.current.onOpenCastModal();
      }
    },
    [audioRef, ensureTrackSelectedSync, isInIframe]
  );

  // Triggered by header & player Cast buttons
  const handleCastButtonClick = useCallback(() => {
    if (isCastActive) {
      callbacksRef.current.onOpenCastModal();
      return;
    }
    launchNativeCastChooser(true);
  }, [isCastActive, launchNativeCastChooser]);

  // Remote control actions for Chromecast session
  const castPlayPause = useCallback(() => {
    if (castMode !== 'chromecast') return false;
    const controller = remoteControllerRef.current;
    if (controller) {
      controller.playOrPause();
      return true;
    }
    return false;
  }, [castMode]);

  const castSeek = useCallback(
    (time: number) => {
      if (castMode !== 'chromecast') return false;
      const player = remotePlayerRef.current;
      const controller = remoteControllerRef.current;
      if (player && controller) {
        player.currentTime = time;
        controller.seek();
        callbacksRef.current.onSyncTime(time);
        return true;
      }
      return false;
    },
    [castMode]
  );

  const castNext = useCallback((): boolean => {
    if (castMode !== 'chromecast') return false;
    const w = window as any;
    const session = w.cast?.framework?.CastContext?.getInstance?.()?.getCurrentSession?.();
    const mediaSession = session?.getMediaSession?.();
    if (mediaSession && typeof mediaSession.queueNext === 'function') {
      mediaSession.queueNext(null, () => {}, () => {});
      return true;
    }
    return false;
  }, [castMode]);

  const castPrev = useCallback((): boolean => {
    if (castMode !== 'chromecast') return false;
    const player = remotePlayerRef.current;
    const controller = remoteControllerRef.current;
    if (player && controller && player.currentTime > 3) {
      player.currentTime = 0;
      controller.seek();
      callbacksRef.current.onSyncTime(0);
      return true;
    }
    const w = window as any;
    const session = w.cast?.framework?.CastContext?.getInstance?.()?.getCurrentSession?.();
    const mediaSession = session?.getMediaSession?.();
    if (mediaSession && typeof mediaSession.queuePrev === 'function') {
      mediaSession.queuePrev(null, () => {}, () => {});
      return true;
    }
    return false;
  }, [castMode]);

  const castSelectSong = useCallback(
    (song: Song): boolean => {
      if (castMode !== 'chromecast') return false;
      const w = window as any;
      const session = w.cast?.framework?.CastContext?.getInstance?.()?.getCurrentSession?.();
      if (session) {
        void loadSongOrQueueToCast(session, song, 0);
        return true;
      }
      return false;
    },
    [castMode, loadSongOrQueueToCast]
  );

  const handleCastVolumeChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setCastVolume(clamped);
    try {
      const player = remotePlayerRef.current;
      const controller = remoteControllerRef.current;
      if (player && controller && player.canControlVolume) {
        player.volumeLevel = clamped / 100;
        controller.setVolumeLevel();
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCastToggleMute = useCallback(() => {
    try {
      const controller = remoteControllerRef.current;
      const player = remotePlayerRef.current;
      if (player && controller) {
        controller.muteOrUnmute();
        setIsCastMuted(!player.isMuted);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectAudioOutput = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const audio = audioRef.current as any;

    if (!canSelectAudioOutput || typeof audio?.setSinkId !== 'function') {
      setErrorMessage(
        'A seleção direta de caixa Bluetooth/USB pelo site é suportada no Chrome/Edge Desktop. No celular, pareie o Bluetooth nas configurações do aparelho.'
      );
      return;
    }

    try {
      const device = await (navigator.mediaDevices as any).selectAudioOutput();
      if (device?.deviceId) {
        await audio.setSinkId(device.deviceId);
        const label = device.label || 'Caixa de som / Bluetooth selecionada';
        setConnectedDeviceName(label);
        setCastMode('sink');
        setStatusMessage(`Áudio direcionado para: ${label}`);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
        setErrorMessage(err?.message || 'Não foi possível selecionar a saída de áudio.');
      }
    }
  }, [audioRef, canSelectAudioOutput]);

  const handleDisconnectCast = useCallback(() => {
    const player = remotePlayerRef.current;
    const resumeTime = player?.currentTime || 0;
    const wasPlayingOnTv = Boolean(player && !player.isPaused);

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

    const audio = audioRef.current as any;
    if (castModeRef.current === 'sink' && audio && typeof audio.setSinkId === 'function') {
      audio.setSinkId('').catch(() => {});
    }

    if (castModeRef.current === 'chromecast' && audio && currentSongRef.current?.audioUrl) {
      if (resumeTime > 0 && Number.isFinite(resumeTime)) {
        audio.currentTime = resumeTime;
      }
      if (wasPlayingOnTv) {
        audio.play().catch(() => {});
        callbacksRef.current.onSyncPlayState(true);
      } else {
        callbacksRef.current.onSyncPlayState(false);
      }
    }

    setConnectedDeviceName(null);
    setCastMode('none');
    lastLoadedCastTrackIdRef.current = null;
    setStatusMessage('Transmissão desconectada.');
  }, [audioRef]);

  const clearCastMessages = useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

  return {
    castAvailable,
    castSdkState,
    castMode,
    isCastActive,
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
    prepareCast,
    handleCastButtonClick,
    launchNativeCastChooser,
    castPlayPause,
    castSeek,
    castNext,
    castPrev,
    castSelectSong,
    handleCastVolumeChange,
    handleCastToggleMute,
    handleSelectAudioOutput,
    handleDisconnectCast,
    clearCastMessages,
  };
}
