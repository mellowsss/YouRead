import { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { TrackedManga, MangaSearchResult } from './types';
import { getMangaDetails } from './services/mangaApi';
import { getManganatoDetailsById } from './services/manganatoApi';
import {
  getTrackedManga,
  addTrackedManga,
  updateTrackedManga,
  removeTrackedManga,
} from './services/storage';
import SearchBar from './components/SearchBar';
import MangaCard from './components/MangaCard';
import MangaModal from './components/MangaModal';

function App() {
  const [trackedManga, setTrackedManga] = useState<TrackedManga[]>([]);
  const [editingManga, setEditingManga] = useState<TrackedManga | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reading' | 'completed' | 'paused' | 'planning'>('all');

  useEffect(() => {
    setTrackedManga(getTrackedManga());
  }, []);

  const handleSelectManga = async (mangaResult: MangaSearchResult) => {
    let details = null;
    
    // Check if it's a MangaNato manga
    if (mangaResult.id.startsWith('manganato_')) {
      details = await getManganatoDetailsById(mangaResult.id);
    } else {
      // MangaDex manga
      details = await getMangaDetails(mangaResult.id);
    }
    
    if (details) {
      const newManga: TrackedManga = {
        ...details,
        readingStatus: 'planning',
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      addTrackedManga(newManga);
      setTrackedManga(getTrackedManga());
    }
  };

  const handleUpdateManga = (id: string, updates: Partial<TrackedManga>) => {
    updateTrackedManga(id, updates);
    setTrackedManga(getTrackedManga());
  };

  const handleRemoveManga = (id: string) => {
    if (confirm('Are you sure you want to remove this manga from your list?')) {
      removeTrackedManga(id);
      setTrackedManga(getTrackedManga());
    }
  };

  const handleEditManga = (manga: TrackedManga) => {
    setEditingManga(manga);
    setIsModalOpen(true);
  };

  const handleSaveManga = (updates: Partial<TrackedManga>) => {
    if (editingManga) {
      handleUpdateManga(editingManga.id, updates);
    }
  };

  const filteredManga = filter === 'all'
    ? trackedManga
    : trackedManga.filter(m => m.readingStatus === filter);

  const stats = {
    total: trackedManga.length,
    reading: trackedManga.filter(m => m.readingStatus === 'reading').length,
    completed: trackedManga.filter(m => m.readingStatus === 'completed').length,
    planning: trackedManga.filter(m => m.readingStatus === 'planning').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary-600" />
              <h1 className="text-3xl font-bold text-gray-900">YouRead</h1>
            </div>
            <div className="flex items-center gap-2">
              <SearchBar onSelectManga={handleSelectManga} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Manga</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{stats.reading}</div>
              <div className="text-sm text-blue-600">Reading</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">{stats.completed}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.planning}</div>
              <div className="text-sm text-gray-600">Planning</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(['all', 'reading', 'completed', 'paused', 'planning'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Manga List */}
        {filteredManga.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No manga tracked yet' : `No ${filter} manga`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? 'Start tracking your manga by searching above'
                : `You don't have any manga with status "${filter}"`}
            </p>
            {filter === 'all' && (
              <div className="flex items-center justify-center gap-2 text-primary-600">
                <Plus className="w-5 h-5" />
                <span>Use the search bar to add manga</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredManga.map((manga) => (
              <MangaCard
                key={manga.id}
                manga={manga}
                onRemove={handleRemoveManga}
                onEdit={handleEditManga}
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      <MangaModal
        manga={editingManga}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingManga(null);
        }}
        onSave={handleSaveManga}
      />
    </div>
  );
}

export default App;

