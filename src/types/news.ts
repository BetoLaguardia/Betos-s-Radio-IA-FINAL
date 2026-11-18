export interface NewsQuote {
  text: string;
  speaker: string;
}

export interface NewsArticle {
  id: string;
  songId?: string;
  title: string;
  subtitle: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  leadParagraph: string;
  body: string[];
  bandName: string;
  songTitle: string;
  albumCoverUrl: string; // Imagem 1: Capa do Álbum / Música
  bandPhotoUrl: string; // Imagem 2: Foto dos Integrantes da Banda
  quote?: NewsQuote;
  featured?: boolean;
}
