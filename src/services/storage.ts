import { TrackedManga } from '../types';

const STORAGE_KEY = 'youread_tracked_manga';

export function getTrackedManga(): TrackedManga[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading from storage:', error);
    return [];
  }
}

export function saveTrackedManga(manga: TrackedManga[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manga));
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
}

export function addTrackedManga(manga: TrackedManga): void {
  const tracked = getTrackedManga();
  const exists = tracked.find(m => m.id === manga.id);
  
  if (!exists) {
    tracked.push(manga);
    saveTrackedManga(tracked);
  }
}

export function updateTrackedManga(id: string, updates: Partial<TrackedManga>): void {
  const tracked = getTrackedManga();
  const index = tracked.findIndex(m => m.id === id);
  
  if (index !== -1) {
    tracked[index] = {
      ...tracked[index],
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    saveTrackedManga(tracked);
  }
}

export function removeTrackedManga(id: string): void {
  const tracked = getTrackedManga();
  const filtered = tracked.filter(m => m.id !== id);
  saveTrackedManga(filtered);
}

