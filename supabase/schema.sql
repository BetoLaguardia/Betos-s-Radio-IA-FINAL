-- =============================================================================
-- Beto's Radio — Schema SQL para Novo Banco Supabase
-- Execute este script no SQL Editor de um NOVO projeto Supabase.
-- Ele cria 4 tabelas dedicadas (músicas, capas, imagens da banda e letras),
-- índices, políticas de segurança (RLS) e bucket de mídia opcional.
-- =============================================================================

-- Extensão necessária para geração de UUIDs (já ativa na maioria dos projetos Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Músicas (radio_songs)
CREATE TABLE IF NOT EXISTS public.radio_songs (
  id TEXT PRIMARY KEY DEFAULT ('song-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Beto''s Radio',
  album TEXT NOT NULL DEFAULT 'Estúdio Original',
  audio_url TEXT NOT NULL,
  style_prompt TEXT NOT NULL DEFAULT 'Indie Chamber Pop / Complex Harmonies',
  mood TEXT NOT NULL DEFAULT 'Contemplativo & Melancólico',
  rhythm TEXT NOT NULL DEFAULT 'Andante Moderato (100 BPM)',
  duration INTEGER NOT NULL DEFAULT 180,
  source_url TEXT,
  suno_id TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Capas dos Álbuns / Singles (radio_covers)
CREATE TABLE IF NOT EXISTS public.radio_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL REFERENCES public.radio_songs(id) ON DELETE CASCADE,
  cover_url TEXT NOT NULL,
  nano_banana_prompt TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT radio_covers_song_unique UNIQUE (song_id, is_primary)
);

-- 3. Tabela de Imagens e Dados da Banda (radio_band_images)
CREATE TABLE IF NOT EXISTS public.radio_band_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL UNIQUE REFERENCES public.radio_songs(id) ON DELETE CASCADE,
  band_name TEXT NOT NULL,
  concept TEXT,
  bio TEXT,
  band_photo_url TEXT,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  nano_banana_main_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Letras das Músicas (radio_lyrics)
CREATE TABLE IF NOT EXISTS public.radio_lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL UNIQUE REFERENCES public.radio_songs(id) ON DELETE CASCADE,
  lyrics TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  has_timestamps BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas e ordenação rápidas
CREATE INDEX IF NOT EXISTS idx_radio_songs_created_at ON public.radio_songs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_covers_song_id ON public.radio_covers (song_id);
CREATE INDEX IF NOT EXISTS idx_radio_band_images_song_id ON public.radio_band_images (song_id);
CREATE INDEX IF NOT EXISTS idx_radio_lyrics_song_id ON public.radio_lyrics (song_id);

-- Row Level Security (RLS)
ALTER TABLE public.radio_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_band_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_lyrics ENABLE ROW LEVEL SECURITY;

-- Leitura pública para o player da rádio (anon e authenticated)
DROP POLICY IF EXISTS "Public read radio_songs" ON public.radio_songs;
CREATE POLICY "Public read radio_songs"
  ON public.radio_songs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read radio_covers" ON public.radio_covers;
CREATE POLICY "Public read radio_covers"
  ON public.radio_covers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read radio_band_images" ON public.radio_band_images;
CREATE POLICY "Public read radio_band_images"
  ON public.radio_band_images FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read radio_lyrics" ON public.radio_lyrics;
CREATE POLICY "Public read radio_lyrics"
  ON public.radio_lyrics FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita liberada para usuários autenticados e service_role
DROP POLICY IF EXISTS "Authenticated write radio_songs" ON public.radio_songs;
CREATE POLICY "Authenticated write radio_songs"
  ON public.radio_songs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write radio_covers" ON public.radio_covers;
CREATE POLICY "Authenticated write radio_covers"
  ON public.radio_covers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write radio_band_images" ON public.radio_band_images;
CREATE POLICY "Authenticated write radio_band_images"
  ON public.radio_band_images FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write radio_lyrics" ON public.radio_lyrics;
CREATE POLICY "Authenticated write radio_lyrics"
  ON public.radio_lyrics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- (Opcional) Bucket público no Supabase Storage para hospedar MP3, capas e fotos de bandas
INSERT INTO storage.buckets (id, name, public)
VALUES ('betos-radio-media', 'betos-radio-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read betos-radio-media" ON storage.objects;
CREATE POLICY "Public read betos-radio-media"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'betos-radio-media');
