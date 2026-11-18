import React, { useState } from 'react';
import { Sparkles, Copy, Check, Music, Heart, Disc3, Users, RefreshCw, Layers, ArrowUpRight, BookOpen, Send, Download } from 'lucide-react';
import { GeneratedComposition, Song } from '../types/song';
import { useAdmin } from '../context/AdminContext';

interface GeminiComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToPlayer?: (song: Song) => void;
}

const THEME_PRESETS = [
  { label: 'Romance Quântico & Entropia', desc: 'Conexão afetiva explicada por termodinâmica e emaranhamento quântico' },
  { label: 'Arquitetura Brutalista & Desejo', desc: 'Geometrias de concreto cru como espelho de paixões contemporâneas' },
  { label: 'O Paradoxo do Livre-Arbítrio a Dois', desc: 'Determinismo de Laplace vs a rebeldia da escolha de amar' },
  { label: 'Neuroquímica da Saudade', desc: 'Dopamina, sinapses e memórias afetivas em madrugadas de insônia' },
  { label: 'Semiótica e Romances Não-Ditos', desc: 'O que as palavras de Roland Barthes e Wittgenstein não conseguem traduzir' },
  { label: 'Cosmologia Existencial & Café Noturno', desc: 'A vastidão fria das galáxias contrastada com o calor de um olhar' },
];

const MOOD_FILTERS = [
  'Contemplativo & Melancólico',
  'Romântico Intelectual & Sensual',
  'Sarcástico, Irônico & Lúcido',
  'Eufórico & Transcendente',
  'Onírico & Surrealista',
  'Tenso & Cinematográfico',
];

const RHYTHM_FILTERS = [
  'Lento & Íntimo (65-80 BPM)',
  'Andante Rítmico (90-105 BPM)',
  'Dançante Sofisticado (115-125 BPM)',
  'Frenético & Polirrítmico (130-145 BPM - 7/8)',
  'Rubato & Dinâmica Livre',
];

export const GeminiComposerModal: React.FC<GeminiComposerModalProps> = ({
  isOpen,
  onClose,
  onSendToPlayer,
}) => {
  const { getAuthHeaders } = useAdmin();
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[0].label);
  const [customTheme, setCustomTheme] = useState('');
  const [selectedMood, setSelectedMood] = useState(MOOD_FILTERS[0]);
  const [selectedRhythm, setSelectedRhythm] = useState(RHYTHM_FILTERS[1]);
  const [romanticFocus, setRomanticFocus] = useState(true);
  const [customDirectives, setCustomDirectives] = useState('');

  const [loading, setLoading] = useState(false);
  const [composition, setComposition] = useState<GeneratedComposition | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Copy states
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExportLyrics = () => {
    if (!composition) return;
    const blob = new Blob([composition.lyrics], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${composition.title.replace(/[^a-zA-Z0-9]/g, '_')}_letra.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const activeTheme = customTheme.trim() ? customTheme.trim() : selectedTheme;

    try {
      const response = await fetch('/api/gemini/generate-suno', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          theme: activeTheme,
          mood: selectedMood,
          rhythm: selectedRhythm,
          romanticFocus,
          complexityLevel: 'Máximo / Poesia e Harmonia Avançada',
          customDirectives: customDirectives.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar composição via Gemini.');
      }

      setComposition(data.composition);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar ao Gemini AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToRadioDraft = async () => {
    if (!composition) return;
    const songEntry: Song = {
      id: `ai-gen-${Date.now()}`,
      title: composition.title,
      artist: composition.bandInfo?.bandName || 'Sintaxe & Silício',
      album: 'Composições Inteligentes Gemini',
      audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      stylePrompt: composition.stylePrompt,
      mood: composition.mood,
      rhythm: composition.rhythm,
      duration: 160,
      lyrics: composition.lyrics,
      nanoBananaPrompt: composition.nanoBananaPrompt,
      bandInfo: composition.bandInfo,
    };

    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(songEntry),
      });
      const data = await res.json();
      const finalSong = data.song || songEntry;
      if (onSendToPlayer) {
        onSendToPlayer(finalSong);
      }
    } catch (err) {
      if (onSendToPlayer) {
        onSendToPlayer(songEntry);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl glass-panel-elevated p-6 md:p-8 border border-white/15 text-white shadow-2xl my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading tracking-wide">
                Estúdio de Composição AI • Gemini 4
              </h2>
              <p className="text-xs text-white/60 font-mono-code">
                Letras sofisticadas, arranjos instrumentais para o Suno e prompts para o Nano Banana
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-2">
          {/* Controls Section */}
          <div className="space-y-4 bg-white/[0.02] p-5 rounded-2xl border border-white/5">
            {/* Romantic Focus Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-pink-950/30 to-purple-950/30 border border-pink-500/30">
              <div className="flex items-center gap-2.5">
                <Heart className="w-5 h-5 text-pink-400 fill-pink-400/30" />
                <div>
                  <h4 className="text-sm font-semibold text-pink-200">
                    Foco em Romance Inteligente (Profundidade Afetiva)
                  </h4>
                  <p className="text-xs text-white/60">
                    Afeto maduro, densidade lírica, diálogos lúcidos e metáforas sobre conexões humanas complexas
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={romanticFocus}
                onChange={(e) => setRomanticFocus(e.target.checked)}
                className="w-5 h-5 accent-pink-500 cursor-pointer"
              />
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs font-mono-code uppercase tracking-wider text-purple-300 font-semibold mb-2">
                1. Escolha um Tema Complexo & Filosófico
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {THEME_PRESETS.map((preset, i) => {
                  const isSelected = selectedTheme === preset.label && !customTheme;
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedTheme(preset.label);
                        setCustomTheme('');
                      }}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'bg-purple-900/40 border-purple-400 text-white shadow-sm shadow-purple-500/20'
                          : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold font-mono-code">{preset.label}</p>
                      <p className="text-[11px] text-white/50 truncate">{preset.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Custom theme input */}
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Ou digite seu próprio tema complexo / ideia de romance..."
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs font-mono-code focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Filter: Humor / Mood */}
            <div>
              <label className="block text-xs font-mono-code uppercase tracking-wider text-cyan-300 font-semibold mb-2">
                2. Filtro de Humor / Clima Emocional
              </label>
              <div className="flex flex-wrap gap-2">
                {MOOD_FILTERS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setSelectedMood(mood)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-all border ${
                      selectedMood === mood
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter: Rhythm / Tempo */}
            <div>
              <label className="block text-xs font-mono-code uppercase tracking-wider text-amber-300 font-semibold mb-2">
                3. Filtro de Ritmo / Andamento Instrumental
              </label>
              <div className="flex flex-wrap gap-2">
                {RHYTHM_FILTERS.map((rhythm) => (
                  <button
                    key={rhythm}
                    type="button"
                    onClick={() => setSelectedRhythm(rhythm)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-all border ${
                      selectedRhythm === rhythm
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-sm'
                        : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {rhythm}
                  </button>
                ))}
              </div>
            </div>

            {/* Directives */}
            <div>
              <label className="block text-xs font-mono-code uppercase text-white/60 mb-1">
                Diretivas Adicionais para o Suno (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Incluir solo de saxofone com delay, voz feminina e masculina em contraponto..."
                value={customDirectives}
                onChange={(e) => setCustomDirectives(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold text-sm tracking-wide font-mono-code flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-purple-600/25 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Conectando ao Gemini... Escrevendo Poesia e Arranjos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Gerar Composição Completa (Letra, Estilo Suno & Integrantes Banda)</span>
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 font-mono-code">
              {error}
            </div>
          )}

          {/* Generated Result Display */}
          {composition && (
            <div className="space-y-6 pt-2 animate-fade-in">
              {/* Song Title & Synopsis Header */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900/30 to-black/60 border border-purple-500/30">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-mono-code font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {composition.mood} • {composition.rhythm}
                  </span>
                  <button
                    onClick={() => handleCopy(composition.title, 'title')}
                    className="flex items-center gap-1 text-xs font-mono-code text-white/70 hover:text-white"
                  >
                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Título</span>
                  </button>
                </div>
                <h3 className="text-2xl font-bold font-heading text-white">{composition.title}</h3>
                <p className="text-xs text-white/70 mt-2 font-mono-code leading-relaxed">
                  💡 <span className="font-semibold text-white/90">Conceito:</span> {composition.synopsis}
                </p>
              </div>

              {/* Suno Style Prompt Box */}
              <div className="p-4 rounded-xl glass-panel border border-cyan-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-mono-code uppercase font-bold text-cyan-300">
                      Prompt de Estilo para o Suno (Style of Music)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopy(composition.stylePrompt, 'style')}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 transition-colors"
                  >
                    {copiedField === 'style' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'style' ? 'Copiado!' : 'Copiar para o Suno'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-black/40 font-mono-code text-xs text-cyan-100/90 leading-relaxed border border-white/5 select-all">
                  {composition.stylePrompt}
                </div>
              </div>

              {/* Suno Lyrics Box */}
              <div className="p-4 rounded-xl glass-panel border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-mono-code uppercase font-bold text-purple-300">
                      Letra Completa com Estruturas Suno [Tags]
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportLyrics}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 transition-colors"
                      title="Baixar letra em arquivo .txt"
                    >
                      <Download className="w-3.5 h-3.5" /> Exportar Letra (.txt)
                    </button>
                    <button
                      onClick={() => handleCopy(composition.lyrics, 'lyrics')}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-mono-code border border-purple-500/30 transition-colors"
                    >
                      {copiedField === 'lyrics' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'lyrics' ? 'Copiado!' : 'Copiar Letra'}</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 rounded-lg bg-black/50 font-sans text-xs text-white/90 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto border border-white/5">
                  {composition.lyrics}
                </pre>
              </div>

              {/* Nano Banana Prompt Box */}
              <div className="p-4 rounded-xl glass-panel border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-mono-code uppercase font-bold text-amber-300">
                      Prompt para o Nano Banana (Integrantes da Banda)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopy(composition.nanoBananaPrompt, 'banana')}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono-code border border-amber-500/30 transition-colors"
                  >
                    {copiedField === 'banana' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'banana' ? 'Copiado!' : 'Copiar Prompt Nano Banana'}</span>
                  </button>
                </div>
                <p className="text-xs text-white/60 mb-2">
                  Banda: <span className="font-bold text-white">{composition.bandInfo?.bandName}</span> — {composition.bandInfo?.concept}
                </p>
                <div className="p-3 rounded-lg bg-black/40 font-mono-code text-xs text-amber-100/90 leading-relaxed border border-white/5 select-all">
                  {composition.nanoBananaPrompt}
                </div>

                {/* Individual Members breakdown */}
                {composition.bandInfo?.members && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    {composition.bandInfo.members.map((member, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-white/5 text-xs">
                        <p className="font-bold text-white font-mono-code">
                          {member.name} <span className="text-amber-400 font-normal">({member.role})</span>
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">{member.visualDescription}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action: Send to radio queue */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveToRadioDraft}
                  className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono-code flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Carregar Letra & Composição no Player da Rádio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
