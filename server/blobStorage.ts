import crypto from 'node:crypto';
import { del, list, put, type ListBlobResultBlob } from '@vercel/blob';

export interface StoredSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  audioUrl: string;
  coverUrl: string;
  sourceUrl?: string;
  sunoId?: string | null;
  stylePrompt: string;
  mood: string;
  rhythm: string;
  duration?: number;
  lyrics: string;
  nanoBananaPrompt?: string;
  bandPhotoUrl?: string;
  bandInfo?: any;
  newsArticle?: any;
  blobPathname?: string;
  fileSize?: number;
  likes?: number;
  createdAt?: string;
}

const DEFAULT_COVERS = [
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
];

const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i;

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0);
}

export function isVercelBlobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('.blob.vercel-storage.com') || url.includes('.public.blob.vercel-storage.com');
}

function deterministicBlobId(pathname: string): string {
  const hash = crypto.createHash('sha1').update(pathname).digest('hex').slice(0, 16);
  return `blob-${hash}`;
}

function parseTitleFromPathname(pathname: string): string {
  const filename = pathname.split('/').pop() || pathname;
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  // Strip Vercel Blob's random suffix (e.g. -AbCdEf12345678901234567890)
  const withoutRandomSuffix = withoutExt.replace(/-[A-Za-z0-9]{20,}$/, '');
  // Strip leading numeric timestamp prefix (e.g. 1731612345678-)
  const withoutTimestamp = withoutRandomSuffix.replace(/^\d{10,14}-/, '');
  const cleaned = withoutTimestamp.replace(/[-_]+/g, ' ').trim();
  return cleaned || 'Faixa do Vercel Blob';
}

async function listAllBlobs(): Promise<ListBlobResultBlob[]> {
  const allBlobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ cursor, limit: 1000 });
    allBlobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return allBlobs;
}

async function fetchMetadataJson(blob: ListBlobResultBlob): Promise<StoredSong | null> {
  try {
    const separator = blob.url.includes('?') ? '&' : '?';
    const cacheBustedUrl = `${blob.url}${separator}etag=${encodeURIComponent(blob.etag || '')}`;
    const res = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = (await res.json()) as StoredSong;
    if (!parsed || typeof parsed !== 'object' || !parsed.audioUrl) return null;
    return parsed;
  } catch (err) {
    console.warn(`Could not parse metadata blob ${blob.pathname}:`, err);
    return null;
  }
}

export async function listSongsFromBlob(): Promise<StoredSong[]> {
  const allBlobs = await listAllBlobs();

  const metadataBlobs = allBlobs.filter(
    (b) => b.pathname.startsWith('metadata/') && b.pathname.endsWith('.json')
  );
  const audioBlobs = allBlobs.filter(
    (b) => !b.pathname.startsWith('metadata/') && AUDIO_EXT_REGEX.test(b.pathname)
  );

  const metadataResults = await Promise.all(metadataBlobs.map(fetchMetadataJson));
  const validMetadata = metadataResults.filter((m): m is StoredSong => m !== null);

  const byAudioUrl = new Map<string, StoredSong>();
  const byPathname = new Map<string, StoredSong>();
  const mergedSongs = new Map<string, StoredSong>();

  for (const meta of validMetadata) {
    if (meta.audioUrl) byAudioUrl.set(meta.audioUrl, meta);
    if (meta.blobPathname) byPathname.set(meta.blobPathname, meta);
    mergedSongs.set(meta.id, meta);
  }

  for (const audioBlob of audioBlobs) {
    const existing = byAudioUrl.get(audioBlob.url) || byPathname.get(audioBlob.pathname);

    if (existing) {
      mergedSongs.set(existing.id, {
        ...existing,
        audioUrl: audioBlob.url,
        blobPathname: audioBlob.pathname,
        fileSize: audioBlob.size,
        createdAt:
          existing.createdAt ||
          (audioBlob.uploadedAt instanceof Date
            ? audioBlob.uploadedAt.toISOString()
            : String(audioBlob.uploadedAt)),
      });
    } else {
      const id = deterministicBlobId(audioBlob.pathname);
      const title = parseTitleFromPathname(audioBlob.pathname);
      const coverIdx = audioBlob.pathname.length % DEFAULT_COVERS.length;

      mergedSongs.set(id, {
        id,
        title,
        artist: "Beto's Radio",
        album: 'Acervo Vercel Blob',
        audioUrl: audioBlob.url,
        coverUrl: DEFAULT_COVERS[coverIdx],
        blobPathname: audioBlob.pathname,
        fileSize: audioBlob.size,
        stylePrompt: 'Streaming Direto Vercel Blob • Hi-Fi',
        mood: 'Contemplativo & Hi-Fi',
        rhythm: 'Andante (100 BPM)',
        duration: 180,
        lyrics: '[Áudio carregado diretamente do Vercel Blob]',
        createdAt:
          audioBlob.uploadedAt instanceof Date
            ? audioBlob.uploadedAt.toISOString()
            : String(audioBlob.uploadedAt),
      });
    }
  }

  return Array.from(mergedSongs.values()).sort((a, b) => {
    const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
    const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
    return timeB - timeA;
  });
}

export async function saveSongMetadataToBlob(song: StoredSong): Promise<StoredSong> {
  const pathname = `metadata/${song.id}.json`;
  await put(pathname, JSON.stringify(song, null, 2), {
    access: 'public',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return song;
}

export async function findSongInBlob(id: string): Promise<StoredSong | null> {
  const songs = await listSongsFromBlob();
  return songs.find((s) => s.id === id) || null;
}

export async function deleteSongFromBlob(id: string): Promise<{ deletedCount: number }> {
  const allBlobs = await listAllBlobs();
  const urlsToDelete = new Set<string>();

  const metaBlob = allBlobs.find((b) => b.pathname === `metadata/${id}.json`);
  if (metaBlob) {
    urlsToDelete.add(metaBlob.url);
    const parsed = await fetchMetadataJson(metaBlob);
    if (parsed) {
      if (parsed.audioUrl && isVercelBlobUrl(parsed.audioUrl)) urlsToDelete.add(parsed.audioUrl);
      if (parsed.coverUrl && isVercelBlobUrl(parsed.coverUrl)) urlsToDelete.add(parsed.coverUrl);
      if (parsed.bandPhotoUrl && isVercelBlobUrl(parsed.bandPhotoUrl)) urlsToDelete.add(parsed.bandPhotoUrl);
    }
  }

  // Also check if id corresponds directly to a raw audio blob
  for (const blob of allBlobs) {
    if (!blob.pathname.startsWith('metadata/') && AUDIO_EXT_REGEX.test(blob.pathname)) {
      if (deterministicBlobId(blob.pathname) === id) {
        urlsToDelete.add(blob.url);
      }
    }
  }

  if (urlsToDelete.size > 0) {
    await del(Array.from(urlsToDelete));
  }

  return { deletedCount: urlsToDelete.size };
}

export async function uploadBufferToBlob(
  pathname: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; pathname: string }> {
  const result = await put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });
  return { url: result.url, pathname: result.pathname };
}
