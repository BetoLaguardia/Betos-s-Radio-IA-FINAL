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

export default function App() {
  const { isAdmin, getAuthHeaders } = useAdmin();
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
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

  // Audio element reference & current track id tracker for background sync
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const initialDeepLinkHandledRef = useRef<boolean>(false);

  const currentSong = songs[currentSongIndex] || null;
  currentSongIdRef.current = currentSong?.id ?? null;

  // Fetch songs from server (Supabase / Vercel Blob / local JSON)
  const fetchSongs = async (preserveCurrentTrack = false) => {
    try {
      const res = await fetch('/api/songs', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.songs)) {
        const nextSongs = data.songs as Song[];
        setSongs(nextSongs);

        // Support deep-linked shared track (?track=<id>) on initial load
        if (!initialDeepLinkHandledRef.current) {
          initialDeepLinkHandledRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const sharedTrackId = params.get('track');
          if (sharedTrackId) {
            const idx = nextSongs.findIndex((s) => s.id === sharedTrackId);
            if (idx !== -1) {
              setCurrentSongIndex(idx);
              return;
            }
          }
        }

        if (preserveCurrentTrack && currentSongIdRef.current) {
          const preservedIdx = nextSongs.findIndex((s) => s.id === currentSongIdRef.current);
          if (preservedIdx !== -1) {
            setCurrentSongIndex(preservedIdx);
          } else if (nextSongs.length > 0) {
            setCurrentSongIndex(0);
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
    const raw = currentSong?.lyrics;
    const isPlaceholder = !raw || 
      raw.includes('[Áudio Carregado Localmente]') || 
      raw.includes('[Instrumental / Suno AI Track]') ||
      raw.includes('[Áudio Carregado Diretamente]') ||
      raw.trim().length < 20;

    if (isPlaceholder) {
      return generateAutomaticLyrics(currentSong?.title || '', currentSong?.artist || '', currentSong?.stylePrompt || '');
    }
    return raw;
  }, [currentSong]);

  // Handle Audio source and events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentSong?.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.load();
      setDuration(currentSong.duration || 120);
      if (isPlaying) {
        audio.play().catch((err) => console.log('Audio autoplay prevented:', err));
      }
    }
  }, [currentSong?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Audio Event Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && d !== Infinity) {
        setDuration(d);
      } else {
        setDuration(currentSong?.duration || 120);
      }
    }
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && d !== Infinity) {
        setDuration(d);
      }
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

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
    if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * songs.length);
      setCurrentSongIndex(randomIdx);
    } else {
      setCurrentSongIndex((prev) => (prev + 1) % songs.length);
    }
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
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
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

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
      setSongs(updated);
      if (currentSong?.id === id) {
        setCurrentSongIndex(0);
      }
    } catch (err) {
      console.error('Failed to delete song:', err);
    }
  };

  const handleSongAdded = (newSong: Song, playNow: boolean) => {
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
    const shareUrl = `${window.location.origin}/?track=${encodeURIComponent(song.id)}`;
    const shareText = `Ouça "${song.title}" de ${song.artist} na Beto's Radio!`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${song.title} • Beto's Radio`,
          text: shareText,
          url: shareUrl,
        });
        setSharedSongId(song.id);
        setTimeout(() => setSharedSongId((prev) => (prev === song.id ? null : prev)), 2200);
        return;
      }
    } catch (err: any) {
      // If user cancels native share sheet, do not show error
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setSharedSongId(song.id);
      setTimeout(() => setSharedSongId((prev) => (prev === song.id ? null : prev)), 2200);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
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
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="auto"
      />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex-1 flex flex-col">
        {/* Top Header Bar (Only Cast and Área do Criador buttons) */}
        <StationHeader
          onOpenCast={() => setIsCastModalOpen(true)}
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
            onOpenCast={() => setIsCastModalOpen(true)}
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
            />
          </div>

          {/* Station Playlist & Media Manager */}
          <div className="lg:col-span-5 h-full">
            <PlaylistDrawer
              songs={songs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              likedSongIds={likedSongIds}
              sharedSongId={sharedSongId}
              onSelectSong={handleSelectSong}
              onDeleteSong={handleDeleteSong}
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
        onClose={() => setIsCastModalOpen(false)}
        audioRef={audioRef}
        currentTrackTitle={currentSong?.title}
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
        onClose={() => setIsAdminPanelOpen(false)}
        songs={songs}
        onSongAdded={handleSongAdded}
        onSongUpdated={(updated) => {
          setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
        onCatalogReplaced={(updatedSongs) => {
          setSongs(updatedSongs);
          setCurrentSongIndex(0);
        }}
        onRefreshSongs={() => fetchSongs(true)}
        onDeleteSong={handleDeleteSong}
        onSelectSong={handleSelectSong}
        currentSong={currentSong}
      />
    </div>
  );
}
