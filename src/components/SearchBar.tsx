import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { MangaSearchResult } from '../types';
import { searchManga } from '../services/mangaApi';
import { searchManganato, isManganatoUrl, getManganatoDetails } from '../services/manganatoApi';

interface SearchBarProps {
  onSelectManga: (manga: MangaSearchResult) => void;
}

type SearchSource = 'all' | 'mangadex' | 'manganato';

// Get proxied image URL to bypass CORS
function getProxiedImageUrl(imageUrl: string | undefined): string {
  if (!imageUrl) return '';
  
  // If it's already a proxied URL or not a MangaNato URL, return as is
  if (imageUrl.includes('/api/image-proxy') || !imageUrl.includes('manganato')) {
    return imageUrl;
  }
  
  // Use our image proxy to bypass CORS
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

export default function SearchBar({ onSelectManga }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [source, setSource] = useState<SearchSource>('all');

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Check if it's a MangaNato URL
    if (isManganatoUrl(searchQuery)) {
      setIsSearching(true);
      try {
        const manga = await getManganatoDetails(searchQuery);
        if (manga) {
          onSelectManga({
            id: manga.id,
            title: manga.title,
            coverImage: manga.coverImage,
            description: manga.description,
          });
          setQuery('');
          setShowResults(false);
        } else {
          console.error('Failed to fetch manga from MangaNato');
          // Show error in console and let user know
          setQuery('');
        }
      } catch (error) {
        console.error('Error fetching MangaNato URL:', error);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    const allResults: MangaSearchResult[] = [];

    try {
      if (source === 'all' || source === 'mangadex') {
        const mangadexResults = await searchManga(searchQuery);
        allResults.push(...mangadexResults);
      }

      if (source === 'all' || source === 'manganato') {
        const manganatoResults = await searchManganato(searchQuery);
        allResults.push(...manganatoResults);
      }

      setResults(allResults);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  const handleSelect = (manga: MangaSearchResult) => {
    onSelectManga(manga);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setSource('all')}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            source === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setSource('mangadex')}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            source === 'mangadex'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          MangaDex
        </button>
        <button
          onClick={() => setSource('manganato')}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            source === 'manganato'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          MangaNato
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search for manga or paste MangaNato URL..."
          className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No results found</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((manga) => (
                <li
                  key={manga.id}
                  onClick={() => handleSelect(manga)}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4 transition-colors"
                >
                  {manga.coverImage && (
                    <img
                      src={getProxiedImageUrl(manga.coverImage)}
                      alt={manga.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{manga.title}</h3>
                    {manga.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {manga.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

