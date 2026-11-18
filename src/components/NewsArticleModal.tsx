import React from 'react';
import { X, Play, Pause, Calendar, Clock, User, Quote, Music, Disc3, Share2, Sparkles } from 'lucide-react';
import { NewsArticle } from '../types/news';
import { Song } from '../types/song';

interface NewsArticleModalProps {
  article: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onPlaySong: (songId?: string) => void;
  currentSong: Song | null;
  isPlaying: boolean;
}

export const NewsArticleModal: React.FC<NewsArticleModalProps> = ({
  article,
  isOpen,
  onClose,
  onPlaySong,
  currentSong,
  isPlaying,
}) => {
  if (!isOpen || !article) return null;

  const isCurrentPlaying = currentSong?.id === article.songId && isPlaying;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl glass-panel-elevated p-6 md:p-10 border border-white/20 text-white shadow-2xl my-6 max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Article Scroll Area */}
        <div className="overflow-y-auto pr-2 space-y-6">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-code text-white/60">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase">
              {article.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-white/40" />
              {article.publishedAt}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-white/40" />
              {article.readTime}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-white/40" />
              {article.author}
            </span>
          </div>

          {/* Headline & Subtitle */}
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold font-heading text-white tracking-tight leading-tight">
              {article.title}
            </h1>
            <p className="text-base md:text-lg text-white/75 mt-3 font-sans leading-relaxed">
              {article.subtitle}
            </p>
          </div>

          {/* DUAL IMAGE SHOWCASE (Album Cover + Band Photo) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-6">
            {/* Imagem 2: Foto dos Integrantes da Banda (Destaque Principal) */}
            <div className="md:col-span-8 relative rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 group shadow-xl">
              <img
                src={article.bandPhotoUrl || '/capas/sintaxe_silicio_band.jpg'}
                alt={`Integrantes da banda ${article.bandName}`}
                className="w-full h-72 md:h-84 object-cover group-hover:scale-105 transition-transform duration-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-4">
                <p className="text-xs font-mono-code text-white/90 drop-shadow">
                  📷 <span className="font-bold text-amber-300">{article.bandName}</span> — Retrato oficial dos integrantes no estúdio
                </p>
              </div>
            </div>

            {/* Imagem 1: Capa do Álbum e da Música com Play CTA */}
            <div className="md:col-span-4 flex flex-col justify-between p-4 rounded-2xl bg-neutral-950/80 border border-white/15">
              <div className="relative rounded-xl overflow-hidden shadow-lg border border-white/10 group mb-3">
                <img
                  src={article.albumCoverUrl || '/logo.jpg'}
                  alt={`Capa do single ${article.songTitle}`}
                  className="w-full h-44 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.jpg';
                  }}
                />
                <button
                  onClick={() => onPlaySong(article.songId)}
                  className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    {isCurrentPlaying ? (
                      <Pause className="w-6 h-6 fill-black" />
                    ) : (
                      <Play className="w-6 h-6 fill-black translate-x-0.5" />
                    )}
                  </div>
                </button>
              </div>

              <div>
                <span className="text-[10px] font-mono-code uppercase tracking-wider text-amber-300 block mb-0.5">
                  Single Oficial
                </span>
                <h4 className="text-sm font-bold text-white truncate">{article.songTitle}</h4>
                <p className="text-xs text-white/60 font-mono-code truncate">{article.bandName}</p>

                <button
                  onClick={() => onPlaySong(article.songId)}
                  className="w-full mt-3 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono-code font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                >
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isCurrentPlaying ? 'Pausar Reprodução' : 'Ouvir Música Agora'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Lead Paragraph */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border-l-4 border-amber-400 text-base md:text-lg font-medium text-white/90 leading-relaxed font-sans">
            {article.leadParagraph}
          </div>

          {/* Article Body */}
          <div className="space-y-4 text-sm md:text-base text-white/80 font-sans leading-relaxed">
            {article.body.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          {/* Quote Block */}
          {article.quote && (
            <div className="my-6 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-4">
              <Quote className="w-8 h-8 text-amber-400 flex-shrink-0 opacity-80" />
              <div>
                <p className="text-base italic text-amber-100 font-serif leading-relaxed">
                  "{article.quote.text}"
                </p>
                <p className="text-xs font-mono-code text-amber-300/80 mt-2 font-bold uppercase tracking-wider">
                  — {article.quote.speaker}
                </p>
              </div>
            </div>
          )}

          {/* Footer Call to Action */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Logo" className="w-10 h-10 rounded-full border border-amber-400/40" />
              <div>
                <p className="text-xs font-bold text-white font-mono-code">Beto's Radio • Portal de Notícias</p>
                <p className="text-[11px] text-white/50">Música contínua no player do rodapé</p>
              </div>
            </div>

            <button
              onClick={() => onPlaySong(article.songId)}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-black font-bold text-xs font-mono-code flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
            >
              <Disc3 className="w-4 h-4 animate-spin-slow" />
              <span>Ouvir '{article.songTitle}' no Player</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
