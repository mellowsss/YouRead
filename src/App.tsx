import { useState, useEffect, useRef } from 'react';
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
import Recommendations from './components/Recommendations';

function App() {
  const [trackedManga, setTrackedManga] = useState<TrackedManga[]>([]);
  const [editingManga, setEditingManga] = useState<TrackedManga | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reading' | 'completed' | 'paused' | 'planning'>('all');
  const [currentView, setCurrentView] = useState<'library' | 'recommendations'>('library');
  const trackedMangaRef = useRef<TrackedManga[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    trackedMangaRef.current = trackedManga;
  }, [trackedManga]);

  const handleExtensionManga = (manga: TrackedManga) => {
    // Check if manga already exists
    const existing = trackedMangaRef.current.find(m => m.id === manga.id);
    
    if (!existing) {
      const newManga: TrackedManga = {
        ...manga,
        readingStatus: manga.readingStatus || 'planning',
        dateAdded: manga.dateAdded || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      addTrackedManga(newManga);
      setTrackedManga(getTrackedManga());
      
      // Show notification (you can replace with a toast library)
      alert(`Added "${newManga.title}" to your library!`);
    } else {
      // Update existing manga
      handleUpdateManga(existing.id, {
        ...manga,
        lastUpdated: new Date().toISOString(),
      });
      alert(`Updated "${manga.title}" in your library!`);
    }
  };

  const handleExtensionMessage = (event: MessageEvent) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'ADD_MANGA') {
      handleExtensionManga(event.data.manga as TrackedManga);
    } else if (event.data.type === 'BULK_IMPORT') {
      handleBulkImport(event.data.mangaList as TrackedManga[]);
    }
  };

  const handleBulkImport = (mangaList: Partial<TrackedManga>[]) => {
    if (!Array.isArray(mangaList) || mangaList.length === 0) {
      console.error('Invalid manga list:', mangaList);
      alert('No manga data to import.');
      return;
    }
    
    console.log(`Starting bulk import of ${mangaList.length} manga...`);
    console.log('Sample manga data (first 3):', mangaList.slice(0, 3).map(m => ({
      id: m.id,
      title: m.title,
      coverImage: m.coverImage,
      coverImageType: typeof m.coverImage,
      hasCoverImage: !!m.coverImage
    })));
    
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const currentManga = getTrackedManga();
    
    mangaList.forEach((manga) => {
      try {
        if (!manga.id || !manga.title) {
          console.warn('Skipping invalid manga:', manga);
          skipped++;
          return;
        }
        
        const existing = currentManga.find(m => m.id === manga.id);
        
        if (!existing) {
          // Clean and validate cover image - preserve it if it exists
          let coverImage = manga.coverImage;
          console.log(`Processing manga "${manga.title}":`, {
            originalCoverImage: manga.coverImage,
            coverImageType: typeof manga.coverImage,
            coverImageValue: manga.coverImage
          });
          
          if (coverImage && typeof coverImage === 'string') {
            coverImage = coverImage.trim();
            if (coverImage === '') {
              coverImage = undefined;
            }
          } else if (coverImage === null || coverImage === undefined) {
            coverImage = undefined;
          }
          
          console.log(`Final coverImage for "${manga.title}":`, coverImage);
          
          const newManga: TrackedManga = {
            id: manga.id,
            title: manga.title,
            coverImage: coverImage, // Keep original URL - proxy will be applied in component
            manganatoUrl: manga.manganatoUrl,
            lastReadChapter: manga.lastReadChapter,
            totalChapters: manga.totalChapters || manga.chapters,
            readingStatus: manga.lastReadChapter ? 'reading' : 'planning',
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          };
          
          console.log(`Saving manga "${manga.title}" with coverImage:`, newManga.coverImage);
          addTrackedManga(newManga);
          added++;
        } else {
          // Update existing with new chapter info and cover image if missing
          const updates: Partial<TrackedManga> = {
            lastReadChapter: manga.lastReadChapter !== undefined 
              ? Math.max(manga.lastReadChapter || 0, existing.lastReadChapter || 0)
              : existing.lastReadChapter,
            totalChapters: manga.totalChapters || manga.chapters || existing.totalChapters,
            lastUpdated: new Date().toISOString(),
          };
          
          // If existing doesn't have cover image but new one does, update it
          if (!existing.coverImage && manga.coverImage) {
            let coverImage = manga.coverImage;
            if (coverImage && typeof coverImage === 'string') {
              coverImage = coverImage.trim();
              if (coverImage !== '') {
                updates.coverImage = coverImage;
                console.log(`Updating cover image for existing manga "${manga.title}":`, coverImage);
              }
            }
          }
          
          if (manga.lastReadChapter && manga.lastReadChapter > (existing.lastReadChapter || 0)) {
            updates.readingStatus = 'reading';
          }
          updateTrackedManga(existing.id, updates);
          updated++;
        }
      } catch (error) {
        console.error('Error processing manga:', manga, error instanceof Error ? error.message : String(error));
        skipped++;
      }
    });
    
    // Refresh the list
    const updatedList = getTrackedManga();
    
    // Debug: Check what was actually saved
    console.log('Verifying saved data - sample of saved manga:', updatedList.slice(0, 3).map(m => ({
      id: m.id,
      title: m.title,
      coverImage: m.coverImage,
      hasCoverImage: !!m.coverImage
    })));
    
    // Count how many have cover images
    const withImages = updatedList.filter(m => m.coverImage).length;
    console.log(`Total manga: ${updatedList.length}, With cover images: ${withImages}`);
    
    setTrackedManga(updatedList);
    
    console.log(`Import complete: ${added} added, ${updated} updated, ${skipped} skipped`);
    
    // Show success message
    if (added > 0 || updated > 0) {
      alert(`✅ Successfully imported ${added} new manga and updated ${updated} existing manga!`);
    } else if (skipped > 0) {
      alert(`⚠️ ${skipped} manga were skipped. They may already be in your library or have invalid data.`);
    } else {
      alert('No manga were imported. They may already be in your library.');
    }
  };

  useEffect(() => {
    setTrackedManga(getTrackedManga());
    
    // Check for manga data from extension (URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const mangaParam = urlParams.get('manga');
    const bulkImportParam = urlParams.get('bulkImport');
    const bulkImportFlag = urlParams.get('bulkImportFlag');
    
    // Handle bulk import from history (via flag - for large imports)
    if (bulkImportFlag === 'true') {
      // Listen for the response from extension
      const importListener = (event: MessageEvent) => {
        // Only accept messages from extension (check origin or just trust the data structure)
        if (event.data && event.data.type === 'BULK_IMPORT_DATA' && event.data.mangaList) {
          console.log(`Importing ${event.data.mangaList.length} manga from extension...`);
          handleBulkImport(event.data.mangaList);
          window.history.replaceState({}, document.title, window.location.pathname);
          window.removeEventListener('message', importListener);
        }
      };
      window.addEventListener('message', importListener);
      
      // Request data from extension
      window.postMessage({ type: 'REQUEST_BULK_IMPORT' }, '*');
      
      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', importListener);
        // Try to get from localStorage as fallback
        const stored = localStorage.getItem('pendingBulkImport');
        if (stored) {
          try {
            const mangaList = JSON.parse(stored);
            handleBulkImport(mangaList);
            localStorage.removeItem('pendingBulkImport');
          } catch (e) {
            console.error('Error parsing stored import:', e instanceof Error ? e.message : String(e));
          }
        }
      }, 10000);
    }
    // Handle bulk import from URL parameter (for smaller imports)
    else if (bulkImportParam) {
      try {
        // Decode and parse the manga list
        let mangaList;
        try {
          mangaList = JSON.parse(decodeURIComponent(bulkImportParam));
        } catch (parseError) {
          // Try without decoding first (in case it's already decoded)
          try {
            mangaList = JSON.parse(bulkImportParam);
          } catch {
            throw parseError; // Re-throw original error if second attempt fails
          }
        }
        
        if (Array.isArray(mangaList) && mangaList.length > 0) {
          console.log(`Importing ${mangaList.length} manga...`);
          handleBulkImport(mangaList);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.error('Invalid bulk import data:', mangaList);
          alert('No valid manga data found to import.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error parsing bulk import:', errorMessage);
        console.error('Raw parameter:', bulkImportParam.substring(0, 200));
        alert(`Error importing manga: ${errorMessage}. Check console for details.`);
      }
    }
    // Handle single manga
    else if (mangaParam) {
      try {
        const manga = JSON.parse(decodeURIComponent(mangaParam));
        handleExtensionManga(manga);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error parsing manga from extension:', error instanceof Error ? error.message : String(error));
      }
    }

    // Listen for messages from extension
    window.addEventListener('message', handleExtensionMessage);
    
    return () => {
      window.removeEventListener('message', handleExtensionMessage);
    };
  }, []);

  const handleSelectManga = async (mangaResult: MangaSearchResult) => {
    try {
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
      } else {
        console.error('Failed to fetch manga details');
        alert('Failed to fetch manga details. Please try again.');
      }
    } catch (error) {
      console.error('Error selecting manga:', error instanceof Error ? error.message : String(error));
      alert('An error occurred while adding the manga. Please try again.');
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shadow-md" style={{
                background: 'linear-gradient(to right, #5eead4 0%, #5eead4 50%, #ff6b6b 50%, #ff6b6b 100%)',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5" style={{
                  borderLeft: '1px dashed white',
                  opacity: 0.6
                }}></div>
                <span className="relative text-white font-bold text-xl z-10" style={{
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  letterSpacing: '-0.5px'
                }}>M</span>
              </div>
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
        {/* View Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setCurrentView('library')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              currentView === 'library'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            My Library
          </button>
          <button
            onClick={() => setCurrentView('recommendations')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              currentView === 'recommendations'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Recommendations
          </button>
        </div>

        {currentView === 'recommendations' ? (
          <Recommendations 
            trackedManga={trackedManga} 
            onSelectManga={handleSelectManga}
          />
        ) : (
          <>
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
          </>
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

