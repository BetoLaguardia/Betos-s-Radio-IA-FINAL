import { upload } from '@vercel/blob/client';
import { Song } from '../types/song';
import { getAudioDurationFromFile } from './audioDuration';

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

interface HealthStatus {
  blobConfigured: boolean;
  supabaseConfigured: boolean;
  supabaseWriteConfigured: boolean;
  supabaseKeyRole?: string;
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

async function fetchHealthStatus(): Promise<HealthStatus> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) {
      return {
        blobConfigured: false,
        supabaseConfigured: false,
        supabaseWriteConfigured: false,
      };
    }
    const data = await res.json();
    return {
      blobConfigured: Boolean(data.blobConfigured),
      supabaseConfigured: Boolean(data.supabaseConfigured),
      supabaseWriteConfigured: Boolean(data.supabaseWriteConfigured),
      supabaseKeyRole: data.supabaseKeyRole,
    };
  } catch {
    return {
      blobConfigured: false,
      supabaseConfigured: false,
      supabaseWriteConfigured: false,
    };
  }
}

async function uploadFileToSupabaseSignedUrl(
  file: File,
  folder: 'tracks' | 'covers',
  contentType: string,
  authHeaders: Record<string, string>,
  onUploadProgress?: (pct: number) => void
): Promise<string> {
  const signRes = await fetch('/api/supabase/signed-upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      folder,
      filename: sanitizeFilename(file.name),
      contentType,
    }),
  });

  const signData = await signRes.json().catch(() => ({}));
  if (!signRes.ok || !signData.signedUrl || !signData.publicUrl) {
    throw new Error(
      signData?.error || `Falha ao obter permissão de upload para o Supabase Storage (HTTP ${signRes.status}).`
    );
  }

  // Direct browser -> Supabase Storage upload via FormData PUT (bypasses Vercel 4.5MB / Netlify 6MB limit)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signData.signedUrl, true);
    xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        onUploadProgress?.(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let msg = `Erro no upload direto para o Supabase Storage (HTTP ${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message || parsed?.error) {
            msg = `${msg} ${parsed.message || parsed.error}`;
          }
        } catch {
          // ignore non-json
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de rede ao enviar arquivo diretamente para o Supabase Storage.'));
    };

    const formData = new FormData();
    formData.append('cacheControl', '3600');
    const typedFile =
      file.type === contentType ? file : new File([file], file.name, { type: contentType });
    formData.append('', typedFile);
    xhr.send(formData);
  });

  return signData.publicUrl as string;
}

export async function uploadMediaAsset(
  file: File,
  folder: 'tracks' | 'covers',
  authHeaders: Record<string, string>,
  onProgress?: (pct: number) => void
): Promise<{ url: string; duration?: number }> {
  const isAudio = folder === 'tracks';
  const duration = isAudio ? await getAudioDurationFromFile(file) : undefined;
  const health = await fetchHealthStatus();
  const contentType = isAudio ? inferAudioContentType(file) : inferImageContentType(file);

  if (health.supabaseWriteConfigured) {
    const url = await uploadFileToSupabaseSignedUrl(
      file,
      folder,
      contentType,
      authHeaders,
      onProgress
    );
    return { url, ...(duration ? { duration } : {}) };
  }

  if (health.blobConfigured) {
    const blob = await upload(`${folder}/${sanitizeFilename(file.name)}`, file, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
      headers: authHeaders,
      contentType,
      multipart: file.size > 4 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return { url: blob.url, ...(duration ? { duration } : {}) };
  }

  if (health.supabaseConfigured && !health.supabaseWriteConfigured) {
    throw new Error(
      `Supabase conectado apenas em leitura (chave atual: ${health.supabaseKeyRole || 'desconhecida'}). Configure SUPABASE_SECRET_KEY para enviar novos arquivos.`
    );
  }

  // Local dev fallback
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch('/api/upload-asset', {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Falha ao enviar arquivo (HTTP ${res.status}).`);
  }
  onProgress?.(100);
  return { url: data.url, ...(duration ? { duration } : {}) };
}

export async function uploadSongViaVercelBlob(
  input: BlobSongUploadInput
): Promise<{ song: Song; viaBlob: boolean; viaSupabase?: boolean }> {
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

  const measuredDuration = await getAudioDurationFromFile(audioFile);
  const health = await fetchHealthStatus();
  const finalTitle = title?.trim() || audioFile.name.replace(/\.[^/.]+$/, '');

  // 1. Prefer direct browser -> Supabase Storage signed upload when Supabase write key is active
  if (health.supabaseWriteConfigured) {
    onProgress?.({ stage: 'Enviando áudio diretamente para o Supabase Storage...', percentage: 5 });

    const audioUrl = await uploadFileToSupabaseSignedUrl(
      audioFile,
      'tracks',
      inferAudioContentType(audioFile),
      authHeaders,
      (pct) => {
        onProgress?.({
          stage: `Enviando áudio para o Supabase Storage (${pct}%)...`,
          percentage: Math.max(5, Math.min(82, Math.round(pct * 0.82))),
        });
      }
    );

    let coverUrl: string | undefined;
    if (coverFile) {
      onProgress?.({ stage: 'Enviando capa para o Supabase Storage...', percentage: 86 });
      coverUrl = await uploadFileToSupabaseSignedUrl(
        coverFile,
        'covers',
        inferImageContentType(coverFile),
        authHeaders
      );
    }

    let bandPhotoUrl: string | undefined;
    if (bandPhotoFile) {
      onProgress?.({ stage: 'Enviando foto da banda para o Supabase Storage...', percentage: 92 });
      bandPhotoUrl = await uploadFileToSupabaseSignedUrl(
        bandPhotoFile,
        'covers',
        inferImageContentType(bandPhotoFile),
        authHeaders
      );
    }

    onProgress?.({ stage: 'Gravando faixa nas tabelas SQL do Supabase...', percentage: 96 });
    const songPayload = {
      id: `local-${Date.now()}`,
      title: finalTitle,
      artist: artist?.trim() || "Beto's Radio Artist",
      album: album?.trim() || 'Estúdio Original',
      audioUrl,
      fileSize: audioFile.size,
      ...(coverUrl ? { coverUrl } : {}),
      ...(bandPhotoUrl ? { bandPhotoUrl } : {}),
      stylePrompt: stylePrompt?.trim() || 'Indie Chamber Pop / Complex Harmonies',
      mood: mood?.trim() || 'Contemplativo & Melancólico',
      rhythm: rhythm?.trim() || 'Andante Moderato (100 BPM)',
      ...(measuredDuration ? { duration: measuredDuration } : {}),
      lyrics: lyrics?.trim() || '[Áudio Carregado com Sucesso]',
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Áudio enviado ao Supabase Storage, mas houve erro ao salvar nas tabelas SQL.');
    }

    onProgress?.({ stage: 'Música salva no Supabase!', percentage: 100 });
    return { song: data.song, viaBlob: false, viaSupabase: Boolean(data.savedToSupabase ?? true) };
  }

  // 2. Vercel Blob direct client upload when BLOB_READ_WRITE_TOKEN is active
  if (health.blobConfigured) {
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

    onProgress?.({ stage: 'Salvando metadados da faixa no acervo...', percentage: 97 });
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
      ...(measuredDuration ? { duration: measuredDuration } : {}),
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Áudio enviado ao Blob, mas houve erro ao salvar metadados.');
    }

    onProgress?.({ stage: 'Upload concluído no Vercel Blob!', percentage: 100 });
    return { song: data.song, viaBlob: true, viaSupabase: Boolean(data.savedToSupabase) };
  }

  // 3. Fail explicitly if Supabase is read-only (missing SUPABASE_SECRET_KEY on production server)
  if (health.supabaseConfigured && !health.supabaseWriteConfigured) {
    throw new Error(
      `Supabase conectado apenas em leitura no servidor (chave atual: ${health.supabaseKeyRole || 'desconhecida'}). Configure SUPABASE_URL e SUPABASE_SECRET_KEY (sb_secret_...) nas Environment Variables do projeto em produção e faça um Redeploy.`
    );
  }

  // 4. Local development fallback
  onProgress?.({ stage: 'Enviando arquivo para servidor local...', percentage: 40 });
  const formData = new FormData();
  formData.append('audio', audioFile);
  if (coverFile) formData.append('cover', coverFile);
  if (bandPhotoFile) formData.append('bandPhoto', bandPhotoFile);
  formData.append('title', finalTitle);
  formData.append('artist', artist?.trim() || "Beto's Radio Artist");
  formData.append('album', album?.trim() || 'Estúdio Original');
  formData.append('stylePrompt', stylePrompt?.trim() || 'Indie Chamber Pop / Complex Harmonies');
  formData.append('mood', mood?.trim() || 'Contemplativo & Profundo');
  formData.append('rhythm', rhythm?.trim() || 'Moderato (100 BPM)');
  if (measuredDuration) formData.append('duration', String(measuredDuration));
  formData.append('lyrics', lyrics?.trim() || '');
  formData.append('nanoBananaPrompt', nanoBananaPrompt?.trim() || '');

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      data?.error ||
        (res.status === 413
          ? 'Arquivo muito grande (> 4,5 MB) para envio via API serverless. Configure SUPABASE_URL e SUPABASE_SECRET_KEY nas Environment Variables da hospedagem para upload direto ao Supabase.'
          : `Erro no upload (HTTP ${res.status}).`)
    );
  }
  onProgress?.({ stage: 'Concluído!', percentage: 100 });
  return { song: data.song, viaBlob: false, viaSupabase: Boolean(data.savedToSupabase) };
}
