import React, { useState } from 'react';
import { Users, Copy, Check, Sparkles, Camera, Palette, RefreshCw, Shirt, UserCheck } from 'lucide-react';
import { BandInfo } from '../types/song';
import { useAdmin } from '../context/AdminContext';

interface NanoBananaBandModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBand?: BandInfo;
  onUpdateBandPrompt?: (prompt: string, band: BandInfo) => void;
}

export const NanoBananaBandModal: React.FC<NanoBananaBandModalProps> = ({
  isOpen,
  onClose,
  initialBand,
  onUpdateBandPrompt,
}) => {
  const { getAuthHeaders } = useAdmin();
  const [bandName, setBandName] = useState(initialBand?.bandName || 'Sintaxe & Silício');
  const [bandGenre, setBandGenre] = useState('Baroque Math-Pop & Neo-Soul');
  const [bandTheme, setBandTheme] = useState(initialBand?.concept || 'Romance intelectual, física quântica e acústica de câmara');
  const [aestheticStyle, setAestheticStyle] = useState('Chiaroscuro 1970s Kodachrome Film, Minimalist Wool Coats & Leica M11');
  const [memberCount, setMemberCount] = useState('4');

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMemberIdx, setCopiedMemberIdx] = useState<number | null>(null);

  const [activeBand, setActiveBand] = useState<any>(
    initialBand || {
      bandName: 'Sintaxe & Silício',
      bio: 'Quarteto conceitual que une métrica poética neoconcretista, equações físicas e acústica analógica.',
      nanoBananaMainPrompt:
        "Editorial portrait of a 4-piece avant-garde chamber indie band 'Sintaxe & Silício', members dressed in tailored minimalist 1970s intellectual wool coats and vintage turtlenecks, holding a cello, vintage telecaster, and antique analog synthesizers, warm Kodachrome 64 film aesthetic, cinematic chiaroscuro library background, high depth of field, detailed faces, photorealistic 8k --ar 16:9",
      members: [
        {
          name: 'Helena Vane',
          instrument: 'Voz principal & Mellotron',
          personality: 'Introspectiva, lírica e misteriosa',
          lookDescription: 'Óculos de acetato redondos, cabelo curto despenteado, blazer oversized grafite.',
          nanoBananaSoloPrompt: 'Cinematic portrait of Helena Vane, female indie singer, round tortoiseshell glasses, oversized dark blazer, contemplative expression, Kodak Portra 400 film grain --ar 1:1',
        },
        {
          name: 'Arthur Mendes',
          instrument: 'Guitarras poli-rítmicas',
          personality: 'Metódico, fascinado por afinações alternativas',
          lookDescription: 'Camisa de linho marfim, Fender Telecaster 1972 com marcas de uso.',
          nanoBananaSoloPrompt: 'Moody portrait of Arthur Mendes, indie guitarist holding a 1972 vintage blonde Telecaster, ivory linen shirt, warm analog stage light --ar 1:1',
        },
        {
          name: 'Dara Lin',
          instrument: 'Violoncelo acústico e processado',
          personality: 'Perfeccionista e vanguardista',
          lookDescription: 'Traços orientais marcantes, sobretudo mostarda, postura clássica impecável.',
          nanoBananaSoloPrompt: 'Artistic portrait of Dara Lin, cello player with mustard wool coat, dramatic sidelight, bow in hand, deep thoughtful gaze, Hasselblad medium format --ar 1:1',
        },
        {
          name: 'Gael Nogueira',
          instrument: 'Bateria orgânica & Moog modular',
          personality: 'Experimental e pulsante',
          lookDescription: 'Camiseta preta de gola alta, relógio analógico, anéis de prata fosca.',
          nanoBananaSoloPrompt: 'Portrait of Gael Nogueira, modular synthesizer and drummer, black turtleneck, dim studio neon glow, retrofuturistic synthesizer cables --ar 1:1',
        },
      ],
    }
  );

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMember = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMemberIdx(idx);
    setTimeout(() => setCopiedMemberIdx(null), 2000);
  };

  const handleGenerateBand = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gemini/generate-band', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          bandGenre,
          bandTheme,
          aestheticStyle,
          memberCount,
        }),
      });
      const data = await response.json();
      if (data.band) {
        setActiveBand(data.band);
        setBandName(data.band.bandName);
        if (onUpdateBandPrompt) {
          onUpdateBandPrompt(data.band.nanoBananaMainPrompt, data.band);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl glass-panel-elevated p-6 md:p-8 border border-white/15 text-white shadow-2xl my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-pink-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading tracking-wide">
                Gerador de Integrantes para Nano Banana
              </h2>
              <p className="text-xs text-white/60 font-mono-code">
                Crie personas visuais, figurinos e prompts fotográficos para o Nano Banana / Midjourney
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-2">
          {/* Customizer form */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono-code uppercase text-amber-300 mb-1">
                  Gênero Musical da Banda
                </label>
                <input
                  type="text"
                  value={bandGenre}
                  onChange={(e) => setBandGenre(e.target.value)}
                  placeholder="Ex: Baroque Pop / Math-Rock"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono-code text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase text-amber-300 mb-1">
                  Estilo Fotográfico / Câmera
                </label>
                <input
                  type="text"
                  value={aestheticStyle}
                  onChange={(e) => setAestheticStyle(e.target.value)}
                  placeholder="Ex: Kodachrome 64, Chiaroscuro 1970s, Leica M11"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono-code text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono-code uppercase text-white/60 mb-1">
                Conceito / Alma da Banda
              </label>
              <input
                type="text"
                value={bandTheme}
                onChange={(e) => setBandTheme(e.target.value)}
                placeholder="Ex: Romance inteligente, discussões filosóficas, café e livros"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              onClick={handleGenerateBand}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white font-bold text-xs font-mono-code flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Criando Personas no Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Integrantes e Prompt para Nano Banana</span>
                </>
              )}
            </button>
          </div>

          {/* Main Nano Banana Prompt Box */}
          <div className="p-5 rounded-2xl glass-panel border border-amber-500/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono-code uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Pronto para Nano Banana
                </span>
                <h3 className="text-lg font-bold font-heading text-white mt-1">
                  {activeBand.bandName} — Retrato do Grupo
                </h3>
              </div>
              <button
                onClick={() => handleCopy(activeBand.nanoBananaMainPrompt)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono-code transition-all shadow-md shadow-amber-500/25"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Prompt Nano Banana'}</span>
              </button>
            </div>

            <p className="text-xs text-white/70 mb-3">{activeBand.bio}</p>

            <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono-code text-xs text-amber-200/90 leading-relaxed select-all">
              {activeBand.nanoBananaMainPrompt}
            </div>
          </div>

          {/* Members Showcase */}
          <div>
            <h4 className="text-xs font-mono-code uppercase tracking-wider text-white/60 mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" /> Integrantes da Banda & Prompts Individuais
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeBand.members?.map((member: any, i: number) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-bold text-sm text-white font-mono-code">{member.name}</h5>
                      <span className="text-[11px] text-amber-300 font-mono-code px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/25">
                        {member.role || member.instrument}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-1">{member.visualDescription || member.lookDescription}</p>
                    {member.personality && (
                      <p className="text-[11px] text-white/50 italic mt-1">"{member.personality}"</p>
                    )}
                  </div>

                  {member.nanoBananaSoloPrompt && (
                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono-code text-white/40">Prompt Solo</span>
                      <button
                        onClick={() => handleCopyMember(member.nanoBananaSoloPrompt, i)}
                        className="text-[11px] font-mono-code text-amber-300 hover:text-amber-200 flex items-center gap-1"
                      >
                        {copiedMemberIdx === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copiar Solo</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
