export interface BandMember {
  name: string;
  role: string;
  visualDescription: string;
  nanoBananaSoloPrompt?: string;
}

export interface BandInfo {
  bandName: string;
  concept: string;
  bio?: string;
  members: BandMember[];
  nanoBananaMainPrompt?: string;
}

export interface Song {
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
  bandInfo?: BandInfo;
  newsArticle?: any;
  blobPathname?: string;
  fileSize?: number;
  likes?: number;
  createdAt?: string;
}

export interface GeneratedComposition {
  title: string;
  synopsis: string;
  stylePrompt: string;
  lyrics: string;
  mood: string;
  rhythm: string;
  nanoBananaPrompt: string;
  bandInfo: BandInfo;
  newsArticle?: any;
}

export interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'smart_tv' | 'nest_speaker' | 'soundbar' | 'airplay' | 'bluetooth';
  location: string;
  quality: string;
  connected: boolean;
}
