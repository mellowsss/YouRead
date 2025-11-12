export interface Manga {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  status?: string;
  chapters?: number;
  author?: string;
  genres?: string[];
  manganatoUrl?: string;
}

export interface TrackedManga extends Manga {
  lastReadChapter?: number;
  totalChapters?: number;
  readingStatus: 'reading' | 'completed' | 'planning' | 'paused';
  dateAdded: string;
  lastUpdated: string;
}

export interface MangaSearchResult {
  id: string;
  title: string;
  coverImage?: string;
  description?: string;
  altTitles?: string[];
}

