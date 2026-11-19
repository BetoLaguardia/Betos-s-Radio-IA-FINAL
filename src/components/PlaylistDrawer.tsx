import React, { useState } from 'react';
import { Music, Play, Trash2, Clock, Sparkles, Filter, Search, Check, Disc, ExternalLink, Heart, Share2, RefreshCw, Edit3, Headphones } from 'lucide-react';
import { Song } from '../types/song';
import { useAdmin } from '../context/AdminContext';

interface PlaylistDrawerProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime?: number;
  activeDuration?: number;
  likedSongIds?: string[];
  sharedSongId?: string | null;
  onSelectSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
  onEditSong?: (song: Song) => void;
  onToggleLike?: (id: string) => void;
  onShareSong?: (song: Song) => void;
  onRefreshSongs?: () => Promise<void> | void;
  onOpenSunoDownloader: () => void;
  onOpenGeminiComposer: () => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  songs,
  currentSong,
  isPlaying,
  currentTime = 0,
  activeDuration = 0,
  likedSongIds = [],
  sharedSongId = null,
  onSelectSong,
  onDeleteSong,
  onEditSong,
  onToggleLike,
  onShareSong,
  onRefreshSongs,
  onOpenSunoDownloader,
  onOpenGeminiComposer,
}) => {
  const { isAdmin } = useAdmin();
  const [search, setSearch] = useState('');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshSongs || refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshSongs();
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  };

  const moods = Array.from(new Set(songs.map((s) => s.mood).filter(Boolean)));

  const filteredSongs = songs.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase()) ||
      (s.stylePrompt && s.stylePrompt.toLowerCase().includes(search.toLowerCase()));

    const matchesMood = filterMood === 'all' || s.mood === filterMood;
    return matchesSearch && matchesMood;
  });

  const formatDuration = (sec?: number) => {
    if (!sec || isNaN(sec) || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl glass-panel border border-white/10 p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Disc className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm font-heading tracking-wide text-white">
            Programação Beto's Radio • {songs.length} Faixas
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshSongs && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Atualizar lista com o banco de dados"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-amber-300 border border-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          )}

          {/* Admin additions (Hidden for regular listeners) */}
          {isAdmin && (
            <>
              <button
                onClick={onOpenSunoDownloader}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 transition-all"
              >
                + Link Suno
              </button>
              <button
                onClick={onOpenGeminiComposer}
                className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-mono-code border border-purple-500/30 transition-all"
              >
                + Letra Gemini
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Mood Filter */}
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por título, banda ou estilo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 font-mono-code focus:outline-none focus:border-amber-400"
          />
        </div>

        {moods.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFilterMood('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-code whitespace-nowrap transition-colors ${
                filterMood === 'all'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              Todos ({songs.length})
            </button>
            {moods.map((m) => (
              <button
                key={m}
                onClick={() => setFilterMood(m)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-code whitespace-nowrap transition-colors ${
                  filterMood === m
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[480px]">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-xs font-mono-code">
            Nenhuma música encontrada neste filtro.
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isCurrent
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-900/20'
                    : 'bg-white/5 hover:bg-white/10 border-white/5'
                }`}
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 border border-white/10">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        isCurrent && isPlaying ? 'scale-105' : 'group-hover:scale-105'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.jpg';
                      }}
                    />
                    <div
                      className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                        isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <div className="flex items-end gap-0.5 h-4">
                          <span className="w-1 bg-amber-400 animate-pulse h-4 rounded-full" />
                          <span className="w-1 bg-purple-400 animate-pulse h-2 rounded-full delay-75" />
                          <span className="w-1 bg-cyan-400 animate-pulse h-3 rounded-full delay-150" />
                        </div>
                      ) : (
                        <Play className="w-4 h-4 text-white fill-white" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs font-bold truncate transition-colors ${
                        isCurrent ? 'text-amber-300' : 'text-white/90 group-hover:text-white'
                      }`}
                    >
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-white/50 truncate font-mono-code">{song.artist}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-amber-300/80 font-mono-code truncate max-w-[150px]">
                        {song.mood || 'Inteligente'}
                      </span>
                      {song.sunoId && (
                        <span className="text-[9px] px-1 rounded bg-cyan-500/10 text-cyan-400 font-mono-code border border-cyan-500/20">
                          SUNO
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    title={`${song.plays || 0} reproduções`}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-mono-code text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/15 tabular-nums"
                  >
                    <Headphones className="w-3 h-3 text-cyan-400" />
                    <span>{(song.plays || 0).toLocaleString('pt-BR')}</span>
                  </span>

                  {onToggleLike && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(song.id);
                      }}
                      title={likedSongIds.includes(song.id) ? 'Remover curtida' : 'Curtir música'}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono-code transition-all active:scale-95 ${
                        likedSongIds.includes(song.id)
                          ? 'text-pink-300 bg-pink-500/15 border border-pink-500/30'
                          : 'text-white/45 hover:text-pink-300 hover:bg-white/5'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          likedSongIds.includes(song.id) ? 'fill-pink-400 text-pink-400' : ''
                        }`}
                      />
                      <span>{song.likes || 0}</span>
                    </button>
                  )}

                  {onShareSong && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareSong(song);
                      }}
                      title="Compartilhar link da música"
                      className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                        sharedSongId === song.id
                          ? 'text-emerald-300 bg-emerald-500/15'
                          : 'text-white/45 hover:text-purple-300 hover:bg-white/5'
                      }`}
                    >
                      {sharedSongId === song.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {(() => {
                    const effectiveDur = isCurrent && activeDuration > 0 ? activeDuration : song.duration || 0;
                    const showCountdown = isCurrent && effectiveDur > 0 && (isPlaying || currentTime > 0);
                    return (
                      <span
                        title={showCountdown ? 'Contagem regressiva' : 'Duração da música'}
                        className={`text-[11px] font-mono-code ml-1 tabular-nums ${
                          showCountdown ? 'text-amber-300 font-semibold' : 'text-white/40'
                        }`}
                      >
                        {showCountdown
                          ? `-${formatDuration(Math.max(0, effectiveDur - currentTime))}`
                          : formatDuration(effectiveDur)}
                      </span>
                    );
                  })()}

                  {/* Admin Edit & Delete icons ONLY for admin */}
                  {isAdmin && (
                    <>
                      {onEditSong && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSong(song);
                          }}
                          title="Editar dados da música (Admin)"
                          className="p-1.5 rounded-lg opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-cyan-300/80 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSong(song.id);
                        }}
                        title="Remover da rádio (Admin)"
                        className="p-1.5 rounded-lg opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-white/5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
