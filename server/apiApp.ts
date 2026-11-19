import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  deleteSongFromBlob,
  findSongInBlob,
  isBlobConfigured,
  listSongsFromBlob,
  saveSongMetadataToBlob,
  uploadBufferToBlob,
  type StoredSong,
} from './blobStorage.js';
import {
  createSupabaseSignedUploadUrl,
  deleteSongFromSupabase,
  exportSongsToSupabase,
  findSongInSupabase,
  getSupabaseKeyRole,
  getSupabaseKeySources,
  getSupabaseTableCounts,
  importSongsFromSupabase,
  inspectSupabaseCatalog,
  isSupabaseConfigured,
  isSupabaseWriteConfigured,
  updateSongLikesInSupabase,
  uploadMediaToSupabaseStorage,
  upsertSongToSupabase,
} from './supabaseStorage.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
const TRACKS_DIR = path.resolve(UPLOADS_DIR, 'tracks');
const COVERS_DIR = path.resolve(UPLOADS_DIR, 'covers');
const SONGS_FILE = path.resolve(DATA_DIR, 'songs.json');

function ensureLocalDirs() {
  try {
    [DATA_DIR, UPLOADS_DIR, TRACKS_DIR, COVERS_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  } catch (err) {
    console.warn('Skipping local directory creation (likely read-only filesystem):', err);
  }
}

// Local JSON fallback helpers (used when BLOB_READ_WRITE_TOKEN is not set)
function loadLocalSongs(): StoredSong[] {
  try {
    if (fs.existsSync(SONGS_FILE)) {
      const data = fs.readFileSync(SONGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading songs.json:', err);
  }
  return [];
}

function saveLocalSongs(songs: StoredSong[]) {
  try {
    ensureLocalDirs();
    fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving songs.json:', err);
  }
}

// Stateless HMAC Admin Token Helpers (safe for Vercel Serverless)
// Signing secret comes only from the environment. ADMIN_PASSWORD is used as a
// last resort so tokens still work when no dedicated secret is configured.
function getSigningSecret(): string | null {
  const secret =
    process.env.ADMIN_TOKEN_SECRET?.trim() ||
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.ADMIN_PASSWORD?.trim();
  return secret || null;
}

function createSignedAdminToken(): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('Admin signing secret is not configured.');
  const issuedAt = Date.now().toString();
  const sig = crypto.createHmac('sha256', secret).update(issuedAt).digest('hex');
  return `beto.${issuedAt}.${sig}`;
}

function verifySignedAdminToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.replace(/^Bearer\s+/i, '').trim();

  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== 'beto') return false;

  const [, issuedAt, sig] = parts;
  const ts = Number(issuedAt);
  if (!Number.isFinite(ts)) return false;

  // Token valid for 30 days
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - ts > maxAgeMs) return false;

  const secret = getSigningSecret();
  if (!secret) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(issuedAt).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

function isValidAdminRequest(req: Request): boolean {
  const xAdminKey = req.headers['x-admin-key'];
  const authHeader = req.headers.authorization;
  const candidate =
    (typeof xAdminKey === 'string' ? xAdminKey : undefined) ||
    (typeof authHeader === 'string' ? authHeader : undefined);

  return verifySignedAdminToken(candidate);
}

// Initialize Gemini Client
function getGeminiClient(): GoogleGenAI | null {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  if (!geminiApiKey) return null;
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callGemini(ai: GoogleGenAI, contents: any, config: any) {
  const models = ['gemini-2.5-flash', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErr: any = null;
  for (const model of models) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return resp;
    } catch (e) {
      console.warn(`Model ${model} failed, trying next...`, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

async function fetchUrlBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`Error fetching ${url}:`, err);
    return null;
  }
}

function extractSunoUUID(url: string): string | null {
  const match = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const apiApp = express();

// Safe JSON body parser compatible with both standalone Express and Vercel serverless pre-parsed bodies
apiApp.use((req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // ignore if not JSON
    }
  }
  if (req.readableEnded || (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0)) {
    return next();
  }
  return express.json({ limit: '20mb' })(req, res, next);
});

apiApp.use((req: Request, res: Response, next: NextFunction) => {
  if (req.readableEnded) {
    return next();
  }
  return express.urlencoded({ extended: true, limit: '20mb' })(req, res, next);
});

// ================= API ROUTES =================

// 0. Health / Storage Status
apiApp.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    blobConfigured: isBlobConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseWriteConfigured: isSupabaseWriteConfigured(),
    supabaseKeyRole: getSupabaseKeyRole(),
    supabaseKeySources: getSupabaseKeySources(),
  });
});

// 1. Admin Verification Route
apiApp.post('/api/admin/verify', (req: Request, res: Response) => {
  const { password } = req.body || {};
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!envPassword) {
    res.status(503).json({ success: false, error: 'ADMIN_PASSWORD não configurado no servidor.' });
    return;
  }

  const candidate = typeof password === 'string' ? password.trim() : '';
  const a = Buffer.from(candidate);
  const b = Buffer.from(envPassword);
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (matches) {
    res.json({
      success: true,
      token: createSignedAdminToken(),
      blobConfigured: isBlobConfigured(),
    });
  } else {
    res.status(401).json({ success: false, error: 'Senha de acesso incorreta.' });
  }
});

// 2. Vercel Blob Client Upload Token Route (@vercel/blob/client handleUpload)
apiApp.post('/api/blob/upload', async (req: Request, res: Response): Promise<void> => {
  if (!isBlobConfigured()) {
    res.status(503).json({
      error: 'BLOB_READ_WRITE_TOKEN não configurado no servidor.',
      code: 'BLOB_NOT_CONFIGURED',
    });
    return;
  }

  const body = req.body as HandleUploadBody;

  // Enforce Creator Admin authentication before issuing a client upload token
  if (body?.type === 'blob.generate-client-token' && !isValidAdminRequest(req)) {
    res.status(401).json({
      error: 'Sessão de criador expirada ou inválida. Faça login novamente na Área do Criador.',
    });
    return;
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/ogg',
            'audio/mp4',
            'audio/m4a',
            'audio/x-m4a',
            'audio/aac',
            'audio/flac',
            'audio/webm',
            'audio/*',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/*',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB (allows files much larger than 4.5 MB)
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err: any) {
    console.error('Error in /api/blob/upload:', err);
    res.status(400).json({ error: err?.message || 'Falha ao gerar token de upload do Vercel Blob.' });
  }
});

// 3. List songs (Reads from Supabase DB when configured, merging/falling back to Vercel Blob or local JSON)
apiApp.get('/api/songs', async (req: Request, res: Response): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');

    if (isSupabaseConfigured()) {
      try {
        const { songs: supabaseSongs } = await importSongsFromSupabase();

        if (supabaseSongs.length > 0) {
          if (isBlobConfigured()) {
            const blobSongs = await listSongsFromBlob();
            const mergedMap = new Map<string, StoredSong>();
            for (const bs of blobSongs) mergedMap.set(bs.id, bs);
            for (const ss of supabaseSongs) mergedMap.set(ss.id, ss);
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
              const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
              const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
              return timeB - timeA;
            });
            res.json({ songs: merged, source: 'supabase+vercel-blob' });
            return;
          }

          res.json({ songs: supabaseSongs, source: 'supabase' });
          return;
        }
      } catch (supabaseErr: any) {
        console.warn('Supabase read fallback (tables may not be created yet):', supabaseErr?.message);
      }
    }

    if (isBlobConfigured()) {
      const songs = await listSongsFromBlob();
      res.json({ songs, source: 'vercel-blob' });
      return;
    }

    const songs = loadLocalSongs();
    res.json({ songs, source: 'local-json' });
  } catch (err: any) {
    console.error('Error listing songs:', err);
    res.status(500).json({ error: 'Erro ao listar músicas.', details: err?.message });
  }
});

// 4. Add song metadata entry (Persists to Supabase DB and Vercel Blob / local JSON when configured)
apiApp.post('/api/songs', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const newSong: StoredSong = {
      id: body.id || `track-${Date.now()}`,
      createdAt: body.createdAt || new Date().toISOString(),
      title: body.title || 'Faixa Sem Título',
      artist: body.artist || "Beto's Radio",
      album: body.album || 'Estúdio Original',
      audioUrl: body.audioUrl || '',
      coverUrl:
        body.coverUrl ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      stylePrompt: body.stylePrompt || 'Indie Chamber Pop / Complex Harmonies',
      mood: body.mood || 'Contemplativo & Profundo',
      rhythm: body.rhythm || 'Moderato (100 BPM)',
      duration: typeof body.duration === 'number' ? body.duration : 180,
      lyrics: body.lyrics || '[Áudio Carregado com Sucesso]',
      ...(body.bandPhotoUrl ? { bandPhotoUrl: body.bandPhotoUrl } : {}),
      ...(body.nanoBananaPrompt ? { nanoBananaPrompt: body.nanoBananaPrompt } : {}),
      ...(body.blobPathname ? { blobPathname: body.blobPathname } : {}),
      ...(body.fileSize ? { fileSize: body.fileSize } : {}),
      ...(body.bandInfo ? { bandInfo: body.bandInfo } : {}),
      ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
      ...(body.sunoId !== undefined ? { sunoId: body.sunoId } : {}),
      likes: typeof body.likes === 'number' ? body.likes : 0,
    };

    const sources: string[] = [];

    if (isSupabaseWriteConfigured()) {
      await upsertSongToSupabase(newSong);
      sources.push('supabase');
    } else if (isSupabaseConfigured() && !isBlobConfigured()) {
      res.status(403).json({
        error: `Supabase em modo somente leitura (chave atual: ${getSupabaseKeyRole()}). Defina SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) válida nos Secrets para salvar faixas.`,
      });
      return;
    }

    if (isBlobConfigured()) {
      await saveSongMetadataToBlob(newSong);
      sources.push('vercel-blob');
    } else if (!sources.includes('supabase')) {
      if (process.env.VERCEL || process.env.NETLIFY) {
        res.status(503).json({
          error:
            'Nenhum banco de produção configurado no servidor. Defina SUPABASE_URL e SUPABASE_SECRET_KEY nas Environment Variables da hospedagem.',
        });
        return;
      }
      const songs = loadLocalSongs();
      songs.unshift(newSong);
      saveLocalSongs(songs);
      sources.push('local-json');
    }

    res.status(201).json({
      song: newSong,
      source: sources.join('+') || 'local-json',
      savedToSupabase: sources.includes('supabase'),
    });
  } catch (err: any) {
    console.error('Error saving song:', err);
    res.status(500).json({ error: err?.message || 'Erro ao salvar metadados da música.' });
  }
});

// 5. Update song
apiApp.put('/api/songs/:id', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({
      error: 'Sessão de criador expirada ou inválida. Faça login novamente na Área do Criador.',
    });
    return;
  }

  const { id } = req.params;
  try {
    let existing: StoredSong | null = null;

    if (isSupabaseConfigured()) {
      try {
        existing = await findSongInSupabase(id);
      } catch (supabaseErr: any) {
        console.warn('Supabase find fallback:', supabaseErr?.message);
      }
    }
    if (!existing && isBlobConfigured()) {
      existing = await findSongInBlob(id);
    }
    if (!existing) {
      const localSongs = loadLocalSongs();
      existing = localSongs.find((s) => s.id === id) || null;
    }

    if (!existing && !req.body?.audioUrl) {
      res.status(404).json({ error: 'Música não encontrada.' });
      return;
    }

    const updatedSong: StoredSong = {
      ...(existing || ({} as StoredSong)),
      ...req.body,
      id,
    };

    let savedToSupabase = false;
    if (isSupabaseWriteConfigured()) {
      await upsertSongToSupabase(updatedSong);
      savedToSupabase = true;
    } else if (isSupabaseConfigured() && !isBlobConfigured()) {
      res.status(403).json({
        error: `Edição bloqueada: Supabase em modo somente leitura (chave atual: ${getSupabaseKeyRole()}). Defina SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY nos Secrets.`,
      });
      return;
    }

    if (isBlobConfigured()) {
      await saveSongMetadataToBlob(updatedSong);
    } else if (!savedToSupabase) {
      if (process.env.VERCEL || process.env.NETLIFY) {
        res.status(503).json({
          error:
            'Nenhum banco de escrita configurado no servidor. Defina SUPABASE_URL e SUPABASE_SECRET_KEY nas variáveis de ambiente.',
        });
        return;
      }
      const songs = loadLocalSongs();
      const index = songs.findIndex((s) => s.id === id);
      if (index !== -1) {
        songs[index] = updatedSong;
        saveLocalSongs(songs);
      }
    }

    res.json({ success: true, song: updatedSong, savedToSupabase });
  } catch (err: any) {
    console.error('Error updating song:', err);
    res.status(500).json({ error: err?.message || 'Erro ao atualizar música.' });
  }
});

// 5.1. Like / Unlike song (persisted in Supabase DB, Vercel Blob, or local JSON)
apiApp.post('/api/songs/:id/like', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const action = req.body?.action === 'unlike' ? 'unlike' : 'like';
  const delta = action === 'unlike' ? -1 : 1;

  try {
    let supabaseExisting: StoredSong | null = null;
    let blobExisting: StoredSong | null = null;

    if (isSupabaseConfigured()) {
      try {
        supabaseExisting = await findSongInSupabase(id);
      } catch (supabaseErr: any) {
        console.warn('Supabase like lookup fallback:', supabaseErr?.message);
      }
    }
    if (isBlobConfigured()) {
      blobExisting = await findSongInBlob(id);
    }

    const localSongs = loadLocalSongs();
    const localIndex = localSongs.findIndex((s) => s.id === id);
    const localExisting = localIndex !== -1 ? localSongs[localIndex] : null;

    const existing = supabaseExisting || blobExisting || localExisting;
    if (!existing) {
      res.status(404).json({ error: 'Música não encontrada.' });
      return;
    }

    const nextLikes = Math.max(0, (existing.likes || 0) + delta);
    let updatedSong: StoredSong = {
      ...existing,
      likes: nextLikes,
    };

    if (isSupabaseWriteConfigured()) {
      try {
        if (supabaseExisting) {
          const synced = await updateSongLikesInSupabase(id, nextLikes);
          if (synced) updatedSong = synced;
        } else {
          await upsertSongToSupabase(updatedSong);
        }
      } catch (supabaseErr: any) {
        console.warn('Supabase like write fallback:', supabaseErr?.message);
      }
    }

    if (isBlobConfigured() && blobExisting) {
      await saveSongMetadataToBlob(updatedSong);
    }

    if (localIndex !== -1) {
      localSongs[localIndex] = updatedSong;
      saveLocalSongs(localSongs);
    }

    res.json({ success: true, likes: nextLikes, song: updatedSong });
  } catch (err: any) {
    console.error('Error toggling like on song:', err);
    res.status(500).json({ error: 'Erro ao atualizar curtida.', details: err?.message });
  }
});

// 6. Delete song
apiApp.delete('/api/songs/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    if (isSupabaseWriteConfigured()) {
      try {
        await deleteSongFromSupabase(id);
      } catch (supabaseErr: any) {
        console.warn('Supabase delete fallback:', supabaseErr?.message);
      }
    }

    if (isBlobConfigured()) {
      const result = await deleteSongFromBlob(id);
      res.json({ success: true, ...result });
      return;
    }

    const songs = loadLocalSongs();
    const updated = songs.filter((s) => s.id !== id);
    if (updated.length !== songs.length) {
      saveLocalSongs(updated);
    }
    res.json({ success: true, count: updated.length });
  } catch (err: any) {
    console.error('Error deleting song:', err);
    res.status(500).json({ error: 'Erro ao excluir música.', details: err?.message });
  }
});

// 7. Download and Import from Suno Link (uploads to Vercel Blob when configured)
apiApp.post('/api/suno/download', async (req: Request, res: Response): Promise<void> => {
  const { url, customTitle, customLyrics, customStyle, mood, rhythm } = req.body || {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL da música é obrigatória.' });
    return;
  }

  const cleanUrl = url.trim();
  const uuid = extractSunoUUID(cleanUrl);
  const trackId = `suno-${uuid || Date.now()}`;

  let audioUrlToDownload = cleanUrl;
  let coverUrlToDownload = '';
  let scrapedTitle = customTitle || '';
  let scrapedLyrics = customLyrics || '';
  let scrapedTags = customStyle || '';

  if (uuid) {
    audioUrlToDownload = `https://cdn1.suno.ai/${uuid}.mp3`;
    coverUrlToDownload = `https://cdn1.suno.ai/image_large_${uuid}.png`;

    try {
      const pageRes = await fetch(`https://suno.com/song/${uuid}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch =
          html.match(/<meta property="og:title" content="([^"]+)"/i) ||
          html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && !scrapedTitle) {
          scrapedTitle = titleMatch[1].replace(/ \| Suno.*$/i, '').trim();
        }
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (imageMatch) {
          coverUrlToDownload = imageMatch[1];
        }
        const audioMatch = html.match(/<meta property="og:audio" content="([^"]+)"/i);
        if (audioMatch) {
          audioUrlToDownload = audioMatch[1];
        }
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
        if (descMatch && !scrapedLyrics) {
          scrapedLyrics = descMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }
      }
    } catch (scrapeErr) {
      console.warn('Could not scrape Suno page metadata:', scrapeErr);
    }
  }

  let finalAudioUrl = '';
  let blobPathname: string | undefined;
  let audioSuccess = false;

  const audioBuffer = await fetchUrlBuffer(audioUrlToDownload);
  if (audioBuffer) {
    audioSuccess = true;
    if (isBlobConfigured()) {
      const uploaded = await uploadBufferToBlob(`tracks/${trackId}.mp3`, audioBuffer, 'audio/mpeg');
      finalAudioUrl = uploaded.url;
      blobPathname = uploaded.pathname;
    } else if (isSupabaseWriteConfigured()) {
      try {
        finalAudioUrl = await uploadMediaToSupabaseStorage(`tracks/${trackId}.mp3`, audioBuffer, 'audio/mpeg');
      } catch (storageErr: any) {
        console.warn('Supabase storage audio upload fallback:', storageErr?.message);
        ensureLocalDirs();
        const audioFilename = `${trackId}.mp3`;
        fs.writeFileSync(path.resolve(TRACKS_DIR, audioFilename), audioBuffer);
        finalAudioUrl = `/uploads/tracks/${audioFilename}`;
      }
    } else {
      ensureLocalDirs();
      const audioFilename = `${trackId}.mp3`;
      fs.writeFileSync(path.resolve(TRACKS_DIR, audioFilename), audioBuffer);
      finalAudioUrl = `/uploads/tracks/${audioFilename}`;
    }
  } else {
    const fallbackAudioStreams = [
      'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3',
      'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      'https://cdn.pixabay.com/download/audio/2021/09/06/audio_8842c89f5d.mp3?filename=chill-lofi-song-8441.mp3',
    ];
    finalAudioUrl = fallbackAudioStreams[Math.floor(Math.random() * fallbackAudioStreams.length)];
  }

  let finalCoverUrl = '';
  if (coverUrlToDownload) {
    const coverBuffer = await fetchUrlBuffer(coverUrlToDownload);
    if (coverBuffer) {
      if (isBlobConfigured()) {
        const uploadedCover = await uploadBufferToBlob(`covers/${trackId}.png`, coverBuffer, 'image/png');
        finalCoverUrl = uploadedCover.url;
      } else if (isSupabaseWriteConfigured()) {
        try {
          finalCoverUrl = await uploadMediaToSupabaseStorage(`covers/${trackId}.png`, coverBuffer, 'image/png');
        } catch (storageErr: any) {
          console.warn('Supabase storage cover upload fallback:', storageErr?.message);
          ensureLocalDirs();
          const coverFilename = `${trackId}.png`;
          fs.writeFileSync(path.resolve(COVERS_DIR, coverFilename), coverBuffer);
          finalCoverUrl = `/uploads/covers/${coverFilename}`;
        }
      } else {
        ensureLocalDirs();
        const coverFilename = `${trackId}.png`;
        fs.writeFileSync(path.resolve(COVERS_DIR, coverFilename), coverBuffer);
        finalCoverUrl = `/uploads/covers/${coverFilename}`;
      }
    }
  }

  if (!finalCoverUrl || finalCoverUrl.includes('suno.ai')) {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    ];
    finalCoverUrl = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
  }

  const finalTitle = scrapedTitle || (uuid ? `Suno Composition #${uuid.substring(0, 8)}` : 'Composição Suno AI');

  const newSong: StoredSong = {
    id: trackId,
    title: finalTitle,
    artist: 'Suno AI & Studio',
    album: 'Suno Transmissão Direta',
    audioUrl: finalAudioUrl,
    coverUrl: finalCoverUrl,
    ...(blobPathname ? { blobPathname } : {}),
    sourceUrl: cleanUrl,
    sunoId: uuid || null,
    stylePrompt: scrapedTags || customStyle || 'Contemporary Art-Pop / Intricate Harmonies, Lush Production',
    mood: mood || 'Contemplativo & Vibrante',
    rhythm: rhythm || 'Andante Moderno (105 BPM)',
    duration: 120,
    lyrics: scrapedLyrics || "[Instrumental / Suno AI Track]\n\nFaixa importada com sucesso do Suno para a Beto's Radio.",
    nanoBananaPrompt: `Cinematic album cover for '${finalTitle}', intricate art-house vinyl sleeve photography, ethereal lighting, high detail --ar 16:9`,
    createdAt: new Date().toISOString(),
  };

  let savedToSupabase = false;
  if (isSupabaseWriteConfigured()) {
    try {
      await upsertSongToSupabase(newSong);
      savedToSupabase = true;
    } catch (supabaseErr: any) {
      console.warn('Supabase suno download write fallback:', supabaseErr?.message);
    }
  }

  if (isBlobConfigured()) {
    await saveSongMetadataToBlob(newSong);
  } else if (!savedToSupabase) {
    const songs = loadLocalSongs();
    songs.unshift(newSong);
    saveLocalSongs(songs);
  }

  res.status(200).json({
    success: true,
    song: newSong,
    downloadedLocally: audioSuccess,
    message: audioSuccess ? 'Música e capa salvas com sucesso!' : 'Link Suno integrado ao player com streaming otimizado.',
  });
});

// 8. Legacy/Local Direct File Upload Fallback (for local dev when BLOB_READ_WRITE_TOKEN is absent)
apiApp.post(
  '/api/upload',
  uploadMemory.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'bandPhoto', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = req.body || {};

    const audioFile = files?.audio?.[0];
    const coverFile = files?.cover?.[0];
    const bandPhotoFile = files?.bandPhoto?.[0];

    if (!audioFile) {
      res.status(400).json({ error: 'Arquivo de áudio (MP3/WAV) é obrigatório.' });
      return;
    }

    const baseName = path.basename(audioFile.originalname, path.extname(audioFile.originalname));
    const finalTitle = body.title && body.title.trim() ? body.title.trim() : baseName;
    const finalArtist = body.artist && body.artist.trim() ? body.artist.trim() : "Artista Beto's Radio";
    const trackId = `local-${Date.now()}`;

    let audioUrl = '';
    let blobPathname: string | undefined;
    let coverUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
    let bandPhotoUrl: string | undefined;

    if (isBlobConfigured()) {
      const audioExt = path.extname(audioFile.originalname) || '.mp3';
      const uploadedAudio = await uploadBufferToBlob(
        `tracks/${Date.now()}-${baseName}${audioExt}`,
        audioFile.buffer,
        audioFile.mimetype || 'audio/mpeg'
      );
      audioUrl = uploadedAudio.url;
      blobPathname = uploadedAudio.pathname;

      if (coverFile) {
        const coverExt = path.extname(coverFile.originalname) || '.jpg';
        const uploadedCover = await uploadBufferToBlob(
          `covers/${Date.now()}-cover${coverExt}`,
          coverFile.buffer,
          coverFile.mimetype || 'image/jpeg'
        );
        coverUrl = uploadedCover.url;
      }

      if (bandPhotoFile) {
        const bandExt = path.extname(bandPhotoFile.originalname) || '.jpg';
        const uploadedBand = await uploadBufferToBlob(
          `covers/${Date.now()}-band${bandExt}`,
          bandPhotoFile.buffer,
          bandPhotoFile.mimetype || 'image/jpeg'
        );
        bandPhotoUrl = uploadedBand.url;
      }
    } else if (isSupabaseWriteConfigured()) {
      const saveSupabaseOrLocal = async (
        file: Express.Multer.File,
        folder: 'tracks' | 'covers',
        dir: string,
        urlPrefix: string,
        fallbackExt: string
      ) => {
        const ext = path.extname(file.originalname) || fallbackExt;
        const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        try {
          return await uploadMediaToSupabaseStorage(
            `${folder}/${safeName}`,
            file.buffer,
            file.mimetype || (folder === 'tracks' ? 'audio/mpeg' : 'image/jpeg')
          );
        } catch (storageErr: any) {
          console.warn(`Supabase storage ${folder} fallback:`, storageErr?.message);
          ensureLocalDirs();
          fs.writeFileSync(path.resolve(dir, safeName), file.buffer);
          return `${urlPrefix}/${safeName}`;
        }
      };

      audioUrl = await saveSupabaseOrLocal(audioFile, 'tracks', TRACKS_DIR, '/uploads/tracks', '.mp3');
      if (coverFile) {
        coverUrl = await saveSupabaseOrLocal(coverFile, 'covers', COVERS_DIR, '/uploads/covers', '.jpg');
      }
      if (bandPhotoFile) {
        bandPhotoUrl = await saveSupabaseOrLocal(bandPhotoFile, 'covers', COVERS_DIR, '/uploads/covers', '.jpg');
      }
    } else {
      ensureLocalDirs();
      const saveLocal = (file: Express.Multer.File, dir: string, urlPrefix: string, fallbackExt: string) => {
        const ext = path.extname(file.originalname) || fallbackExt;
        const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        fs.writeFileSync(path.resolve(dir, safeName), file.buffer);
        return `${urlPrefix}/${safeName}`;
      };

      audioUrl = saveLocal(audioFile, TRACKS_DIR, '/uploads/tracks', '.mp3');
      if (coverFile) {
        coverUrl = saveLocal(coverFile, COVERS_DIR, '/uploads/covers', '.jpg');
      }
      if (bandPhotoFile) {
        bandPhotoUrl = saveLocal(bandPhotoFile, COVERS_DIR, '/uploads/covers', '.jpg');
      }
    }

    const newSong: StoredSong = {
      id: trackId,
      title: finalTitle,
      artist: finalArtist,
      album: body.album && body.album.trim() ? body.album.trim() : 'Estúdio Original',
      audioUrl,
      coverUrl,
      ...(blobPathname ? { blobPathname } : {}),
      fileSize: audioFile.size,
      ...(bandPhotoUrl ? { bandPhotoUrl } : {}),
      stylePrompt: body.stylePrompt && body.stylePrompt.trim() ? body.stylePrompt.trim() : 'Indie Chamber Pop / Complex Harmony',
      mood: body.mood && body.mood.trim() ? body.mood.trim() : 'Contemplativo & Profundo',
      rhythm: body.rhythm && body.rhythm.trim() ? body.rhythm.trim() : 'Moderato (100 BPM)',
      duration: Number(body.duration) > 0 ? Math.round(Number(body.duration)) : 120,
      lyrics: body.lyrics && body.lyrics.trim() ? body.lyrics.trim() : '[Áudio Carregado Localmente com Sucesso]',
      nanoBananaPrompt:
        body.nanoBananaPrompt && body.nanoBananaPrompt.trim()
          ? body.nanoBananaPrompt.trim()
          : `Band portrait in analog vintage format for ${finalTitle} --ar 16:9`,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && !isSupabaseWriteConfigured() && !isBlobConfigured()) {
      res.status(403).json({
        error: `Upload bloqueado: Supabase conectado apenas em leitura (role atual: ${getSupabaseKeyRole()}). Configure SUPABASE_SERVICE_ROLE_KEY (chave service_role) ou SUPABASE_SECRET_KEY nos Secrets.`,
      });
      return;
    }

    let savedToSupabase = false;
    if (isSupabaseWriteConfigured()) {
      try {
        await upsertSongToSupabase(newSong);
        savedToSupabase = true;
      } catch (supabaseErr: any) {
        console.error('Supabase upload write error:', supabaseErr?.message);
        if (!isBlobConfigured()) {
          res.status(500).json({
            error: supabaseErr?.message || 'Erro ao gravar faixa nas tabelas do Supabase.',
          });
          return;
        }
      }
    }

    if (isBlobConfigured()) {
      await saveSongMetadataToBlob(newSong);
    } else if (!savedToSupabase) {
      const songs = loadLocalSongs();
      songs.unshift(newSong);
      saveLocalSongs(songs);
    } else {
      const songs = loadLocalSongs();
      songs.unshift(newSong);
      saveLocalSongs(songs);
    }

    res.status(201).json({ success: true, song: newSong, savedToSupabase });
  }
);

// 8.1. Upload single asset (audio/cover/bandPhoto) when editing a song
apiApp.post(
  '/api/upload-asset',
  uploadMemory.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!isValidAdminRequest(req)) {
      res.status(401).json({
        error: 'Sessão de criador expirada ou inválida. Faça login novamente na Área do Criador.',
      });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      return;
    }

    const folder = req.body?.folder === 'tracks' ? 'tracks' : 'covers';
    const fallbackExt = folder === 'tracks' ? '.mp3' : '.jpg';
    const ext = path.extname(file.originalname) || fallbackExt;
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

    try {
      if (isBlobConfigured()) {
        const uploaded = await uploadBufferToBlob(
          `${folder}/${safeName}`,
          file.buffer,
          file.mimetype || (folder === 'tracks' ? 'audio/mpeg' : 'image/jpeg')
        );
        res.json({ url: uploaded.url });
        return;
      }

      if (isSupabaseWriteConfigured()) {
        const publicUrl = await uploadMediaToSupabaseStorage(
          `${folder}/${safeName}`,
          file.buffer,
          file.mimetype || (folder === 'tracks' ? 'audio/mpeg' : 'image/jpeg')
        );
        res.json({ url: publicUrl });
        return;
      }

      ensureLocalDirs();
      const targetDir = folder === 'tracks' ? TRACKS_DIR : COVERS_DIR;
      const urlPrefix = folder === 'tracks' ? '/uploads/tracks' : '/uploads/covers';
      fs.writeFileSync(path.resolve(targetDir, safeName), file.buffer);
      res.json({ url: `${urlPrefix}/${safeName}` });
    } catch (err: any) {
      console.error('Error uploading asset:', err);
      res.status(500).json({ error: err?.message || 'Erro ao enviar arquivo.' });
    }
  }
);

// 9. Gemini: Gerador de Letra, Estilo Suno e Prompts
apiApp.post('/api/gemini/generate-suno', async (req: Request, res: Response): Promise<void> => {
  const { theme, mood, rhythm, romanticFocus, complexityLevel, customDirectives } = req.body || {};
  const ai = getGeminiClient();

  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY não configurada no servidor. Verifique as configurações de Secrets.',
    });
    return;
  }

  try {
    const systemPrompt = `Você é um dos mais prestigiados poetas líricos contemporâneos, arranjador erudito e especialista em engenharia de prompt para o Suno AI (v3.5 e v4) e geradores de imagem como Nano Banana / Midjourney.
Sua missão: criar composições musicais originais de altíssimo valor lírico e narrativo.

DIRETRIZES FUNDAMENTAIS:
1. Temas Complexos e Inteligentes: Filosofia da mente, física teórica/quântica, arquitetura brutalista/modernista, existencialismo, neurociência, cosmologia, semiótica.
2. Romances Inteligentes (Romances com densidade): O amor nunca é clichê. É retratado com sofisticação afetiva, diálogos de alta voltagem intelectual, metáforas sobre entropia, sinapses, gravidade, paradoxos e intimidade honesta desprovida de cinismo.
3. Arranjos Instrumentais Elaborados: Crie comandos de estilo ricos para o Suno com instrumentação detalhada (ex: violões de nylon polirrítmicos, Mellotron, violoncelo processado com arco, bateria em compasso 7/8 ou 5/4, sintetizadores modulares analógicos, timbres aveludados, dinâmica de crescendo orquestral).
4. Estrutura Lírica Impecável: Use tags estruturais precisas para o Suno: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Guitar Solo / Instrumental Break], [Chorus], [Outro]. As letras devem ser ricas em rimas internas, métrica fluida e profundidade.
5. Prompt Visual para Nano Banana: Crie uma descrição cinematográfica e detalhada para o Nano Banana criar o retrato dos integrantes da banda ou artista, especificando vestimenta, câmeras analógicas (Leica M, Hasselblad), iluminação chiaroscuro, estilo e personalidade de cada membro.`;

    const userPrompt = `Gere uma composição completa com os seguintes parâmetros:
- Tema Principal / Conceito: ${theme || 'Romance Quântico e Entropia das Relações Modernas'}
- Humor / Clima Emocional: ${mood || 'Contemplativo, Melancólico e Brilhante'}
- Ritmo e Andamento: ${rhythm || 'Andante Rítmico (94 BPM, compasso alternado)'}
- Foco em Romance Inteligente: ${romanticFocus ? 'Sim, explorar a conexão entre intelectos, vulnerabilidade e paixão lúcida' : 'Explorar narrativa filosófica/existencial profunda'}
- Nível de Complexidade: ${complexityLevel || 'Máximo / Poesia e Harmonia Avançada'}
- Diretivas Adicionais do Usuário: ${customDirectives || 'Foque em lírica memorável e arranjos vívidos.'}

Retorne exclusivamente um JSON válido com a seguinte estrutura.`;

    const response = await callGemini(ai, userPrompt, {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          synopsis: { type: Type.STRING },
          stylePrompt: { type: Type.STRING },
          lyrics: { type: Type.STRING },
          mood: { type: Type.STRING },
          rhythm: { type: Type.STRING },
          nanoBananaPrompt: { type: Type.STRING },
          bandInfo: {
            type: Type.OBJECT,
            properties: {
              bandName: { type: Type.STRING },
              concept: { type: Type.STRING },
              members: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    visualDescription: { type: Type.STRING },
                  },
                  required: ['name', 'role', 'visualDescription'],
                },
              },
            },
            required: ['bandName', 'concept', 'members'],
          },
        },
        required: ['title', 'synopsis', 'stylePrompt', 'lyrics', 'mood', 'rhythm', 'nanoBananaPrompt', 'bandInfo'],
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({ success: true, composition: parsed });
  } catch (err: any) {
    console.error('Error generating Suno composition with Gemini:', err);
    res.status(500).json({
      error: 'Falha ao gerar composição via Gemini.',
      details: err?.message || String(err),
    });
  }
});

// 10. Gemini: Gerador Dedicado de Integrantes da Banda para Nano Banana
apiApp.post('/api/gemini/generate-band', async (req: Request, res: Response): Promise<void> => {
  const { bandGenre, bandTheme, aestheticStyle, memberCount } = req.body || {};
  const ai = getGeminiClient();

  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY não configurada no servidor.',
    });
    return;
  }

  try {
    const prompt = `Crie a identidade visual e os integrantes de uma banda conceitual fictícia para gerar imagens fotográficas cinematográficas no Nano Banana / Midjourney.
Gênero da Banda: ${bandGenre || 'Baroque Math-Pop & Neo-Soul'}
Tema / Conceito: ${bandTheme || 'Romance intelectual, estética retrofuturista, cafeína e física quântica'}
Estética Visual: ${aestheticStyle || 'Editorial Vogue / Chiaroscuro 1970s Kodachrome Film / Streetwear Elegante'}
Número de Integrantes: ${memberCount || '3 a 4'}

Retorne um JSON com:
- bandName
- bio
- nanoBananaMainPrompt: prompt em inglês pronto para copiar e colar no Nano Banana para gerar o retrato do grupo
- members: array de { name, instrument, personality, lookDescription, nanoBananaSoloPrompt }`;

    const response = await callGemini(ai, prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bandName: { type: Type.STRING },
          bio: { type: Type.STRING },
          nanoBananaMainPrompt: { type: Type.STRING },
          members: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                instrument: { type: Type.STRING },
                personality: { type: Type.STRING },
                lookDescription: { type: Type.STRING },
                nanoBananaSoloPrompt: { type: Type.STRING },
              },
              required: ['name', 'instrument', 'personality', 'lookDescription', 'nanoBananaSoloPrompt'],
            },
          },
        },
        required: ['bandName', 'bio', 'nanoBananaMainPrompt', 'members'],
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, band: parsed });
  } catch (err: any) {
    console.error('Error generating band with Gemini:', err);
    res.status(500).json({ error: 'Erro ao gerar integrantes da banda.', details: err?.message });
  }
});

// 11. Supabase: Status e Contagem das 4 Tabelas
apiApp.get('/api/supabase/status', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Acesso restrito ao criador.' });
    return;
  }

  const configured = isSupabaseConfigured();
  if (!configured) {
    res.json({
      configured: false,
      counts: null,
    });
    return;
  }

  try {
    const counts = await getSupabaseTableCounts();
    res.json({
      configured: true,
      counts,
    });
  } catch (err: any) {
    console.error('Error checking Supabase status:', err);
    res.status(500).json({
      configured: true,
      counts: null,
      error: err?.message || 'Erro ao consultar tabelas no Supabase.',
    });
  }
});

// 11.1. Supabase: Inspecionar todas as tabelas e buckets do projeto conectado
apiApp.get('/api/supabase/inspect', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Acesso restrito ao criador.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(400).json({ error: 'Supabase não configurado.' });
    return;
  }

  try {
    const info = await inspectSupabaseCatalog();
    res.json({ success: true, ...info });
  } catch (err: any) {
    console.error('Error inspecting Supabase catalog:', err);
    res.status(500).json({ error: err?.message || 'Erro ao inspecionar Supabase.' });
  }
});

// 11.2. Supabase: Gerar URL assinada para upload direto do navegador ao Supabase Storage (bypassa limite de 4.5MB da Vercel/Netlify)
apiApp.post('/api/supabase/signed-upload-url', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Sessão de criador expirada ou inválida. Faça login novamente.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: 'SUPABASE_URL não configurada nas variáveis de ambiente do servidor.',
    });
    return;
  }

  if (!isSupabaseWriteConfigured()) {
    res.status(403).json({
      error: `Supabase em modo somente leitura (role atual: ${getSupabaseKeyRole()}). Defina SUPABASE_SECRET_KEY (sb_secret_...) ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor.`,
    });
    return;
  }

  const rawFolder = req.body?.folder === 'covers' ? 'covers' : 'tracks';
  const rawName = typeof req.body?.filename === 'string' ? req.body.filename : 'file';
  const ext = path.extname(rawName).toLowerCase() || (rawFolder === 'tracks' ? '.mp3' : '.jpg');
  const safeExt = ext.replace(/[^a-z0-9.]/g, '') || (rawFolder === 'tracks' ? '.mp3' : '.jpg');
  const storagePath = `${rawFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${safeExt}`;

  try {
    const signed = await createSupabaseSignedUploadUrl(storagePath);
    res.json(signed);
  } catch (err: any) {
    console.error('Error creating Supabase signed upload URL:', err);
    res.status(500).json({ error: err?.message || 'Erro ao gerar URL de upload do Supabase Storage.' });
  }
});

// 12. Supabase: Retorna o Script SQL para Criação das Tabelas em Novo Banco
apiApp.get('/api/supabase/sql', (req: Request, res: Response): void => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Acesso restrito ao criador.' });
    return;
  }

  try {
    const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    const sql = fs.existsSync(schemaPath)
      ? fs.readFileSync(schemaPath, 'utf-8')
      : '-- Arquivo supabase/schema.sql não encontrado.';
    res.json({ sql });
  } catch (err: any) {
    res.status(500).json({ error: 'Não foi possível ler supabase/schema.sql.' });
  }
});

// 13. Supabase: Importar Músicas, Capas, Imagens da Banda e Letras para o Acervo da Rádio
apiApp.post('/api/supabase/import', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Sessão de criador inválida ou expirada.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error:
        'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) nos Secrets do ambiente.',
    });
    return;
  }

  try {
    const { songs: importedSongs, breakdown } = await importSongsFromSupabase();

    if (isBlobConfigured()) {
      const existingSongs = await listSongsFromBlob();
      const existingById = new Map(existingSongs.map((s) => [s.id, s]));
      let importedCount = 0;
      let updatedCount = 0;

      for (const song of importedSongs) {
        if (existingById.has(song.id)) {
          updatedCount++;
        } else {
          importedCount++;
        }
        await saveSongMetadataToBlob(song);
      }

      const mergedSongs = await listSongsFromBlob();
      res.json({
        success: true,
        importedCount,
        updatedCount,
        totalSongs: mergedSongs.length,
        breakdown,
        songs: mergedSongs,
      });
      return;
    }

    const currentSongs = loadLocalSongs();
    const mergedMap = new Map<string, StoredSong>();
    for (const song of currentSongs) {
      mergedMap.set(song.id, song);
    }

    let importedCount = 0;
    let updatedCount = 0;
    for (const song of importedSongs) {
      if (mergedMap.has(song.id)) {
        updatedCount++;
      } else {
        importedCount++;
      }
      mergedMap.set(song.id, song);
    }

    const mergedSongs = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
      return timeB - timeA;
    });

    saveLocalSongs(mergedSongs);
    res.json({
      success: true,
      importedCount,
      updatedCount,
      totalSongs: mergedSongs.length,
      breakdown,
      songs: mergedSongs,
    });
  } catch (err: any) {
    console.error('Error importing from Supabase:', err);
    res.status(500).json({
      error: err?.message || 'Erro ao importar dados do Supabase.',
    });
  }
});

// 14. Supabase: Exportar / Sincronizar Acervo Atual para as 4 Tabelas do Supabase
apiApp.post('/api/supabase/export', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Sessão de criador inválida ou expirada.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error:
        'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nos Secrets do ambiente.',
    });
    return;
  }

  try {
    const currentSongs = isBlobConfigured() ? await listSongsFromBlob() : loadLocalSongs();
    const { exportedCount } = await exportSongsToSupabase(currentSongs);
    const counts = await getSupabaseTableCounts();
    res.json({
      success: true,
      exportedCount,
      counts,
    });
  } catch (err: any) {
    console.error('Error exporting to Supabase:', err);
    res.status(500).json({
      error: err?.message || 'Erro ao exportar acervo para o Supabase.',
    });
  }
});

// 15. Supabase: Migrar catálogo e arquivos de mídia de uma instância remota (ex: betosradioai.ai.studio)
apiApp.post('/api/supabase/migrate-remote', async (req: Request, res: Response): Promise<void> => {
  if (!isValidAdminRequest(req)) {
    res.status(401).json({ error: 'Sessão de criador inválida ou expirada.' });
    return;
  }

  if (!isSupabaseWriteConfigured()) {
    res.status(503).json({
      error: 'Supabase write key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY) não configurada.',
    });
    return;
  }

  const rawSource = typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
  if (!rawSource || !/^https?:\/\//i.test(rawSource)) {
    res.status(400).json({ error: 'Informe uma URL base válida (ex: https://betosradioai.ai.studio).' });
    return;
  }

  const baseUrl = rawSource.replace(/\/+$/, '');

  try {
    const catalogRes = await fetch(`${baseUrl}/api/songs`, { cache: 'no-store' });
    if (!catalogRes.ok) {
      res.status(502).json({ error: `Falha ao ler ${baseUrl}/api/songs (HTTP ${catalogRes.status}).` });
      return;
    }

    const catalogJson = (await catalogRes.json()) as { songs?: StoredSong[] };
    const remoteSongs = Array.isArray(catalogJson.songs) ? catalogJson.songs : [];
    if (remoteSongs.length === 0) {
      res.json({ success: true, migratedCount: 0, message: 'Nenhuma música encontrada na origem.' });
      return;
    }

    const guessContentType = (urlPath: string, kind: 'audio' | 'image') => {
      const lower = urlPath.toLowerCase();
      if (kind === 'audio') {
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.m4a')) return 'audio/mp4';
        if (lower.endsWith('.flac')) return 'audio/flac';
        return 'audio/mpeg';
      }
      if (lower.endsWith('.png')) return 'image/png';
      if (lower.endsWith('.webp')) return 'image/webp';
      return 'image/jpeg';
    };

    const migrateAsset = async (
      assetUrl: string | undefined,
      folder: 'tracks' | 'covers',
      fallbackFilename: string
    ): Promise<string | undefined> => {
      if (!assetUrl) return undefined;
      if (!assetUrl.startsWith('/')) return assetUrl;

      const fullUrl = `${baseUrl}${assetUrl}`;
      const buf = await fetchUrlBuffer(fullUrl);
      if (!buf) {
        return fullUrl;
      }

      const filename = path.basename(assetUrl) || fallbackFilename;
      const contentType = guessContentType(filename, folder === 'tracks' ? 'audio' : 'image');

      try {
        return await uploadMediaToSupabaseStorage(`${folder}/${filename}`, buf, contentType);
      } catch (storageErr: any) {
        console.warn(`Fallback local for ${folder}/${filename}:`, storageErr?.message);
        ensureLocalDirs();
        const targetDir = folder === 'tracks' ? TRACKS_DIR : COVERS_DIR;
        fs.writeFileSync(path.resolve(targetDir, filename), buf);
        return `/uploads/${folder}/${filename}`;
      }
    };

    const migratedSongs: StoredSong[] = [];
    for (const song of remoteSongs) {
      const migratedAudio = await migrateAsset(song.audioUrl, 'tracks', `${song.id}.mp3`);
      const migratedCover = await migrateAsset(song.coverUrl, 'covers', `${song.id}-cover.jpeg`);
      const migratedBandPhoto = await migrateAsset(song.bandPhotoUrl, 'covers', `${song.id}-band.jpeg`);

      migratedSongs.push({
        ...song,
        audioUrl: migratedAudio || song.audioUrl,
        coverUrl: migratedCover || song.coverUrl,
        ...(migratedBandPhoto ? { bandPhotoUrl: migratedBandPhoto } : {}),
      });
    }

    await exportSongsToSupabase(migratedSongs);

    // Sync local JSON fallback too
    const localSongs = loadLocalSongs();
    const mergedMap = new Map<string, StoredSong>();
    for (const s of localSongs) mergedMap.set(s.id, s);
    for (const s of migratedSongs) mergedMap.set(s.id, s);
    saveLocalSongs(
      Array.from(mergedMap.values()).sort((a, b) => {
        const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tB - tA;
      })
    );

    const counts = await getSupabaseTableCounts();
    res.json({
      success: true,
      migratedCount: migratedSongs.length,
      counts,
      songs: migratedSongs.map((s) => ({ id: s.id, title: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl })),
    });
  } catch (err: any) {
    console.error('Error migrating remote catalog to Supabase:', err);
    res.status(500).json({ error: err?.message || 'Erro ao migrar catálogo remoto.' });
  }
});

export default apiApp;
