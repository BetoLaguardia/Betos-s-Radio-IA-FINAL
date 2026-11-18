import React, { useState } from 'react';
import { Newspaper, Play, Pause, ArrowRight, Clock, Calendar, User, Sparkles, Filter, Disc, Flame } from 'lucide-react';
import { NewsArticle } from '../types/news';
import { Song } from '../types/song';

interface NewsPortalProps {
  articles: NewsArticle[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (songId?: string) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onOpenAdminUpload?: () => void;
  isAdmin?: boolean;
}

export const NewsPortal: React.FC<NewsPortalProps> = ({
  articles,
  currentSong,
  isPlaying,
  onPlaySong,
  onOpenArticle,
  onOpenAdminUpload,
  isAdmin,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))];

  const filteredArticles = articles.filter(
    (a) => selectedCategory === 'all' || a.category === selectedCategory
  );

  const featuredArticle = articles.find((a) => a.featured) || articles[0];
  const regularArticles = filteredArticles.filter((a) => a.id !== featuredArticle?.id);

  return (
    <div className="w-full space-y-8 pb-32">
      {/* Portal Section Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold font-heading text-white tracking-wide flex items-center gap-2">
              PORTAL DE NOTÍCIAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">BETO'S RADIO</span>
            </h2>
            <p className="text-xs text-white/50 font-mono-code">
              Cobertura jornalística das bandas, bastidores conceituais e novos lançamentos sonoros
            </p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs font-mono-code">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap uppercase text-[11px] font-bold ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? 'Todas as Matérias' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* 1. HERO COVER STORY (Featured News with Dual Visuals: Band Photo + Album Sleeve) */}
      {featuredArticle && (
        <div className="relative rounded-3xl overflow-hidden glass-panel-elevated border border-amber-500/30 shadow-2xl group">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Left: Imagem 2 (Foto dos Integrantes da Banda em destaque amplo) */}
            <div className="lg:col-span-7 relative min-h-[300px] lg:min-h-[460px] overflow-hidden bg-neutral-900">
              <img
                src={featuredArticle.bandPhotoUrl || '/capas/sintaxe_silicio_band.jpg'}
                alt={featuredArticle.bandName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#0c0d14]" />

              {/* Tag overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono-code font-bold bg-amber-500 text-black uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-current" /> MATÉRIA DE CAPA
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold bg-black/70 backdrop-blur-md text-amber-300 border border-white/10">
                  {featuredArticle.category}
                </span>
              </div>

              {/* Floating Imagem 1: Capa do Álbum / Single */}
              <div className="absolute bottom-4 left-4 flex items-center gap-3 p-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 shadow-2xl">
                <img
                  src={featuredArticle.albumCoverUrl || '/logo.jpg'}
                  alt={featuredArticle.songTitle}
                  className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/20"
                />
                <div>
                  <span className="text-[10px] font-mono-code uppercase text-amber-300 block font-bold">
                    Capa do Single
                  </span>
                  <p className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[190px]">
                    {featuredArticle.songTitle}
                  </p>
                  <p className="text-[11px] text-white/50 truncate font-mono-code">
                    {featuredArticle.bandName}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Editorial News Content */}
            <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between space-y-4 bg-[#0c0d14]/90">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono-code text-white/50">
                  <span>{featuredArticle.publishedAt}</span>
                  <span>•</span>
                  <span>{featuredArticle.readTime}</span>
                </div>

                <h3
                  onClick={() => onOpenArticle(featuredArticle)}
                  className="text-xl md:text-3xl font-extrabold font-heading text-white hover:text-amber-300 transition-colors cursor-pointer leading-tight tracking-tight"
                >
                  {featuredArticle.title}
                </h3>

                <p className="text-xs md:text-sm text-white/70 font-sans leading-relaxed line-clamp-3">
                  {featuredArticle.leadParagraph}
                </p>

                {featuredArticle.quote && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border-l-2 border-amber-400 text-xs italic text-amber-200">
                    "{featuredArticle.quote.text}"
                    <span className="block not-italic text-[10px] font-mono-code text-amber-400/80 mt-1 font-bold">
                      — {featuredArticle.quote.speaker}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onPlaySong(featuredArticle.songId)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs font-mono-code flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25"
                >
                  {currentSong?.id === featuredArticle.songId && isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-black" />
                      <span>Pausar Música</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-black translate-x-0.5" />
                      <span>Tocar '{featuredArticle.songTitle}'</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onOpenArticle(featuredArticle)}
                  className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs font-mono-code flex items-center gap-1.5 transition-colors border border-white/10"
                >
                  <span>Ler Matéria</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. GRID OF RECENT ARTICLES (Each card with Band Photo + Album Cover) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
            <span>ÚLTIMAS REPORTAGENS & LANÇAMENTOS</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </h3>
          <span className="text-xs font-mono-code text-white/40">
            {filteredArticles.length} matérias disponíveis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => {
            const isPlayingThis = currentSong?.id === article.songId && isPlaying;
            return (
              <div
                key={article.id}
                className="group flex flex-col justify-between rounded-2xl glass-panel border border-white/10 hover:border-amber-400/40 overflow-hidden transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-amber-500/10"
              >
                <div>
                  {/* Top: Imagem 2 (Foto dos Integrantes da Banda) + Badge da Imagem 1 (Capa do Álbum) */}
                  <div className="relative h-48 w-full overflow-hidden bg-neutral-900">
                    <img
                      src={article.bandPhotoUrl || '/capas/sintaxe_silicio_band.jpg'}
                      alt={`Banda ${article.bandName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Category pill */}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-mono-code font-bold uppercase tracking-wider bg-black/70 backdrop-blur-md text-amber-300 border border-white/10">
                      {article.category}
                    </span>

                    {/* Imagem 1: Album Cover Floating Disk Badge */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 p-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 shadow-xl">
                      <img
                        src={article.albumCoverUrl || '/logo.jpg'}
                        alt={article.songTitle}
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.jpg';
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaySong(article.songId);
                        }}
                        className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow-md transition-transform hover:scale-110"
                        title="Tocar música no player"
                      >
                        {isPlayingThis ? (
                          <Pause className="w-4 h-4 fill-black" />
                        ) : (
                          <Play className="w-4 h-4 fill-black translate-x-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <p className="text-xs font-bold text-white font-mono-code drop-shadow">
                        {article.bandName}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono-code text-white/40">
                      <span>{article.publishedAt}</span>
                      <span>•</span>
                      <span>{article.readTime}</span>
                    </div>

                    <h4
                      onClick={() => onOpenArticle(article)}
                      className="text-base font-bold font-heading text-white group-hover:text-amber-300 transition-colors cursor-pointer leading-snug line-clamp-2"
                    >
                      {article.title}
                    </h4>

                    <p className="text-xs text-white/60 font-sans leading-relaxed line-clamp-3">
                      {article.leadParagraph}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 pb-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-mono-code text-amber-300/80 truncate max-w-[150px]">
                    Faixa: {article.songTitle}
                  </span>

                  <button
                    onClick={() => onOpenArticle(article)}
                    className="text-xs font-mono-code text-white/70 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Ler Mais</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
