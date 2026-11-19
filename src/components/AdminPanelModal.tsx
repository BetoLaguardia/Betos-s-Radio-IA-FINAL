import React, { useState } from 'react';
import {
  Download,
  Sparkles,
  Users,
  Music,
  FolderCog,
  LogOut,
  X,
  Check,
  Disc,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Radio,
  FileText,
  Server,
  Layers,
  Upload,
  ArrowRight,
  Edit3,
  Database,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { Song, BandInfo, GeneratedComposition } from '../types/song';
import { SunoDownloaderModal } from './SunoDownloaderModal';
import { GeminiComposerModal } from './GeminiComposerModal';
import { NanoBananaBandModal } from './NanoBananaBandModal';
import { uploadSongViaVercelBlob } from '../utils/blobClientUpload';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  onSongAdded: (song: Song, playNow: boolean) => void;
  onSongUpdated?: (song: Song) => void;
  onCatalogReplaced?: (songs: Song[]) => void;
  onRefreshSongs?: () => Promise<void> | void;
  onDeleteSong: (id: string) => void;
  onSelectSong: (song: Song) => void;
  currentSong: Song | null;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  songs,
  onSongAdded,
  onSongUpdated,
  onCatalogReplaced,
  onRefreshSongs,
  onDeleteSong,
  onSelectSong,
  currentSong,
}) => {
  const { logout, getAuthHeaders } = useAdmin();
  const [activeTab, setActiveTab] = useState<'suno' | 'gemini' | 'banana' | 'catalog' | 'supabase'>('suno');

  // Sub-modal triggers
  const [isSunoSubModal, setIsSunoSubModal] = useState(false);
  const [isGeminiSubModal, setIsGeminiSubModal] = useState(false);
  const [isBananaSubModal, setIsBananaSubModal] = useState(false);

  // Edit song state
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editMood, setEditMood] = useState('Contemplativo & Melancólico');
  const [editRhythm, setEditRhythm] = useState('Andante (96 BPM)');
  const [editStyle, setEditStyle] = useState('');
  const [editLyrics, setEditLyrics] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Direct MP3 upload state inside Admin Panel
  const [directAudioFile, setDirectAudioFile] = useState<File | null>(null);
  const [directCoverFile, setDirectCoverFile] = useState<File | null>(null);
  const [directBandPhotoFile, setDirectBandPhotoFile] = useState<File | null>(null);
  const [directTitle, setDirectTitle] = useState('');
  const [directArtist, setDirectArtist] = useState('');
  const [directAlbum, setDirectAlbum] = useState('');
  const [directStyle, setDirectStyle] = useState('Indie Chamber Pop / Complex Harmonies');
  const [directMood, setDirectMood] = useState('Contemplativo & Melancólico');
  const [directRhythm, setDirectRhythm] = useState('Andante Moderato (100 BPM)');
  const [directLyrics, setDirectLyrics] = useState('');
  const [directNanoBananaPrompt, setDirectNanoBananaPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Supabase import/export state
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);
  const [supabaseWriteConfigured, setSupabaseWriteConfigured] = useState<boolean | null>(null);
  const [supabaseCounts, setSupabaseCounts] = useState<{
    songs: number;
    covers: number;
    bandImages: number;
    lyrics: number;
  } | null>(null);
  const [supabaseSql, setSupabaseSql] = useState<string>('');
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(false);
  const [supabaseMsg, setSupabaseMsg] = useState<string | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [remoteSyncUrl, setRemoteSyncUrl] = useState<string>('https://betosradioai.ai.studio');

  const loadSupabaseInfo = async () => {
    setSupabaseError(null);
    try {
      const headers = getAuthHeaders();
      const [statusRes, sqlRes, healthRes] = await Promise.all([
        fetch('/api/supabase/status', { headers }),
        fetch('/api/supabase/sql', { headers }),
        fetch('/api/health'),
      ]);
      const statusData = await statusRes.json();
      if (statusRes.ok) {
        setSupabaseConfigured(Boolean(statusData.configured));
        setSupabaseCounts(statusData.counts || null);
      } else {
        setSupabaseConfigured(Boolean(statusData.configured));
        setSupabaseError(statusData.error || 'Erro ao verificar Supabase.');
      }
      if (sqlRes.ok) {
        const sqlData = await sqlRes.json();
        setSupabaseSql(sqlData.sql || '');
      }
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setSupabaseWriteConfigured(Boolean(healthData.supabaseWriteConfigured));
      }
    } catch (err: any) {
      setSupabaseError(err?.message || 'Erro ao carregar informações do Supabase.');
    }
  };

  const handleSupabaseImport = async () => {
    setSupabaseLoading(true);
    setSupabaseMsg(null);
    setSupabaseError(null);
    try {
      const res = await fetch('/api/supabase/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao importar dados do Supabase.');
      }
      if (Array.isArray(data.songs) && onCatalogReplaced) {
        onCatalogReplaced(data.songs);
      } else if (onRefreshSongs) {
        await onRefreshSongs();
      }
      if (data.breakdown) {
        setSupabaseCounts(data.breakdown);
      }
      setSupabaseMsg(
        `Importação concluída: ${data.importedCount} nova(s) e ${data.updatedCount} atualizada(s) a partir de ${data.breakdown?.songs ?? 0} músicas, ${data.breakdown?.covers ?? 0} capas, ${data.breakdown?.bandImages ?? 0} imagens de banda e ${data.breakdown?.lyrics ?? 0} letras.`
      );
    } catch (err: any) {
      setSupabaseError(err?.message || 'Erro ao importar do Supabase.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleSupabaseExport = async () => {
    setSupabaseLoading(true);
    setSupabaseMsg(null);
    setSupabaseError(null);
    try {
      const res = await fetch('/api/supabase/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar acervo para o Supabase.');
      }
      if (data.counts) {
        setSupabaseCounts(data.counts);
      }
      if (onRefreshSongs) {
        await onRefreshSongs();
      }
      setSupabaseMsg(`Acervo sincronizado: ${data.exportedCount} faixas gravadas nas tabelas do Supabase.`);
    } catch (err: any) {
      setSupabaseError(err?.message || 'Erro ao enviar acervo para o Supabase.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleMigrateRemote = async () => {
    const targetUrl = remoteSyncUrl.trim();
    if (!targetUrl) {
      setSupabaseError('Informe a URL da rádio de origem.');
      return;
    }
    setSupabaseLoading(true);
    setSupabaseMsg(null);
    setSupabaseError(null);
    try {
      const res = await fetch('/api/supabase/migrate-remote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sourceUrl: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao sincronizar faixas da URL remota.');
      }
      if (data.counts) {
        setSupabaseCounts(data.counts);
      }
      if (onRefreshSongs) {
        await onRefreshSongs();
      }
      setSupabaseMsg(
        `Sincronização concluída: ${data.migratedCount} faixa(s) e capas transferidas de ${targetUrl} para o Supabase Storage e tabelas SQL.`
      );
    } catch (err: any) {
      setSupabaseError(err?.message || 'Erro ao sincronizar catálogo remoto.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleCopySql = async () => {
    if (!supabaseSql) return;
    try {
      await navigator.clipboard.writeText(supabaseSql);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!isOpen) return null;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleDirectUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAudioFile) {
      setUploadError('Selecione um arquivo de áudio MP3, WAV ou M4A.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparando upload...');
    setUploadMsg(null);
    setUploadError(null);

    try {
      const { song, viaBlob, viaSupabase } = await uploadSongViaVercelBlob({
        audioFile: directAudioFile,
        coverFile: directCoverFile,
        bandPhotoFile: directBandPhotoFile,
        title: directTitle,
        artist: directArtist,
        album: directAlbum,
        stylePrompt: directStyle,
        mood: directMood,
        rhythm: directRhythm,
        lyrics: directLyrics,
        nanoBananaPrompt: directNanoBananaPrompt,
        authHeaders: getAuthHeaders(),
        onProgress: ({ stage, percentage }) => {
          setUploadStage(stage);
          setUploadProgress(percentage);
        },
      });

      setUploadMsg(
        viaSupabase
          ? 'Áudio, capa e metadados salvos diretamente no Supabase (Storage + Tabelas SQL)!'
          : viaBlob
          ? 'Áudio salvo com sucesso no Vercel Blob (acesso público) e adicionado à Rádio!'
          : 'Áudio e dados salvos com sucesso no servidor da rádio!'
      );
      onSongAdded(song, true);
      setDirectAudioFile(null);
      setDirectCoverFile(null);
      setDirectBandPhotoFile(null);
      setDirectTitle('');
      setDirectArtist('');
      setDirectAlbum('');
      setDirectLyrics('');
      setDirectNanoBananaPrompt('');
    } catch (err: any) {
      setUploadError(err?.message || 'Erro ao enviar arquivo para o Vercel Blob.');
    } finally {
      setUploading(false);
      setUploadStage(null);
    }
  };

  const handleStartEdit = (song: Song) => {
    setEditingSong(song);
    setEditTitle(song.title);
    setEditArtist(song.artist);
    setEditMood(song.mood || 'Contemplativo & Melancólico');
    setEditRhythm(song.rhythm || 'Andante (96 BPM)');
    setEditStyle(song.stylePrompt || '');
    setEditLyrics(song.lyrics || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;

    setSavingEdit(true);
    try {
      const updatedData = {
        ...editingSong,
        title: editTitle.trim() || editingSong.title,
        artist: editArtist.trim() || editingSong.artist,
        mood: editMood.trim() || 'Contemplativo & Melancólico',
        rhythm: editRhythm.trim() || 'Andante (96 BPM)',
        stylePrompt: editStyle.trim(),
        lyrics: editLyrics.trim(),
      };

      const res = await fetch(`/api/songs/${editingSong.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar música.');
      }

      if (onSongUpdated) {
        onSongUpdated(data.song);
      }
      setEditingSong(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl glass-panel-elevated p-6 md:p-8 border border-white/20 text-white shadow-2xl my-6 max-h-[92vh] flex flex-col">
        {/* Top Header of Admin Panel */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-white/10 gap-4 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <FolderCog className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-heading tracking-wide">
                  Área do Criador • Beto's Radio
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> ACESSO RESTRITO
                </span>
              </div>
              <p className="text-xs text-white/50 font-mono-code">
                Upload direto de MP3, estúdio de composição Gemini, Nano Banana e gestão de acervo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-mono-code border border-red-500/30 transition-all"
              title="Encerrar sessão de criador"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Área</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 py-4 border-b border-white/10 flex-shrink-0 text-xs font-mono-code">
          <button
            onClick={() => setActiveTab('suno')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold ${
              activeTab === 'suno'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>1. Importar MP3 & Link Suno</span>
          </button>

          <button
            onClick={() => setActiveTab('gemini')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold ${
              activeTab === 'gemini'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Estúdio Gemini (Letras & Estilos)</span>
          </button>

          <button
            onClick={() => setActiveTab('banana')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold ${
              activeTab === 'banana'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Nano Banana (Integrantes)</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold ${
              activeTab === 'catalog'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Disc className="w-4 h-4" />
            <span>4. Gestão do Acervo ({songs.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('supabase');
              loadSupabaseInfo();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold ${
              activeTab === 'supabase'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>5. Supabase (Tabelas SQL)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-5 pr-2">
          {/* TAB 1: SUNO DOWNLOADER & DIRECT MP3 UPLOAD */}
          {activeTab === 'suno' && (
            <div className="space-y-6">
              {/* Direct MP3 & Cover Upload Box */}
              <div className="p-6 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-cyan-200 flex items-center gap-2">
                      <Upload className="w-5 h-5 text-cyan-400" /> Importar Arquivo MP3 & Capa Manualmente
                    </h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      Selecione o arquivo de áudio MP3/WAV baixado do Suno e envie a imagem de capa para tocar na rádio imediatamente.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSunoSubModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Usar Link Suno (Capa/Metadados)
                  </button>
                </div>

                {uploadMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono-code flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{uploadMsg}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-mono-code flex items-center gap-2">
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploading && (
                  <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono-code text-cyan-200">
                      <span>{uploadStage || 'Enviando para o Vercel Blob...'}</span>
                      <span className="font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <form onSubmit={handleDirectUploadSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono-code text-cyan-300">Arquivo de Áudio MP3 / WAV / FLAC *</label>
                    <input
                      type="file"
                      accept="audio/*"
                      required
                      onChange={(e) => {
                        setDirectAudioFile(e.target.files?.[0] || null);
                        setUploadError(null);
                      }}
                      className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500 file:text-black hover:file:bg-cyan-400 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                    />
                    <span className="text-[10px] text-white/40 font-mono-code">
                      {directAudioFile
                        ? `${directAudioFile.name} (${(directAudioFile.size / (1024 * 1024)).toFixed(2)} MB) • Upload direto Vercel Blob`
                        : 'Suporta arquivos maiores que 4,5 MB (upload direto Vercel Blob)'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono-code text-purple-300">Imagem de Capa (JPG / PNG)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDirectCoverFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                    />
                    <span className="text-[10px] text-white/40 font-mono-code">Capa exibida no disco de vinil e no player</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono-code text-amber-300">Foto da Banda / Integrantes (Opcional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDirectBandPhotoFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-black hover:file:bg-amber-500 file:cursor-pointer bg-black/40 p-2 rounded-xl border border-white/10"
                    />
                    <span className="text-[10px] text-white/40 font-mono-code">Retrato dos integrantes para o painel de banda</span>
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Título da Música</label>
                    <input
                      type="text"
                      placeholder="Ex: Noites de Silício & Café"
                      value={directTitle}
                      onChange={(e) => setDirectTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Artista / Banda</label>
                    <input
                      type="text"
                      placeholder="Ex: Sintaxe & Silício"
                      value={directArtist}
                      onChange={(e) => setDirectArtist(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Álbum / Coleção</label>
                    <input
                      type="text"
                      placeholder="Ex: Estúdio Original 2026"
                      value={directAlbum}
                      onChange={(e) => setDirectAlbum(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Humor / Clima</label>
                    <input
                      type="text"
                      placeholder="Ex: Contemplativo & Melancólico"
                      value={directMood}
                      onChange={(e) => setDirectMood(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Ritmo / Andamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Andante Moderato (100 BPM)"
                      value={directRhythm}
                      onChange={(e) => setDirectRhythm(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Estilo Musical / Prompt Suno</label>
                    <input
                      type="text"
                      placeholder="Ex: Indie Chamber Pop / Complex Harmonies"
                      value={directStyle}
                      onChange={(e) => setDirectStyle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="md:col-span-2">
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
                                setDirectLyrics(String(evt.target?.result || ''));
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Insira a letra com estruturação ou importe um arquivo .txt / .lrc..."
                      value={directLyrics}
                      onChange={(e) => setDirectLyrics(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono-code text-white/70 mb-1">Prompt para Nano Banana (Capa/Banda)</label>
                    <input
                      type="text"
                      placeholder="Ex: Cinematic analog band portrait --ar 16:9"
                      value={directNanoBananaPrompt}
                      onChange={(e) => setDirectNanoBananaPrompt(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs tracking-wider uppercase font-mono-code flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {uploading ? (
                        <span>{uploadStage || `Enviando (${uploadProgress}%)...`}</span>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Enviar MP3, Capa e Metadados para o Supabase / Rádio</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: GEMINI COMPOSER */}
          {activeTab === 'gemini' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-purple-200">
                    Estúdio de Letras Líricas, Romances Inteligentes & Estilos Suno
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Gere narrativas poéticas com densidade reflexiva e envie diretamente para tocar na rádio com 1 clique.
                  </p>
                </div>
                <button
                  onClick={() => setIsGeminiSubModal(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono-code flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/25"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Abrir Estúdio Gemini</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: NANO BANANA */}
          {activeTab === 'banana' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-200">
                    Gerador de Integrantes para Nano Banana / Midjourney
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Crie personas visuais, figurinos e prompts fotográficos em inglês para gerar imagens de capa e banda.
                  </p>
                </div>
                <button
                  onClick={() => setIsBananaSubModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono-code flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/25"
                >
                  <Users className="w-4 h-4" />
                  <span>Abrir Gerador de Banda</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-heading text-white">
                  Acervo Completo da Rádio ({songs.length} faixas)
                </h3>
              </div>

              <div className="space-y-2">
                {songs.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-purple-950/40 border-purple-500/50'
                          : 'bg-white/5 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{song.title}</h4>
                          <p className="text-[11px] text-white/50 truncate font-mono-code">{song.artist}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-purple-300 font-mono-code">
                            {song.mood || 'Contemplativo'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(song)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 text-xs font-mono-code font-bold border border-cyan-500/40 flex items-center gap-1 transition-all"
                          title="Editar letra e estilo da música"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => onSelectSong(song)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono-code font-bold"
                        >
                          Tocar
                        </button>
                        <button
                          onClick={() => onDeleteSong(song.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Excluir música"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: SUPABASE IMPORT & SQL SCHEMA */}
          {activeTab === 'supabase' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-emerald-950/25 border border-emerald-500/35 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-emerald-200 flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-400" /> Importação do Novo Banco Supabase
                    </h3>
                    <p className="text-xs text-white/60 mt-1">
                      Importa músicas (<code>radio_songs</code>), capas (<code>radio_covers</code>), imagens de banda (<code>radio_band_images</code>) e letras (<code>radio_lyrics</code>) via Secrets do servidor.
                    </p>
                  </div>
                  <button
                    onClick={loadSupabaseInfo}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-mono-code border border-white/10 flex items-center gap-1.5 self-start"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                  </button>
                </div>

                {supabaseConfigured === true && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs font-mono-code flex items-center gap-2 ${
                      supabaseWriteConfigured
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                        : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-200'
                    }`}
                  >
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {supabaseWriteConfigured
                        ? 'Sincronização automática ativa: novas faixas, edições, curtidas e exclusões são gravadas diretamente no Supabase.'
                        : 'Banco conectado em modo leitura. Adicione SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) nos Secrets para gravar alterações automaticamente.'}
                    </span>
                  </div>
                )}

                {supabaseConfigured === false && (
                  <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs font-mono-code space-y-1.5">
                    <p className="font-bold">Variáveis do novo projeto Supabase ainda não configuradas nos Secrets:</p>
                    <p className="text-white/75">
                      Crie um novo projeto no Supabase, execute o SQL abaixo no SQL Editor e adicione <code>SUPABASE_URL</code> e <code>SUPABASE_SECRET_KEY</code> nas configurações de Secrets do ambiente.
                    </p>
                  </div>
                )}

                {supabaseMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono-code flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{supabaseMsg}</span>
                  </div>
                )}

                {supabaseError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-mono-code flex items-center gap-2">
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span>{supabaseError}</span>
                  </div>
                )}

                {supabaseCounts && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                      <span className="block text-[10px] font-mono-code text-white/50">radio_songs</span>
                      <span className="text-lg font-bold text-cyan-300">{supabaseCounts.songs}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                      <span className="block text-[10px] font-mono-code text-white/50">radio_covers</span>
                      <span className="text-lg font-bold text-purple-300">{supabaseCounts.covers}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                      <span className="block text-[10px] font-mono-code text-white/50">radio_band_images</span>
                      <span className="text-lg font-bold text-amber-300">{supabaseCounts.bandImages}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                      <span className="block text-[10px] font-mono-code text-white/50">radio_lyrics</span>
                      <span className="text-lg font-bold text-emerald-300">{supabaseCounts.lyrics}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={handleSupabaseImport}
                    disabled={supabaseLoading || supabaseConfigured === false}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold text-xs font-mono-code flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{supabaseLoading ? 'Processando...' : 'Importar Tabelas do Supabase'}</span>
                  </button>

                  <button
                    onClick={handleSupabaseExport}
                    disabled={supabaseLoading || supabaseConfigured === false}
                    className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs font-mono-code border border-white/15 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Acervo Atual para o Supabase</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <label className="block text-xs font-mono-code text-emerald-200/90">
                    Puxar músicas e capas de outra instância da rádio para o Supabase
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="url"
                      value={remoteSyncUrl}
                      onChange={(e) => setRemoteSyncUrl(e.target.value)}
                      placeholder="https://betosradioai.ai.studio"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      onClick={handleMigrateRemote}
                      disabled={supabaseLoading || !supabaseWriteConfigured}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold text-xs font-mono-code border border-emerald-400/35 flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${supabaseLoading ? 'animate-spin' : ''}`} />
                      <span>{supabaseLoading ? 'Sincronizando...' : 'Puxar para o Supabase'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/45 border border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white font-heading">
                      Script SQL para Novo Banco Supabase (supabase/schema.sql)
                    </h4>
                    <p className="text-[11px] text-white/50 font-mono-code">
                      Cole e execute no SQL Editor de um projeto Supabase novo para criar as 4 tabelas isoladas.
                    </p>
                  </div>
                  <button
                    onClick={handleCopySql}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{sqlCopied ? 'SQL Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-black/70 border border-white/10 text-[11px] font-mono-code text-emerald-200/90 overflow-x-auto max-h-72 leading-relaxed">
                  {supabaseSql || '-- Carregando script SQL...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Song Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl glass-panel-elevated p-6 md:p-8 border border-white/25 text-white shadow-2xl my-6">
            <button
              onClick={() => setEditingSong(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Edit3 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading tracking-wide text-cyan-200">
                  Editar Música • Acervo
                </h3>
                <p className="text-xs text-white/60 font-mono-code">
                  Atualize a letra, humor, ritmo e estilo da faixa: {editingSong.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-white/70 mb-1">Título da Música</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-code text-white/70 mb-1">Artista / Banda</label>
                  <input
                    type="text"
                    required
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-cyan-300 mb-1">Humor / Estilo (Ex: Contemplativo & Melancólico)</label>
                  <input
                    type="text"
                    value={editMood}
                    onChange={(e) => setEditMood(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-cyan-500/30 text-xs text-cyan-200 font-mono-code focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-code text-amber-300 mb-1">Ritmo / Andamento (Ex: Andante (96 BPM))</label>
                  <input
                    type="text"
                    value={editRhythm}
                    onChange={(e) => setEditRhythm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-amber-500/30 text-xs text-amber-200 font-mono-code focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-white/70 mb-1">Estilo Musical / Prompt Suno</label>
                <input
                  type="text"
                  value={editStyle}
                  onChange={(e) => setEditStyle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-purple-300 mb-1">Letra da Música (com tags [Verse], [Chorus] etc.)</label>
                <textarea
                  rows={6}
                  value={editLyrics}
                  onChange={(e) => setEditLyrics(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-black/50 border border-purple-500/30 text-xs text-white font-mono-code focus:outline-none focus:border-purple-400 resize-y leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono-code transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs font-mono-code flex items-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      <SunoDownloaderModal
        isOpen={isSunoSubModal}
        onClose={() => setIsSunoSubModal(false)}
        onSongAdded={(song, playNow) => {
          onSongAdded(song, playNow);
          setIsSunoSubModal(false);
        }}
      />

      <GeminiComposerModal
        isOpen={isGeminiSubModal}
        onClose={() => setIsGeminiSubModal(false)}
        onSendToPlayer={(song) => {
          onSongAdded(song, true);
          setIsGeminiSubModal(false);
        }}
      />

      <NanoBananaBandModal
        isOpen={isBananaSubModal}
        onClose={() => setIsBananaSubModal(false)}
      />
    </div>
  );
};
