import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { TrackedManga, MangaSearchResult } from '../types';
import { searchManga, searchMangaByTag, getMangaDetails } from '../services/mangaApi';

interface RecommendationsProps {
  trackedManga: TrackedManga[];
  onSelectManga: (manga: MangaSearchResult) => void;
}

export default function Recommendations({ trackedManga, onSelectManga }: RecommendationsProps) {
  const [recommendations, setRecommendations] = useState<MangaSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get recommendations based on read manga
  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get all completed and reading manga
      const readManga = trackedManga.filter(
        m => m.readingStatus === 'completed' || m.readingStatus === 'reading'
      );

      if (readManga.length === 0) {
        setError('Read some manga first to get recommendations!');
        setIsLoading(false);
        return;
      }

      // Collect all genres from read manga
      const allGenres = new Set<string>();
      readManga.forEach(manga => {
        if (manga.genres) {
          manga.genres.forEach(genre => allGenres.add(genre));
        }
      });

      // Get recommendations - try multiple approaches
      const allResults: MangaSearchResult[] = [];
      const trackedIds = new Set(trackedManga.map(m => m.id));
      
      // Approach 1: Search by tags/genres from read manga using MangaDex tag search
      if (allGenres.size > 0) {
        const genreArray = Array.from(allGenres).slice(0, 5);
        for (const genre of genreArray) {
          try {
            console.log(`Searching for recommendations by tag: ${genre}`);
            const results = await searchMangaByTag(genre);
            const filtered = results.filter(r => !trackedIds.has(r.id));
            allResults.push(...filtered);
            console.log(`Found ${filtered.length} recommendations for tag "${genre}"`);
          } catch (err) {
            console.error(`Error searching for tag ${genre}:`, err);
            // Fallback to title search if tag search fails
            try {
              const results = await searchManga(genre);
              allResults.push(...results.filter(r => !trackedIds.has(r.id)));
            } catch (fallbackErr) {
              console.error(`Fallback search also failed for ${genre}:`, fallbackErr);
            }
          }
        }
      }
      
      // Approach 2: If we don't have enough results, search by popular keywords
      if (allResults.length < 15) {
        const popularQueries = ['action', 'fantasy', 'romance', 'comedy', 'drama', 'adventure', 'supernatural'];
        const needed = 15 - allResults.length;
        for (let i = 0; i < Math.min(needed, 5); i++) {
          const randomQuery = popularQueries[Math.floor(Math.random() * popularQueries.length)];
          try {
            const results = await searchManga(randomQuery);
            allResults.push(...results.filter(r => !trackedIds.has(r.id)));
          } catch (err) {
            console.error(`Error searching for ${randomQuery}:`, err);
          }
        }
      }
      
      // Get unique recommendations (limit to 20)
      const unique = Array.from(
        new Map(allResults.map(r => [r.id, r])).values()
      ).slice(0, 20);
      
      console.log(`Found ${unique.length} recommendations`);
      setRecommendations(unique);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (trackedManga.length > 0) {
      fetchRecommendations();
    }
  }, [trackedManga.length]); // Only re-fetch when manga count changes

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-gray-600">Loading recommendations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchRecommendations}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No recommendations available yet.</p>
        <button
          onClick={fetchRecommendations}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Refresh Recommendations
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-600" />
            Recommendations
          </h2>
          <p className="text-gray-600 mt-1">
            Based on your reading history
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {recommendations.map((manga) => (
          <div
            key={manga.id}
            onClick={() => onSelectManga(manga)}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            {manga.coverImage ? (
              <img
                src={manga.coverImage}
                alt={manga.title}
                className="w-full h-48 object-cover rounded mb-3"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 rounded mb-3 flex items-center justify-center">
                <span className="text-gray-400 text-sm">No image</span>
              </div>
            )}
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
              {manga.title}
            </h3>
            {manga.description && (
              <p className="text-xs text-gray-500 line-clamp-2">
                {manga.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

