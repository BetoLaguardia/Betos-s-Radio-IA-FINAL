import React, { useState } from 'react';
import { Download, Upload, Link2, Music2, Image as ImageIcon, Sparkles, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Song } from '../types/song';
import { useAdmin } from '../context/AdminContext';
import { uploadSongViaVercelBlob } from '../utils/blobClientUpload';

interface SunoDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongAdded: (song: Song, playNow: boolean) => void;
}

export const SunoDownloaderModal: React.FC<SunoDownloaderModalProps> = ({
  isOpen,
  onClose,
  onSongAdded,
}) => {
  const { getAuthHeaders } = useAdmin();
  const [activeTab, setActiveTab] = useState<'link' | 'file'>('link');

  // Link state
  const [sunoUrl, setSunoUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [customMood, setCustomMood] = useState('Contemplativo & Melancólico');
  const [customRhythm, setCustomRhythm] = useState('Andante (96 BPM)');

  // File upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [bandPhotoFile, setBandPhotoFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileArtist, setFileArtist] = useState('');
  const [fileAlbum, setFileAlbum] = useState('');
  const [fileLyrics, setFileLyrics] = useState('');
  const [fileStyle, setFileStyle] = useState('');
  const [fileNanoBananaPrompt, setFileNanoBananaPrompt] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ song: Song; message: string } | null>(null);

  if (!isOpen) return null;

  const sampleSunoLinks = [
    {
      label: 'Exemplo Suno UUID',
      url: 'https://suno.com/song/b8c0d12a-3e4f-4a11-9c88-7e4d8a1b2c3d',
      title: 'Noites de Silício & Café Frio',
      style: 'Post-Rock / Poly-Rhythm Math Pop, intricate acoustic textures, 104 BPM',
      mood: 'Contemplativo & Melancólico',
    },
    {
      label: 'Exemplo Áudio Direto',
      url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3',
      title: 'Geometrias Afetivas em L-Cinza',
      style: 'Baroque Pop & Neo-Soul, Rhodes chords, velvet vocal phrasing, 90 BPM',
      mood: 'Romântico Intelectual',
    },
  ];

  const handleApplySample = (sample: typeof sampleSunoLinks[0]) => {
    setSunoUrl(sample.url);
    setCustomTitle(sample.title);
    setCustomStyle(sample.style);
    setCustomMood(sample.mood);
  };

  const handleDownloadFromLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sunoUrl.trim()) {
      setError('Por favor, informe o link da música do Suno ou URL do áudio.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const response = await fetch('/api/suno/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          url: sunoUrl.trim(),
          customTitle: customTitle.trim() || undefined,
          customLyrics: customLyrics.trim() || undefined,
          customStyle: customStyle.trim() || undefined,
          mood: customMood,
          rhythm: customRhythm,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar o download do Suno.');
      }

      setSuccessResult({
        song: data.song,
        message: data.message || 'Música e capa baixadas com sucesso!',
      });
      onSongAdded(data.song, false);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao baixar.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      setError('Selecione um arquivo de áudio (MP3 ou WAV).');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError(null);
    setSuccessResult(null);

    try {
      const { song, viaBlob, viaSupabase } = await uploadSongViaVercelBlob({
        audioFile,
        coverFile,
        bandPhotoFile,
        title: fileTitle,
        artist: fileArtist || 'Artista Suno',
        album: fileAlbum || 'Suno & Estúdio Original',
        stylePrompt: fileStyle || 'Art-Rock Contemporâneo / Harmonia Elaborada',
        lyrics: fileLyrics || '[Áudio Carregado Diretamente]',
        mood: customMood,
        rhythm: customRhythm,
        nanoBananaPrompt: fileNanoBananaPrompt,
        authHeaders: getAuthHeaders(),
        onProgress: ({ percentage }) => setUploadProgress(percentage),
      });

      setSuccessResult({
        song,
        message: viaSupabase
          ? 'Arquivo de áudio, capa e metadados salvos diretamente no Supabase!'
          : viaBlob
          ? 'Arquivo de áudio e capa salvos com acesso público no Vercel Blob!'
          : 'Arquivo de áudio, capa e metadados enviados com sucesso para o servidor!',
      });
      onSongAdded(song, false);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl glass-panel-elevated p-6 md:p-8 border border-white/15 text-white shadow-2xl my-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading tracking-wide">
                Downloader Suno & Importador de Mídia
              </h2>
              <p className="text-xs text-white/60 font-mono-code">
                Baixe o MP3 e a Capa do Suno para os diretórios locais da Rádio
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

        {/* Tab switcher */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => {
              setActiveTab('link');
              setError(null);
            }}
            className={`pb-3 px-4 text-xs font-mono-code font-bold tracking-wider uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'link'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Link2 className="w-4 h-4" /> Link do Suno (URL)
          </button>
          <button
            onClick={() => {
              setActiveTab('file');
              setError(null);
            }}
            className={`pb-3 px-4 text-xs font-mono-code font-bold tracking-wider uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'file'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload de Arquivo MP3/Capa
          </button>
        </div>

        {/* Success Banner */}
        {successResult && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-4">
            <img
              src={successResult.song.coverUrl}
              alt={successResult.song.title}
              className="w-14 h-14 rounded-lg object-cover shadow-md border border-white/10"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-mono-code font-semibold">
                <Check className="w-4 h-4" /> {successResult.message}
              </div>
              <p className="text-sm font-bold text-white truncate">{successResult.song.title}</p>
              <p className="text-xs text-white/60 truncate">
                Salvo em: <span className="font-mono-code text-white/80">{successResult.song.blobPathname || 'Vercel Blob / Catálogo'}</span>
              </p>
            </div>
            <button
              onClick={() => {
                onSongAdded(successResult.song, true);
                onClose();
              }}
              className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono-code flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20"
            >
              Tocar Agora <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300 font-mono-code">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: Link do Suno */}
        {activeTab === 'link' && (
          <form onSubmit={handleDownloadFromLink} className="space-y-4">
            <div>
              <label className="block text-xs font-mono-code uppercase tracking-wider text-cyan-300 mb-1.5 font-semibold">
                Link da Música no Suno ou URL do MP3 *
              </label>
              <div className="relative">
                <input
                  type="url"
                  required
                  placeholder="https://suno.com/song/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={sunoUrl}
                  onChange={(e) => setSunoUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm font-mono-code focus:outline-none focus:border-cyan-400 transition-colors pl-10"
                />
                <Link2 className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-white/50 mt-1 font-mono-code">
                Insira o link da página do Suno (ex: suno.com/song/UUID) ou link direto do CDN (cdn1.suno.ai/UUID.mp3).
              </p>
            </div>

            {/* Quick test buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-mono-code text-white/40">Testar com exemplo:</span>
              {sampleSunoLinks.map((sample, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleApplySample(sample)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono-code text-cyan-300/80 hover:text-cyan-200 border border-white/10 transition-colors"
                >
                  ⚡ {sample.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Título Personalizado (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Deixe em branco para extrair do Suno"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Estilo / Prompt Suno (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Progressive Baroque Pop, 96 BPM"
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                Letra da Música (Opcional - Extraída do Suno se vazia)
              </label>
              <textarea
                rows={3}
                placeholder="Cole a letra ou deixe em branco para importar a descrição do Suno..."
                value={customLyrics}
                onChange={(e) => setCustomLyrics(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs font-mono-code focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm tracking-wide font-mono-code flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Baixando MP3 & Capa para o Servidor...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Baixar MP3 & Capa e Enviar para a Rádio AI</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Upload de Arquivos Locais */}
        {activeTab === 'file' && (
          <form onSubmit={handleUploadFiles} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Audio File */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono-code text-purple-300">Áudio MP3 / WAV *</label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a"
                  required
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                />
              </div>

              {/* Cover File */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono-code text-cyan-300">Capa do Álbum</label>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-black hover:file:bg-cyan-500 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                />
              </div>

              {/* Band Photo File */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono-code text-amber-300">Foto da Banda</label>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setBandPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-black hover:file:bg-amber-500 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Nome da Música
                </label>
                <input
                  type="text"
                  placeholder="Ex: Teorema da Ternura"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Artista / Banda
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cortex & Orquídea"
                  value={fileArtist}
                  onChange={(e) => setFileArtist(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Álbum / Coleção
                </label>
                <input
                  type="text"
                  placeholder="Ex: Suno & Estúdio Original"
                  value={fileAlbum}
                  onChange={(e) => setFileAlbum(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                  Estilo / Prompt Suno
                </label>
                <input
                  type="text"
                  placeholder="Ex: Baroque Pop, 96 BPM"
                  value={fileStyle}
                  onChange={(e) => setFileStyle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono-code uppercase text-white/70">
                  Letra da Música (Digitar ou Importar Arquivo .txt/.lrc)
                </label>
                <label className="cursor-pointer text-[11px] font-mono-code text-cyan-300 hover:underline flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                  <Upload className="w-3 h-3" /> Importar Arquivo .txt / .lrc
                  <input
                    type="file"
                    accept=".txt,.lrc,text/plain"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setFileLyrics(String(evt.target?.result || ''));
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={3}
                placeholder="Cole a letra formatada ou importe um arquivo .txt / .lrc..."
                value={fileLyrics}
                onChange={(e) => setFileLyrics(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs font-mono-code focus:outline-none focus:border-purple-400 resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-code uppercase text-white/70 mb-1">
                Prompt Nano Banana
              </label>
              <input
                type="text"
                placeholder="Ex: Cinematic analog band portrait --ar 16:9"
                value={fileNanoBananaPrompt}
                onChange={(e) => setFileNanoBananaPrompt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !audioFile}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm tracking-wide font-mono-code flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Enviando para Vercel Blob ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Fazer Upload para Vercel Blob e Adicionar à Rádio AI</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
