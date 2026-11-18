import React from 'react';
import { Radio, Cast, Lock, ShieldCheck, FolderCog } from 'lucide-react';

interface StationHeaderProps {
  onOpenCast: () => void;
  onOpenCreatorArea: () => void;
  isCreatorMode: boolean;
  isCastActive: boolean;
  trackCount: number;
}

export const StationHeader: React.FC<StationHeaderProps> = ({
  onOpenCast,
  onOpenCreatorArea,
  isCreatorMode,
  isCastActive,
  trackCount,
}) => {
  return (
    <header className="w-full flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-6 rounded-2xl glass-panel border border-white/10 mb-6">
      {/* Station Branding */}
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-neutral-900"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold font-heading text-white tracking-wider">
              BETO'S <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">RADIO</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              104.2 FM
            </span>
            {isCreatorMode && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> MODO CRIADOR ATIVO
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 font-mono-code">
            {isCreatorMode
              ? 'Área do Criador Desbloqueada • Suno, Gemini & Nano Banana disponíveis no Painel'
              : 'Transmissão Pública • Player Hi-Fi, Teleprompter & Cast'}
          </p>
        </div>
      </div>

      {/* Main Top Actions (Only Cast & Área do Criador) */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Cast Device Button (Public) */}
        <button
          onClick={onOpenCast}
          title="Transmitir áudio para smart speakers"
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono-code font-bold transition-all border ${
            isCastActive
              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400'
              : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
          }`}
        >
          <Cast className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Cast</span>
        </button>

        {/* Área do Criador Button */}
        <button
          onClick={onOpenCreatorArea}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition-all shadow-md ${
            isCreatorMode
              ? 'bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white shadow-amber-500/25'
              : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40'
          }`}
          title="Acessar Área do Criador com Suno, Gemini e Nano Banana"
        >
          {isCreatorMode ? <FolderCog className="w-4 h-4 text-amber-300" /> : <Lock className="w-3.5 h-3.5 text-purple-400" />}
          <span>{isCreatorMode ? 'Painel do Criador' : 'Área do Criador'}</span>
        </button>
      </div>
    </header>
  );
};
