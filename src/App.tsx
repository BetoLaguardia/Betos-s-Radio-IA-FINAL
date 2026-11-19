import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Song, BandInfo } from './types/song';
import { StationHeader } from './components/StationHeader';
import { TopPlayer } from './components/TopPlayer';
import { LyricsDisplay } from './components/LyricsDisplay';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { CastModal } from './components/CastModal';
import { CreatorLoginModal } from './components/CreatorLoginModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { useAdmin } from './context/AdminContext';
import { generateAutomaticLyrics } from './utils/lyricGenerator';
import { loadCachedDurations, probeAudioDuration, saveCachedDuration } from './utils/audioDuration';

function getAbsoluteArtworkUrl(url?: string): string {
  const fallback = `${window.location.origin}/logo.jpg`;
  if (!url) return fallback;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return fallback;
  }
}

function inferImageMimeType(url: string): string | undefined {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return undefined;
}

function shuffleSongs<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function App() {
  const { isAdmin, getAuthHeaders } = useAdmin();
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [isRadioMode, setIsRadioMode] = useState<boolean>(true);
  const [isCastActive, setIsCastActive] = useState<boolean>(false);

  // Like & Share state
  const [likedSongIds, setLikedSongIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('betos_radio_liked_songs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [sharedSongId, setSharedSongId] = useState<string | null>(null);

  // Modals
  const [isCastModalOpen, setIsCastModalOpen] = useState<boolean>(false);
  const [isCreatorLoginOpen, setIsCreatorLoginOpen] = useState<boolean>(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
  const [songToEditInAdmin, setSongToEditInAdmin] = useState<Song | null>(null);

  // Audio element reference & current track id tracker for background sync
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const sessionOrderRef = useRef<string[]>([]);
  const initialDeepLinkHandledRef = useRef<boolean>(false);
  const probedUrlsRef = useRef<Set<string>>(new Set());
  const [resolvedDurations, setResolvedDurations] = useState<Record<string, number>>(() =>
    loadCachedDurations()
  );

  const currentSong = currentSongIndex !== null ? songs[currentSongIndex] || null : null;
  currentSongIdRef.current = currentSong?.id ?? null;

  const currentSongRef = useRef<Song | null>(currentSong);
  currentSongRef.current = currentSong;
  const durationRef = useRef<number>(duration);
  durationRef.current = duration;
  const lastMediaSessionPosUpdateRef = useRef<number>(0);
  const handlePlayPauseRef = useRef<() => void>(() => {});
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});
  const handleSeekRef = useRef<(time: number) => void>(() => {});

  // Fetch songs from server (Supabase / Vercel Blob / local JSON)
  const fetchSongs = async (preserveCurrentTrack = false) => {
    try {
      const res = await fetch('/api/songs', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.songs)) {
        const cached = loadCachedDurations();
        const nextSongs = (data.songs as Song[]).map((song) =>
          song.audioUrl && cached[song.audioUrl]
            ? { ...song, duration: cached[song.audioUrl] }
            : song
        );

        let orderedSongs: Song[];
        if (sessionOrderRef.current.length === 0) {
          orderedSongs = shuffleSongs(nextSongs);
          sessionOrderRef.current = orderedSongs.map((s) => s.id);
        } else {
          const orderMap = new Map(sessionOrderRef.current.map((id, idx) => [id, idx]));
          const knownSongs: Song[] = [];
          const newSongs: Song[] = [];
          for (const song of nextSongs) {
            if (orderMap.has(song.id)) {
              knownSongs.push(song);
            } else {
              newSongs.push(song);
            }
          }
          knownSongs.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
          orderedSongs = [...newSongs, ...knownSongs];
          sessionOrderRef.current = orderedSongs.map((s) => s.id);
        }

        setSongs(orderedSongs);

        // Support deep-linked shared track (?track=<id>) on initial load
        if (!initialDeepLinkHandledRef.current) {
          initialDeepLinkHandledRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const sharedTrackId = params.get('track');
          if (sharedTrackId) {
            const idx = orderedSongs.findIndex((s) => s.id === sharedTrackId);
            if (idx !== -1) {
              setCurrentSongIndex(idx);
              return;
            }
          }
        }

        if (preserveCurrentTrack && currentSongIdRef.current) {
          const preservedIdx = orderedSongs.findIndex((s) => s.id === currentSongIdRef.current);
          if (preservedIdx !== -1) {
            setCurrentSongIndex(preservedIdx);
          } else {
            setCurrentSongIndex(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load songs from backend:', err);
    }
  };

  useEffect(() => {
    fetchSongs(false);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSongs(true);
      }
    }, 15000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchSongs(true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  const effectiveLyrics = useMemo(() => {
    if (!currentSong) return '';
    const raw = currentSong.lyrics;
    const isPlaceholder = !raw || 
      raw.includes('[Áudio Carregado Localmente]') || 
      raw.includes('[Instrumental / Suno AI Track]') ||
      raw.includes('[Áudio Carregado Diretamente]') ||
      raw.trim().length < 20;

    if (isPlaceholder) {
      return generateAutomaticLyrics(currentSong.title || '', currentSong.artist || '', currentSong.stylePrompt || '');
    }
    return raw;
  }, [currentSong]);

  // Probe real audio durations in background so every playlist item shows its true length
  useEffect(() => {
    if (songs.length === 0) return;

    const urlsToProbe = Array.from(
      new Set(
        songs
          .map((s) => s.audioUrl)
          .filter(
            (url): url is string =>
              Boolean(url) && !resolvedDurations[url] && !probedUrlsRef.current.has(url)
          )
      )
    );

    if (urlsToProbe.length === 0) return;

    let cancelled = false;
    const queue = [...urlsToProbe];

    const worker = async () => {
      while (!cancelled && queue.length > 0) {
        const url = queue.shift();
        if (!url) break;
        probedUrlsRef.current.add(url);
        const measured = await probeAudioDuration(url);
        if (cancelled || !measured || measured <= 0) continue;

        saveCachedDuration(url, measured);
        setResolvedDurations((prev) => (prev[url] === measured ? prev : { ...prev, [url]: measured }));
        setSongs((prev) =>
          prev.map((s) => (s.audioUrl === url ? { ...s, duration: measured } : s))
        );
      }
    };

    const concurrency = Math.min(3, queue.length);
    for (let i = 0; i < concurrency; i++) {
      void worker();
    }

    return () => {
      cancelled = true;
    };
  }, [songs, resolvedDurations]);

  // Smooth frame-accurate time tracking while playing for teleprompter & countdown
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;

    const tick = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, currentSong?.id]);

  // Handle Audio source and events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentSong?.audioUrl) {
      syncMediaSessionMetadata(currentSong);
      if (audio.getAttribute('data-loaded-url') !== currentSong.audioUrl) {
        audio.setAttribute('data-loaded-url', currentSong.audioUrl);
        audio.src = currentSong.audioUrl;
        audio.load();
      }
      setCurrentTime(0);
      setDuration(resolvedDurations[currentSong.audioUrl] ?? currentSong.duration ?? 0);
      if (isPlaying) {
        audio.play().catch((err) => console.log('Audio autoplay prevented:', err));
      }
    } else {
      syncMediaSessionMetadata(null);
      audio.pause();
      audio.removeAttribute('data-loaded-url');
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
  }, [currentSong?.id, currentSong?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const syncMediaSessionMetadata = (song: Song | null) => {
    if (typeof document !== 'undefined') {
      document.title = song
        ? `${song.title} • ${song.artist} — Beto's Radio`
        : "Beto's Radio - Som Retrô-Futurista & Hi-Fi";
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogDescription = document.querySelector('meta[property="og:description"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      const resolvedCover = getAbsoluteArtworkUrl(song?.coverUrl || '/logo.jpg');
      if (ogTitle) {
        ogTitle.setAttribute('content', "Beto's Radio - Rádio com poder IA");
      }
      if (ogDescription) {
        ogDescription.setAttribute(
          'content',
          "Beto's Radio - Transmissão musical exclusiva com IA. Desfrute o poder da rádio IA!"
        );
      }
      if (ogImage) ogImage.setAttribute('content', resolvedCover);
      if (twitterImage) twitterImage.setAttribute('content', resolvedCover);
    }

    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof MediaMetadata === 'undefined'
    ) {
      return;
    }

    const ms = navigator.mediaSession;
    if (!song) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }

    const buildMetadata = (coverSrc: string) => {
      const artworkType = inferImageMimeType(coverSrc);
      const sizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'];
      const artwork: MediaImage[] = sizes.map((size) => ({
        src: coverSrc,
        sizes: size,
        ...(artworkType ? { type: artworkType } : {}),
      }));

      ms.metadata = new MediaMetadata({
        title: song.title || "Beto's Radio",
        artist: song.artist || "Beto's Radio",
        album: song.album || "Beto's Radio • 104.2 FM",
        artwork,
      });
    };

    const primaryCover = getAbsoluteArtworkUrl(song.coverUrl || '/logo.jpg');
    buildMetadata(primaryCover);

    // If external cover fails to load/decode, automatically swap lock-screen artwork to same-origin proxy or station logo
    if (typeof Image !== 'undefined' && primaryCover !== `${window.location.origin}/logo.jpg`) {
      const probe = new Image();
      probe.onerror = () => {
        if (currentSongIdRef.current !== song.id) return;
        const proxyCover = `${window.location.origin}/api/share-cover?track=${encodeURIComponent(song.id)}`;
        const proxyProbe = new Image();
        proxyProbe.onload = () => {
          if (currentSongIdRef.current === song.id) buildMetadata(proxyCover);
        };
        proxyProbe.onerror = () => {
          if (currentSongIdRef.current === song.id) buildMetadata(`${window.location.origin}/logo.jpg`);
        };
        proxyProbe.src = proxyCover;
      };
      probe.src = primaryCover;
    }
  };

  const updateMediaSessionPosition = (pos: number, dur: number) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== 'function') return;
    if (!dur || !Number.isFinite(dur) || Number.isNaN(dur) || dur <= 0) return;
    try {
      ms.setPositionState({
        duration: dur,
        playbackRate: 1,
        position: Math.min(Math.max(0, Number.isFinite(pos) ? pos : 0), dur),
      });
    } catch {
      // Ignore transient invalid position values on some browsers
    }
  };

  const applyRealAudioDuration = (rawDuration: number) => {
    if (!rawDuration || isNaN(rawDuration) || rawDuration === Infinity || rawDuration <= 0) return;
    setDuration(rawDuration);
    if (audioRef.current) {
      updateMediaSessionPosition(audioRef.current.currentTime || 0, rawDuration);
    }
    if (currentSong?.audioUrl) {
      const rounded = Math.round(rawDuration);
      saveCachedDuration(currentSong.audioUrl, rounded);
      setResolvedDurations((prev) =>
        prev[currentSong.audioUrl] === rounded ? prev : { ...prev, [currentSong.audioUrl]: rounded }
      );
      setSongs((prev) =>
        prev.map((s) =>
          s.audioUrl === currentSong.audioUrl && s.duration !== rounded
            ? { ...s, duration: rounded }
            : s
        )
      );
    }
  };

  // Audio Event Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const t = audioRef.current.currentTime;
      setCurrentTime(t);
      const now = Date.now();
      if (now - lastMediaSessionPosUpdateRef.current >= 1000) {
        lastMediaSessionPosUpdateRef.current = now;
        const d =
          audioRef.current.duration && Number.isFinite(audioRef.current.duration)
            ? audioRef.current.duration
            : durationRef.current;
        updateMediaSessionPosition(t, d);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && d !== Infinity) {
        applyRealAudioDuration(d);
      } else if (currentSong) {
        setDuration(resolvedDurations[currentSong.audioUrl] ?? currentSong.duration ?? 0);
      }
    }
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && d !== Infinity) {
        applyRealAudioDuration(d);
      }
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      if (songs.length > 0) {
        setCurrentSongIndex(0);
        setIsPlaying(true);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log('Playback error:', err));
    }
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    if (currentSongIndex === null) {
      const startIdx = isShuffle ? Math.floor(Math.random() * songs.length) : 0;
      setCurrentSongIndex(startIdx);
      setIsPlaying(true);
      return;
    }
    if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * songs.length);
      setCurrentSongIndex(randomIdx);
    } else {
      setCurrentSongIndex((prev) => ((prev ?? -1) + 1) % songs.length);
    }
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    if (currentSongIndex === null) {
      setCurrentSongIndex(0);
      setIsPlaying(true);
      return;
    }
    const actualTime = audioRef.current ? audioRef.current.currentTime : currentTime;
    if (actualTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      updateMediaSessionPosition(0, durationRef.current);
      return;
    }
    setCurrentSongIndex((prev) => (((prev ?? 0) - 1 + songs.length) % songs.length));
    setIsPlaying(true);
  };

  const handleSongEnded = () => {
    if (isRepeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  const handleSeek = (time: number) => {
    if (!currentSong) return;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      const d =
        audioRef.current.duration && Number.isFinite(audioRef.current.duration)
          ? audioRef.current.duration
          : durationRef.current;
      updateMediaSessionPosition(time, d);
    }
  };

  handlePlayPauseRef.current = handlePlayPause;
  handleNextRef.current = handleNext;
  handlePrevRef.current = handlePrev;
  handleSeekRef.current = handleSeek;

  // Media Session API: show player + album cover on mobile lock screens and handle lock-screen controls
  useEffect(() => {
    syncMediaSessionMetadata(currentSong);
  }, [
    currentSong?.id,
    currentSong?.title,
    currentSong?.artist,
    currentSong?.album,
    currentSong?.coverUrl,
  ]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = !currentSong
      ? 'none'
      : isPlaying
        ? 'playing'
        : 'paused';

    if (currentSong && audioRef.current) {
      const d =
        audioRef.current.duration && Number.isFinite(audioRef.current.duration)
          ? audioRef.current.duration
          : durationRef.current;
      updateMediaSessionPosition(audioRef.current.currentTime || 0, d);
    }
  }, [isPlaying, currentSong?.id]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    // Register track-level actions (play/pause/previous/next/seekto/stop) without seekbackward/seekforward
    // so iOS Safari and Android lock screens prioritize Previous Track and Next Track buttons alongside Pause.
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      [
        'play',
        () => {
          const audio = audioRef.current;
          if (!currentSongRef.current) {
            handlePlayPauseRef.current();
            return;
          }
          syncMediaSessionMetadata(currentSongRef.current);
          if (audio) {
            audio
              .play()
              .then(() => setIsPlaying(true))
              .catch((err) => console.log('MediaSession play error:', err));
          }
        },
      ],
      [
        'pause',
        () => {
          const audio = audioRef.current;
          if (audio) audio.pause();
          setIsPlaying(false);
        },
      ],
      ['previoustrack', () => handlePrevRef.current()],
      ['nexttrack', () => handleNextRef.current()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime !== 'number') return;
          const audio = audioRef.current as any;
          if (details.fastSeek && audio && typeof audio.fastSeek === 'function') {
            audio.fastSeek(details.seekTime);
            setCurrentTime(details.seekTime);
            updateMediaSessionPosition(details.seekTime, durationRef.current);
          } else {
            handleSeekRef.current(details.seekTime);
          }
        },
      ],
      [
        'stop',
        () => {
          const audio = audioRef.current;
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
          setCurrentTime(0);
          setIsPlaying(false);
        },
      ],
    ];

    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported actions
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleSelectSong = (song: Song) => {
    const idx = songs.findIndex((s) => s.id === song.id);
    if (idx !== -1) {
      setCurrentSongIndex(idx);
      setIsPlaying(true);
    }
  };

  const handleDeleteSong = async (id: string) => {
    if (!isAdmin) {
      setIsCreatorLoginOpen(true);
      return;
    }
    try {
      await fetch(`/api/songs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const updated = songs.filter((s) => s.id !== id);
      sessionOrderRef.current = sessionOrderRef.current.filter((itemId) => itemId !== id);
      setSongs(updated);
      if (currentSong?.id === id) {
        setCurrentSongIndex(null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Failed to delete song:', err);
    }
  };

  const handleSongAdded = (newSong: Song, playNow: boolean) => {
    sessionOrderRef.current = [
      newSong.id,
      ...sessionOrderRef.current.filter((id) => id !== newSong.id),
    ];
    setSongs((prev) => [newSong, ...prev]);
    if (playNow) {
      setCurrentSongIndex(0);
      setIsPlaying(true);
    }
  };

  const handleToggleLike = async (songId: string) => {
    const alreadyLiked = likedSongIds.includes(songId);
    const action = alreadyLiked ? 'unlike' : 'like';
    const delta = alreadyLiked ? -1 : 1;

    const nextLikedIds = alreadyLiked
      ? likedSongIds.filter((id) => id !== songId)
      : [...likedSongIds, songId];

    setLikedSongIds(nextLikedIds);
    try {
      localStorage.setItem('betos_radio_liked_songs', JSON.stringify(nextLikedIds));
    } catch {
      // ignore storage errors
    }

    // Optimistic UI update
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, likes: Math.max(0, (s.likes || 0) + delta) } : s))
    );

    try {
      const res = await fetch(`/api/songs/${encodeURIComponent(songId)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes === 'number') {
          setSongs((prev) =>
            prev.map((s) => (s.id === songId ? { ...s, likes: data.likes } : s))
          );
        }
      }
    } catch (err) {
      console.error('Failed to persist like:', err);
    }
  };

  const handleShareSong = async (song: Song) => {
    const shareUrl = `${window.location.origin}/api/share?track=${encodeURIComponent(song.id)}`;
    const shareTitle = "Beto's Radio - Rádio com poder IA";
    const shareText =
      "Beto's Radio - Rádio com poder IA - Beto's Radio - Transmissão musical exclusiva com IA. Desfrute o poder da rádio IA!";

    const markShared = () => {
      setSharedSongId(song.id);
      setTimeout(() => setSharedSongId((prev) => (prev === song.id ? null : prev)), 2200);
    };

    try {
      if (navigator.share) {
        // Try attaching the song's album cover image file for native mobile share sheets
        let coverFile: File | null = null;
        if (typeof navigator.canShare === 'function') {
          try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 2500);
            const coverRes = await fetch(`/api/share-cover?track=${encodeURIComponent(song.id)}`, {
              signal: controller.signal,
            });
            window.clearTimeout(timeoutId);
            if (coverRes.ok) {
              const blob = await coverRes.blob();
              const mime = blob.type || 'image/jpeg';
              const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
              const safeSlug = (song.title || 'capa')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40) || 'musica';
              const candidate = new File([blob], `${safeSlug}.${ext}`, { type: mime });
              if (navigator.canShare({ files: [candidate] })) {
                coverFile = candidate;
              }
            }
          } catch {
            // Fall back to sharing link with OpenGraph cover image
          }
        }

        if (coverFile) {
          try {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl,
              files: [coverFile],
            });
            markShared();
            return;
          } catch (fileShareErr: any) {
            if (fileShareErr?.name === 'AbortError') return;
            // Some share targets reject combined files+url; retry cleanly with url + OG cover preview
          }
        }

        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        markShared();
        return;
      }
    } catch (err: any) {
      // If user cancels native share sheet, do not show error
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      markShared();
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // Save LRC synced lyrics directly to Supabase/backend (Creator mode)
  const handleSaveSyncedLyrics = async (songId: string, syncedLrcLyrics: string) => {
    const res = await fetch(`/api/songs/${encodeURIComponent(songId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ lyrics: syncedLrcLyrics }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Falha ao salvar letra sincronizada.');
    }
    const data = await res.json();
    if (data.song) {
      setSongs((prev) => prev.map((s) => (s.id === songId ? data.song : s)));
    } else {
      setSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, lyrics: syncedLrcLyrics } : s))
      );
    }
  };

  const [castFeedback, setCastFeedback] = useState<{
    error?: string | null;
    status?: string | null;
  }>({});

  const ensureTrackLoadedForCast = (): boolean => {
    const audio = audioRef.current;
    if (!audio) return false;
    if (currentSong?.audioUrl) {
      if (audio.getAttribute('data-loaded-url') !== currentSong.audioUrl) {
        audio.setAttribute('data-loaded-url', currentSong.audioUrl);
        audio.src = currentSong.audioUrl;
        audio.load();
      }
      return true;
    }
    if (songs.length > 0 && songs[0]?.audioUrl) {
      const firstSong = songs[0];
      audio.setAttribute('data-loaded-url', firstSong.audioUrl);
      audio.src = firstSong.audioUrl;
      audio.load();
      setCurrentSongIndex(0);
      return true;
    }
    return false;
  };

  // Direct Cast trigger from the Cast button (sends directly on Android / Chrome / AirPlay)
  const handleDirectCast = async () => {
    setCastFeedback({});

    if (isCastActive) {
      setIsCastModalOpen(true);
      return;
    }

    const audio = audioRef.current as any;
    const w = window as any;
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    try {
      // 1. Android Chrome: W3C Remote Playback opens native Android device picker directly
      if (isAndroid && audio?.remote && typeof audio.remote.prompt === 'function') {
        const hadSrc = Boolean(audio.currentSrc);
        const hasTrack = ensureTrackLoadedForCast();
        if (!hadSrc && hasTrack) {
          await new Promise((r) => window.setTimeout(r, 80));
        }
        await audio.remote.prompt();
        return;
      }

      // 2. Desktop Chrome: Google Cast Web Sender SDK
      const context = w.cast?.framework?.CastContext?.getInstance?.();
      if (context && typeof context.requestSession === 'function') {
        await context.requestSession();
        return;
      }

      // 3. Fallback W3C Remote Playback (Android / Edge / Chrome)
      if (audio?.remote && typeof audio.remote.prompt === 'function') {
        const hadSrc = Boolean(audio.currentSrc);
        const hasTrack = ensureTrackLoadedForCast();
        if (!hadSrc && hasTrack) {
          await new Promise((r) => window.setTimeout(r, 80));
        }
        await audio.remote.prompt();
        return;
      }

      // 4. Apple Safari / iOS AirPlay Picker
      if (audio && typeof audio.webkitShowPlaybackTargetPicker === 'function') {
        ensureTrackLoadedForCast();
        audio.webkitShowPlaybackTargetPicker();
        return;
      }

      setCastFeedback({
        error: isInIframe
          ? 'O navegador bloqueia a descoberta de Chromecast dentro do iframe de preview. Abra diretamente em https://betosradio.com no Chrome ou Safari.'
          : null,
      });
      setIsCastModalOpen(true);
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      const msg = String(err?.message || err || '');
      if (code === 'cancel' || code === 'AbortError' || /cancel|abort/i.test(msg)) {
        return;
      }

      let friendlyError = `Não foi possível abrir o Cast automaticamente (${msg || 'recurso indisponível'}).`;
      if (/no_devices_found|NotFoundError/i.test(`${code} ${msg}`)) {
        friendlyError =
          'Nenhum Chromecast/TV encontrado no mesmo Wi-Fi. Verifique se o celular/PC e a TV estão na mesma rede.';
      } else if (/InvalidStateError|NotSupportedError/i.test(`${code} ${msg}`)) {
        friendlyError =
          'Dê Play em uma música primeiro e toque em Cast novamente, ou use o menu ⋮ → Transmitir do Chrome.';
      } else if (/NotAllowedError|SecurityError/i.test(`${code} ${msg}`) || isInIframe) {
        friendlyError =
          'O navegador bloqueou o Cast nesta janela. Acesse diretamente em https://betosradio.com no Chrome.';
      }

      setCastFeedback({ error: friendlyError });
      setIsCastModalOpen(true);
    }
  };

  // Creator Area handler
  const handleOpenCreatorArea = () => {
    if (isAdmin) {
      setIsAdminPanelOpen(true);
    } else {
      setIsCreatorLoginOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onEnded={handleSongEnded}
        onPlay={() => {
          setIsPlaying(true);
          syncMediaSessionMetadata(currentSongRef.current);
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          if (audioRef.current) {
            const d =
              audioRef.current.duration && Number.isFinite(audioRef.current.duration)
                ? audioRef.current.duration
                : durationRef.current;
            updateMediaSessionPosition(audioRef.current.currentTime || 0, d);
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = currentSongRef.current ? 'paused' : 'none';
          }
        }}
        preload="auto"
        playsInline
        {...({ 'x-webkit-airplay': 'allow' } as Record<string, string>)}
      />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex-1 flex flex-col">
        {/* Top Header Bar (Only Cast and Área do Criador buttons) */}
        <StationHeader
          onOpenCast={handleDirectCast}
          onOpenCreatorArea={handleOpenCreatorArea}
          isCreatorMode={isAdmin}
          isCastActive={isCastActive}
          trackCount={songs.length}
        />

        {/* Top Hero Audio Player */}
        <div className="mb-6">
          <TopPlayer
            currentSong={currentSong}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            isShuffle={isShuffle}
            isRepeat={isRepeat}
            isRadioMode={isRadioMode}
            isCastActive={isCastActive}
            onPlayPause={handlePlayPause}
            onPrev={handlePrev}
            onNext={handleNext}
            onSeek={handleSeek}
            onVolumeChange={(val) => {
              setVolume(val);
              setIsMuted(false);
            }}
            onToggleMute={() => setIsMuted(!isMuted)}
            onToggleShuffle={() => setIsShuffle(!isShuffle)}
            onToggleRepeat={() => setIsRepeat(!isRepeat)}
            onToggleRadioMode={() => setIsRadioMode(!isRadioMode)}
            onOpenCast={handleDirectCast}
            onOpenComposer={handleOpenCreatorArea}
            onOpenBandModal={handleOpenCreatorArea}
            isLiked={currentSong ? likedSongIds.includes(currentSong.id) : false}
            isShared={currentSong ? sharedSongId === currentSong.id : false}
            onToggleLike={() => currentSong && handleToggleLike(currentSong.id)}
            onShare={() => currentSong && handleShareSong(currentSong)}
            audioRef={audioRef}
          />
        </div>

        {/* Lower Split: Synchronized Lyrics Teleprompter & Station Playlist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
          {/* Synchronized Lyrics Teleprompter */}
          <div className="lg:col-span-7 h-full">
            <LyricsDisplay
              lyrics={effectiveLyrics}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              title={currentSong?.title}
              artist={currentSong?.artist}
              hasSong={Boolean(currentSong)}
              songId={currentSong?.id}
              isAdmin={isAdmin}
              onSaveSyncedLyrics={handleSaveSyncedLyrics}
            />
          </div>

          {/* Station Playlist & Media Manager */}
          <div className="lg:col-span-5 h-full">
            <PlaylistDrawer
              songs={songs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              currentTime={currentTime}
              activeDuration={duration}
              likedSongIds={likedSongIds}
              sharedSongId={sharedSongId}
              onSelectSong={handleSelectSong}
              onDeleteSong={handleDeleteSong}
              onEditSong={(song) => {
                setSongToEditInAdmin(song);
                if (isAdmin) {
                  setIsAdminPanelOpen(true);
                } else {
                  setIsCreatorLoginOpen(true);
                }
              }}
              onToggleLike={handleToggleLike}
              onShareSong={handleShareSong}
              onRefreshSongs={() => fetchSongs(true)}
              onOpenSunoDownloader={handleOpenCreatorArea}
              onOpenGeminiComposer={handleOpenCreatorArea}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs font-mono-code text-white/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Rádio AI Studio • Transmissão Automatizada & Inteligência Artificial</span>
          <span className="text-purple-400/80">
            {isAdmin ? '🔒 Modo Criador Ativo' : '🎧 Modo Público (Ouvinte)'} • Gemini 4 Engine
          </span>
        </div>
      </footer>

      {/* Modals */}
      <CastModal
        isOpen={isCastModalOpen}
        onClose={() => {
          setIsCastModalOpen(false);
          setCastFeedback({});
        }}
        audioRef={audioRef}
        currentSong={currentSong}
        isPlaying={isPlaying}
        onCastActiveChange={setIsCastActive}
        externalError={castFeedback.error}
        externalStatus={castFeedback.status}
        onEnsureTrackLoaded={ensureTrackLoadedForCast}
      />

      <CreatorLoginModal
        isOpen={isCreatorLoginOpen}
        onClose={() => setIsCreatorLoginOpen(false)}
        onSuccess={() => {
          setIsAdminPanelOpen(true);
        }}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => {
          setIsAdminPanelOpen(false);
          setSongToEditInAdmin(null);
        }}
        songs={songs}
        onSongAdded={handleSongAdded}
        onSongUpdated={(updated) => {
          setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
        initialEditSong={songToEditInAdmin}
        onClearInitialEdit={() => setSongToEditInAdmin(null)}
        onCatalogReplaced={(updatedSongs) => {
          const shuffled = shuffleSongs(updatedSongs);
          sessionOrderRef.current = shuffled.map((s) => s.id);
          setSongs(shuffled);
          setCurrentSongIndex(null);
          setIsPlaying(false);
        }}
        onRefreshSongs={() => fetchSongs(true)}
        onDeleteSong={handleDeleteSong}
        onSelectSong={handleSelectSong}
        currentSong={currentSong}
      />
    </div>
  );
}
