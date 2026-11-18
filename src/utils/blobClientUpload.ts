import { upload } from '@vercel/blob/client';
import { Song } from '../types/song';

export interface BlobSongUploadInput {
  audioFile: File;
  coverFile?: File | null;
  bandPhotoFile?: File | null;
  title?: string;
  artist?: string;
  album?: string;
  stylePrompt?: string;
  mood?: string;
  rhythm?: string;
  lyrics?: string;
  nanoBananaPrompt?: string;
  authHeaders: Record<string, string>;
  onProgress?: (info: { stage: string; percentage: number }) => void;
}

function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot).toLowerCase() : '';
  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${cleanBase || 'audio'}${ext}`;
}

function inferAudioContentType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'audio/mpeg';
}

function inferImageContentType(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function isVercelBlobEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return true;
    const data = await res.json();
    return Boolean(data.blobConfigured);
  } catch {
    return true;
  }
}

export async function uploadSongViaVercelBlob(input: BlobSongUploadInput): Promise<{ song: Song; viaBlob: boolean }> {
  const {
    audioFile,
    coverFile,
    bandPhotoFile,
    title,
    artist,
    album,
    stylePrompt,
    mood,
    rhythm,
    lyrics,
    nanoBananaPrompt,
    authHeaders,
    onProgress,
  } = input;

  const blobEnabled = await isVercelBlobEnabled();

  if (!blobEnabled) {
    // Local development fallback when BLOB_READ_WRITE_TOKEN is not set
    onProgress?.({ stage: 'Enviando arquivo para servidor local...', percentage: 40 });
    const formData = new FormData();
    formData.append('audio', audioFile);
    if (coverFile) formData.append('cover', coverFile);
    if (bandPhotoFile) formData.append('bandPhoto', bandPhotoFile);
    formData.append('title', title?.trim() || audioFile.name.replace(/\.[^/.]+$/, ''));
    formData.append('artist', artist?.trim() || "Beto's Radio Artist");
    formData.append('album', album?.trim() || 'Estúdio Original');
    formData.append('stylePrompt', stylePrompt?.trim() || 'Indie Chamber Pop / Complex Harmonies');
    formData.append('mood', mood?.trim() || 'Contemplativo & Profundo');
    formData.append('rhythm', rhythm?.trim() || 'Moderato (100 BPM)');
    formData.append('lyrics', lyrics?.trim() || '');
    formData.append('nanoBananaPrompt', nanoBananaPrompt?.trim() || '');

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro no upload local.');
    }
    onProgress?.({ stage: 'Concluído!', percentage: 100 });
    return { song: data.song, viaBlob: false };
  }

  // 1. Client-side direct upload of Audio file via @vercel/blob/client (supports > 4.5 MB via multipart)
  const audioPathname = `tracks/${sanitizeFilename(audioFile.name)}`;
  onProgress?.({ stage: 'Enviando áudio diretamente para o Vercel Blob...', percentage: 5 });

  const audioBlob = await upload(audioPathname, audioFile, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
    headers: authHeaders,
    contentType: inferAudioContentType(audioFile),
    multipart: audioFile.size > 4 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => {
      onProgress?.({
        stage: `Enviando áudio para Vercel Blob (${Math.round(percentage)}%)...`,
        percentage: Math.max(5, Math.min(85, Math.round(percentage * 0.85))),
      });
    },
  });

  // 2. Upload optional cover image to Vercel Blob
  let coverUrl: string | undefined;
  if (coverFile) {
    onProgress?.({ stage: 'Enviando capa do álbum para o Vercel Blob...', percentage: 88 });
    const coverBlob = await upload(`covers/${sanitizeFilename(coverFile.name)}`, coverFile, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
      headers: authHeaders,
      contentType: inferImageContentType(coverFile),
    });
    coverUrl = coverBlob.url;
  }

  // 3. Upload optional band photo to Vercel Blob
  let bandPhotoUrl: string | undefined;
  if (bandPhotoFile) {
    onProgress?.({ stage: 'Enviando foto da banda para o Vercel Blob...', percentage: 93 });
    const bandBlob = await upload(`covers/${sanitizeFilename(bandPhotoFile.name)}`, bandPhotoFile, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
      headers: authHeaders,
      contentType: inferImageContentType(bandPhotoFile),
    });
    bandPhotoUrl = bandBlob.url;
  }

  // 4. Persist song metadata JSON to Vercel Blob
  onProgress?.({ stage: 'Salvando metadados da faixa no acervo...', percentage: 97 });
  const finalTitle = title?.trim() || audioFile.name.replace(/\.[^/.]+$/, '');
  const songPayload = {
    id: `blob-${Date.now()}`,
    title: finalTitle,
    artist: artist?.trim() || "Beto's Radio Artist",
    album: album?.trim() || 'Acervo Vercel Blob',
    audioUrl: audioBlob.url,
    blobPathname: audioBlob.pathname,
    fileSize: audioFile.size,
    ...(coverUrl ? { coverUrl } : {}),
    ...(bandPhotoUrl ? { bandPhotoUrl } : {}),
    stylePrompt: stylePrompt?.trim() || 'Indie Chamber Pop / Complex Harmonies',
    mood: mood?.trim() || 'Contemplativo & Melancólico',
    rhythm: rhythm?.trim() || 'Andante Moderato (100 BPM)',
    lyrics: lyrics?.trim() || '[Áudio Carregado via Vercel Blob]',
    nanoBananaPrompt:
      nanoBananaPrompt?.trim() || `Band portrait in analog vintage format for ${finalTitle} --ar 16:9`,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch('/api/songs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(songPayload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Áudio enviado ao Blob, mas houve erro ao salvar metadados.');
  }

  onProgress?.({ stage: 'Upload concluído no Vercel Blob!', percentage: 100 });
  return { song: data.song, viaBlob: true };
}
