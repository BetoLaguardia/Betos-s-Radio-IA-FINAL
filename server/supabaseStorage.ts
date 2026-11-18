import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StoredSong } from './blobStorage';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
const SUPABASE_MEDIA_BUCKET = 'betos-radio-media';

interface RadioSongRow {
  id: string;
  title: string;
  artist: string;
  album: string;
  audio_url: string;
  style_prompt?: string | null;
  mood?: string | null;
  rhythm?: string | null;
  duration?: number | null;
  source_url?: string | null;
  suno_id?: string | null;
  likes?: number | null;
  created_at?: string | null;
}

interface RadioCoverRow {
  id: string;
  song_id: string;
  cover_url: string;
  nano_banana_prompt?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
}

interface RadioBandImageRow {
  id: string;
  song_id: string;
  band_name: string;
  concept?: string | null;
  bio?: string | null;
  band_photo_url?: string | null;
  members?: any;
  nano_banana_main_prompt?: string | null;
  created_at?: string | null;
}

interface RadioLyricsRow {
  id: string;
  song_id: string;
  lyrics: string;
  language?: string | null;
  has_timestamps?: boolean | null;
  created_at?: string | null;
}

export interface SupabaseTableCounts {
  songs: number;
  covers: number;
  bandImages: number;
  lyrics: number;
}

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const writeKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  const readKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  return {
    url,
    writeKey,
    readKey,
    key: writeKey || readKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key && url.startsWith('https://'));
}

export function isSupabaseWriteConfigured(): boolean {
  const { url, writeKey } = getSupabaseEnv();
  return Boolean(url && writeKey && url.startsWith('https://'));
}

function getSupabaseClient(): SupabaseClient {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY) nas variáveis de ambiente.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function mapSupabaseRowsToSong(
  row: RadioSongRow,
  cover?: RadioCoverRow,
  band?: RadioBandImageRow,
  lyr?: RadioLyricsRow
): StoredSong {
  const bandInfo = band
    ? {
        bandName: band.band_name || row.artist,
        concept: band.concept || '',
        ...(band.bio ? { bio: band.bio } : {}),
        members: Array.isArray(band.members) ? band.members : [],
        ...(band.nano_banana_main_prompt
          ? { nanoBananaMainPrompt: band.nano_banana_main_prompt }
          : {}),
      }
    : undefined;

  const nanoBananaPrompt =
    cover?.nano_banana_prompt || band?.nano_banana_main_prompt || undefined;

  return {
    id: row.id,
    title: row.title || 'Faixa Sem Título',
    artist: row.artist || "Beto's Radio",
    album: row.album || 'Acervo Supabase',
    audioUrl: row.audio_url,
    coverUrl: cover?.cover_url || DEFAULT_COVER,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.suno_id !== undefined ? { sunoId: row.suno_id } : {}),
    stylePrompt: row.style_prompt || 'Indie Chamber Pop / Complex Harmonies',
    mood: row.mood || 'Contemplativo & Melancólico',
    rhythm: row.rhythm || 'Andante Moderato (100 BPM)',
    duration: typeof row.duration === 'number' ? row.duration : 180,
    lyrics: lyr?.lyrics || '[Letra não cadastrada na tabela radio_lyrics]',
    ...(nanoBananaPrompt ? { nanoBananaPrompt } : {}),
    ...(band?.band_photo_url ? { bandPhotoUrl: band.band_photo_url } : {}),
    ...(bandInfo ? { bandInfo } : {}),
    likes: typeof row.likes === 'number' ? row.likes : 0,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function getSupabaseTableCounts(): Promise<SupabaseTableCounts> {
  const supabase = getSupabaseClient();

  const [songsRes, coversRes, bandsRes, lyricsRes] = await Promise.all([
    supabase.from('radio_songs').select('*', { count: 'exact', head: true }),
    supabase.from('radio_covers').select('*', { count: 'exact', head: true }),
    supabase.from('radio_band_images').select('*', { count: 'exact', head: true }),
    supabase.from('radio_lyrics').select('*', { count: 'exact', head: true }),
  ]);

  const firstError = songsRes.error || coversRes.error || bandsRes.error || lyricsRes.error;
  if (firstError) {
    throw new Error(`Erro ao consultar tabelas no Supabase: ${firstError.message}`);
  }

  return {
    songs: songsRes.count ?? 0,
    covers: coversRes.count ?? 0,
    bandImages: bandsRes.count ?? 0,
    lyrics: lyricsRes.count ?? 0,
  };
}

export async function inspectSupabaseCatalog() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error('Supabase não configurado.');
  }

  const supabase = getSupabaseClient();

  let tables: Array<{ name: string; count: number | null; columns: string[]; error?: string }> = [];
  try {
    const restRes = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (restRes.ok) {
      const spec = (await restRes.json()) as {
        paths?: Record<string, unknown>;
        definitions?: Record<string, { properties?: Record<string, unknown> }>;
      };
      const tableNames = Object.keys(spec.paths || {})
        .map((p) => p.replace(/^\//, ''))
        .filter((name) => name && !name.startsWith('rpc/'));

      tables = await Promise.all(
        tableNames.map(async (name) => {
          const { count, error } = await supabase
            .from(name)
            .select('*', { count: 'exact', head: true });
          const columns = Object.keys(spec.definitions?.[name]?.properties || {});
          return {
            name,
            count: count ?? null,
            columns,
            ...(error ? { error: error.message } : {}),
          };
        })
      );
    }
  } catch (err: any) {
    console.warn('Error inspecting Supabase OpenAPI spec:', err?.message);
  }

  let buckets: Array<{ name: string; public: boolean; fileCount: number; sampleFiles: string[] }> = [];
  try {
    const { data: bucketList } = await supabase.storage.listBuckets();
    if (Array.isArray(bucketList)) {
      buckets = await Promise.all(
        bucketList.map(async (b) => {
          const { data: files } = await supabase.storage.from(b.name).list('', { limit: 100 });
          return {
            name: b.name,
            public: Boolean(b.public),
            fileCount: files?.length ?? 0,
            sampleFiles: (files || []).slice(0, 10).map((f) => f.name),
          };
        })
      );
    }
  } catch (err: any) {
    console.warn('Error inspecting Supabase storage buckets:', err?.message);
  }

  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  return { host, tables, buckets };
}

export async function findSongInSupabase(id: string): Promise<StoredSong | null> {
  const supabase = getSupabaseClient();

  const [songRes, coverRes, bandRes, lyrRes] = await Promise.all([
    supabase.from('radio_songs').select('*').eq('id', id).maybeSingle(),
    supabase.from('radio_covers').select('*').eq('song_id', id),
    supabase.from('radio_band_images').select('*').eq('song_id', id).maybeSingle(),
    supabase.from('radio_lyrics').select('*').eq('song_id', id).maybeSingle(),
  ]);

  if (songRes.error) {
    throw new Error(`Erro ao buscar música no Supabase: ${songRes.error.message}`);
  }
  if (!songRes.data) {
    return null;
  }

  const covers = (coverRes.data || []) as RadioCoverRow[];
  const primaryCover = covers.find((c) => c.is_primary) || covers[0];

  return mapSupabaseRowsToSong(
    songRes.data as RadioSongRow,
    primaryCover,
    (bandRes.data as RadioBandImageRow | null) || undefined,
    (lyrRes.data as RadioLyricsRow | null) || undefined
  );
}

export async function importSongsFromSupabase(): Promise<{
  songs: StoredSong[];
  breakdown: SupabaseTableCounts;
}> {
  const supabase = getSupabaseClient();

  const [songsRes, coversRes, bandsRes, lyricsRes] = await Promise.all([
    supabase.from('radio_songs').select('*').order('created_at', { ascending: false }),
    supabase.from('radio_covers').select('*'),
    supabase.from('radio_band_images').select('*'),
    supabase.from('radio_lyrics').select('*'),
  ]);

  if (songsRes.error) {
    throw new Error(`Erro ao importar tabela radio_songs: ${songsRes.error.message}`);
  }
  if (coversRes.error) {
    throw new Error(`Erro ao importar tabela radio_covers: ${coversRes.error.message}`);
  }
  if (bandsRes.error) {
    throw new Error(`Erro ao importar tabela radio_band_images: ${bandsRes.error.message}`);
  }
  if (lyricsRes.error) {
    throw new Error(`Erro ao importar tabela radio_lyrics: ${lyricsRes.error.message}`);
  }

  const songRows = (songsRes.data || []) as RadioSongRow[];
  const coverRows = (coversRes.data || []) as RadioCoverRow[];
  const bandRows = (bandsRes.data || []) as RadioBandImageRow[];
  const lyricsRows = (lyricsRes.data || []) as RadioLyricsRow[];

  const coversBySongId = new Map<string, RadioCoverRow>();
  for (const cover of coverRows) {
    const existing = coversBySongId.get(cover.song_id);
    if (!existing || cover.is_primary) {
      coversBySongId.set(cover.song_id, cover);
    }
  }

  const bandsBySongId = new Map<string, RadioBandImageRow>();
  for (const band of bandRows) {
    bandsBySongId.set(band.song_id, band);
  }

  const lyricsBySongId = new Map<string, RadioLyricsRow>();
  for (const lyr of lyricsRows) {
    lyricsBySongId.set(lyr.song_id, lyr);
  }

  const importedSongs: StoredSong[] = songRows
    .filter((row) => Boolean(row.audio_url))
    .map((row) =>
      mapSupabaseRowsToSong(
        row,
        coversBySongId.get(row.id),
        bandsBySongId.get(row.id),
        lyricsBySongId.get(row.id)
      )
    );

  return {
    songs: importedSongs,
    breakdown: {
      songs: songRows.length,
      covers: coverRows.length,
      bandImages: bandRows.length,
      lyrics: lyricsRows.length,
    },
  };
}

export async function exportSongsToSupabase(songs: StoredSong[]): Promise<{ exportedCount: number }> {
  if (!isSupabaseWriteConfigured()) {
    throw new Error(
      'Para enviar faixas para o Supabase pelo servidor, defina SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }

  const supabase = getSupabaseClient();
  if (songs.length === 0) {
    return { exportedCount: 0 };
  }

  const songPayloads = songs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    audio_url: s.audioUrl,
    style_prompt: s.stylePrompt,
    mood: s.mood,
    rhythm: s.rhythm,
    duration: typeof s.duration === 'number' ? Math.round(s.duration) : 180,
    source_url: s.sourceUrl || null,
    suno_id: s.sunoId || null,
    likes: typeof s.likes === 'number' ? s.likes : 0,
    created_at: s.createdAt && !Number.isNaN(Date.parse(s.createdAt))
      ? new Date(s.createdAt).toISOString()
      : new Date().toISOString(),
  }));

  const { error: songsErr } = await supabase
    .from('radio_songs')
    .upsert(songPayloads, { onConflict: 'id' });
  if (songsErr) {
    throw new Error(`Erro ao enviar radio_songs: ${songsErr.message}`);
  }

  const coverPayloads = songs.map((s) => ({
    song_id: s.id,
    cover_url: s.coverUrl || DEFAULT_COVER,
    nano_banana_prompt: s.nanoBananaPrompt || null,
    is_primary: true,
  }));

  const { error: coversErr } = await supabase
    .from('radio_covers')
    .upsert(coverPayloads, { onConflict: 'song_id,is_primary' });
  if (coversErr) {
    throw new Error(`Erro ao enviar radio_covers: ${coversErr.message}`);
  }

  const bandPayloads = songs
    .filter((s) => s.bandPhotoUrl || s.bandInfo)
    .map((s) => ({
      song_id: s.id,
      band_name: s.bandInfo?.bandName || s.artist,
      concept: s.bandInfo?.concept || null,
      bio: s.bandInfo?.bio || null,
      band_photo_url: s.bandPhotoUrl || null,
      members: Array.isArray(s.bandInfo?.members) ? s.bandInfo.members : [],
      nano_banana_main_prompt: s.bandInfo?.nanoBananaMainPrompt || s.nanoBananaPrompt || null,
    }));

  if (bandPayloads.length > 0) {
    const { error: bandsErr } = await supabase
      .from('radio_band_images')
      .upsert(bandPayloads, { onConflict: 'song_id' });
    if (bandsErr) {
      throw new Error(`Erro ao enviar radio_band_images: ${bandsErr.message}`);
    }
  }

  const lyricsPayloads = songs
    .filter((s) => Boolean(s.lyrics && s.lyrics.trim()))
    .map((s) => ({
      song_id: s.id,
      lyrics: s.lyrics,
      language: 'pt-BR',
      has_timestamps: /\[\d{1,2}:\d{2}/.test(s.lyrics),
    }));

  if (lyricsPayloads.length > 0) {
    const { error: lyricsErr } = await supabase
      .from('radio_lyrics')
      .upsert(lyricsPayloads, { onConflict: 'song_id' });
    if (lyricsErr) {
      throw new Error(`Erro ao enviar radio_lyrics: ${lyricsErr.message}`);
    }
  }

  return { exportedCount: songs.length };
}

export async function upsertSongToSupabase(song: StoredSong): Promise<StoredSong> {
  await exportSongsToSupabase([song]);
  return song;
}

export async function updateSongLikesInSupabase(
  id: string,
  likes: number
): Promise<StoredSong | null> {
  if (!isSupabaseWriteConfigured()) {
    throw new Error(
      'Para atualizar curtidas no Supabase, defina SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }

  const supabase = getSupabaseClient();
  const safeLikes = Math.max(0, Math.round(likes));
  const { error } = await supabase
    .from('radio_songs')
    .update({ likes: safeLikes })
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao atualizar curtidas no Supabase: ${error.message}`);
  }

  return findSongInSupabase(id);
}

export async function deleteSongFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseWriteConfigured()) {
    throw new Error(
      'Para excluir músicas no Supabase, defina SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('radio_songs').delete().eq('id', id);
  if (error) {
    throw new Error(`Erro ao excluir música no Supabase: ${error.message}`);
  }
  return true;
}

export async function uploadMediaToSupabaseStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (!isSupabaseWriteConfigured()) {
    throw new Error(
      'Para enviar arquivos ao Supabase Storage, defina SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }

  const supabase = getSupabaseClient();
  const cleanPath = storagePath.replace(/^\/+/, '');

  let { error } = await supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .upload(cleanPath, buffer, {
      contentType,
      upsert: true,
    });

  if (error && /bucket.*not found/i.test(error.message)) {
    await supabase.storage.createBucket(SUPABASE_MEDIA_BUCKET, { public: true });
    const retry = await supabase.storage
      .from(SUPABASE_MEDIA_BUCKET)
      .upload(cleanPath, buffer, {
        contentType,
        upsert: true,
      });
    error = retry.error;
  }

  if (error) {
    throw new Error(`Erro ao enviar mídia para o Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}
