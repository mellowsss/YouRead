import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Trash2, Edit3, ExternalLink } from 'lucide-react';
import { TrackedManga } from '../types';
import { searchManga } from '../services/mangaApi';

interface MangaCardProps {
  manga: TrackedManga;
  onRemove: (id: string) => void;
  onEdit: (manga: TrackedManga) => void;
}

// Get proxied image URL to bypass CORS
function getProxiedImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl || imageUrl.trim() === '') {
    console.log('getProxiedImageUrl: Empty or undefined image URL');
    return null;
  }
  
  // If it's already a proxied URL, return as is
  if (imageUrl.includes('/api/image-proxy')) {
    console.log('getProxiedImageUrl: Already proxied:', imageUrl);
    return imageUrl;
  }
  
  // Allowed domains that need proxying (MangaNato and their CDNs)
  const needsProxy = imageUrl.includes('manganato') || 
                    imageUrl.includes('2xstorage.com');
  
  if (!needsProxy) {
    // For other domains (like MangaDex), return as is
    console.log('getProxiedImageUrl: No proxy needed (other domain):', imageUrl);
    return imageUrl;
  }
  
  // Use our image proxy to bypass CORS
  const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  console.log('getProxiedImageUrl: Proxying URL:', { original: imageUrl, proxied: proxiedUrl });
  return proxiedUrl;
}

export default function MangaCard({ manga, onRemove, onEdit }: MangaCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reading':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'planning':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const progress = manga.totalChapters && manga.lastReadChapter
    ? Math.round((manga.lastReadChapter / manga.totalChapters) * 100)
    : 0;

  const [fetchedCoverImage, setFetchedCoverImage] = useState<string | undefined>(undefined);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch cover image from MangaDex API if missing
  useEffect(() => {
    // Only fetch if we don't have a cover image
    if (!manga.coverImage && !fetchedCoverImage && !isFetching) {
      setIsFetching(true);
      console.log(`Searching MangaDex for cover image: "${manga.title}"`);
      
      // Search MangaDex for the manga by title
      // Try exact title first, then try without special characters
      const cleanTitle = manga.title.replace(/[^\w\s]/g, '').trim();
      const searchQueries = [manga.title, cleanTitle];
      
      const searchPromises = searchQueries.map(q => searchManga(q));
      
      Promise.all(searchPromises)
        .then(([results1, results2]) => {
          const allResults = [...results1, ...results2];
          // Remove duplicates by ID
          const uniqueResults = Array.from(
            new Map(allResults.map(r => [r.id, r])).values()
          );
          
          // Find the best match - try exact match first, then partial match
          let bestMatch = uniqueResults.find(r => 
            r.title.toLowerCase().trim() === manga.title.toLowerCase().trim()
          );
          
          if (!bestMatch) {
            // Try partial match (contains the title or title contains result)
            bestMatch = uniqueResults.find(r => {
              const rTitle = r.title.toLowerCase().trim();
              const mTitle = manga.title.toLowerCase().trim();
              return rTitle.includes(mTitle) || mTitle.includes(rTitle);
            });
          }
          
          // If still no match, use first result
          if (!bestMatch && uniqueResults.length > 0) {
            bestMatch = uniqueResults[0];
          }
          
          if (bestMatch && bestMatch.coverImage) {
            console.log(`✅ Found cover image for "${manga.title}" from MangaDex:`, bestMatch.coverImage);
            setFetchedCoverImage(bestMatch.coverImage);
            
            // Also update the stored manga with the cover image
            import('../services/storage').then(({ updateTrackedManga }) => {
              updateTrackedManga(manga.id, { coverImage: bestMatch.coverImage });
            });
          } else {
            console.log(`❌ No cover image found for "${manga.title}" in MangaDex`);
          }
          setIsFetching(false);
        })
        .catch((error) => {
          console.error(`Error searching MangaDex for "${manga.title}":`, error);
          setIsFetching(false);
        });
    }
  }, [manga.coverImage, manga.id, manga.title, fetchedCoverImage, isFetching]);

  // Use fetched image if available, otherwise use stored image
  const coverImageToUse = manga.coverImage || fetchedCoverImage;
  const imageUrl = coverImageToUse ? getProxiedImageUrl(coverImageToUse) : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={manga.title}
            className="w-24 h-32 object-cover rounded flex-shrink-0"
            onError={(e) => {
              // If image fails to load, hide it and show placeholder
              const target = e.target as HTMLImageElement;
              console.error('❌ Image failed to load:', {
                title: manga.title,
                original: coverImageToUse,
                proxied: imageUrl,
                actualSrc: target.src
              });
              
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) {
                placeholder.style.display = 'flex';
              }
            }}
            onLoad={() => {
              console.log('✅ Image loaded successfully:', {
                title: manga.title,
                source: fetchedCoverImage ? 'fetched' : 'stored'
              });
            }}
            loading="lazy"
          />
        ) : isFetching ? (
          <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto mb-1"></div>
              <p className="text-xs text-gray-500">Loading...</p>
            </div>
          </div>
        ) : null}
        <div 
          className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center flex-shrink-0"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          <div className="text-center">
            <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">No image</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-xl font-semibold text-gray-900 truncate">{manga.title}</h3>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => onEdit(manga)}
                className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemove(manga.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {manga.author && (
            <p className="text-sm text-gray-600 mb-2">by {manga.author}</p>
          )}

          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(manga.readingStatus)}`}>
              {manga.readingStatus}
            </span>
            {manga.genres && manga.genres.length > 0 && (
              <span className="text-xs text-gray-500">
                {manga.genres.slice(0, 2).join(', ')}
              </span>
            )}
          </div>

          {manga.lastReadChapter !== undefined && manga.totalChapters !== undefined && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Chapter {manga.lastReadChapter} / {manga.totalChapters}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Added {new Date(manga.dateAdded).toLocaleDateString()}</span>
            </div>
            {manga.manganatoUrl && (
              <a
                href={manga.manganatoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary-600 hover:text-primary-700 transition-colors"
                title="Open on MangaNato"
              >
                <ExternalLink className="w-3 h-3" />
                <span>MangaNato</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

