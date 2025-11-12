import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Trash2, Edit3, ExternalLink } from 'lucide-react';
import { TrackedManga, MangaSearchResult } from '../types';
import { searchManga } from '../services/mangaApi';

interface MangaCardProps {
  manga: TrackedManga;
  onRemove: (id: string) => void;
  onEdit: (manga: TrackedManga) => void;
}

// Get proxied image URL to bypass CORS
function getProxiedImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl || imageUrl.trim() === '') {
    return null;
  }
  
  // If it's already a proxied URL, return as is
  if (imageUrl.includes('/api/image-proxy')) {
    return imageUrl;
  }
  
  // MangaDex images work directly, no proxy needed
  if (imageUrl.includes('mangadex.org') || imageUrl.includes('uploads.mangadex.org')) {
    return imageUrl;
  }
  
  // Allowed domains that need proxying (MangaNato and their CDNs)
  const needsProxy = imageUrl.includes('manganato') || 
                    imageUrl.includes('2xstorage.com');
  
  if (!needsProxy) {
    // For other domains, return as is
    return imageUrl;
  }
  
  // Use our image proxy to bypass CORS
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
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
      // Clean the title for better matching
      const cleanTitle = manga.title
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Try multiple search strategies - be more specific
      // Remove common words that might cause false matches
      const commonWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from'];
      const titleWords = cleanTitle.split(' ').filter(w => w.length > 2 && !commonWords.includes(w.toLowerCase()));
      
      const searchQueries = [
        manga.title,           // Original title (most specific)
        cleanTitle,             // Cleaned title
        titleWords.slice(0, 4).join(' '), // First 4 meaningful words
        titleWords.slice(0, 3).join(' '), // First 3 meaningful words
        titleWords.slice(0, 2).join(' '), // First 2 meaningful words
      ].filter((q, i, arr) => q && q.trim().length >= 2 && arr.indexOf(q) === i); // Remove duplicates and too short queries
      
      console.log(`[${manga.id}] Searching MangaDex for "${manga.title}" with queries:`, searchQueries);
      
      // Search with all queries and combine results
      // Use Promise.allSettled to handle individual failures
      const searchPromises = searchQueries.map(q => searchManga(q).catch(err => {
        console.error(`[${manga.id}] Search failed for query "${q}":`, err);
        return [];
      }));
      
      Promise.allSettled(searchPromises).then((results) => {
        const allResults = results
          .filter((r): r is PromiseFulfilledResult<MangaSearchResult[]> => r.status === 'fulfilled')
          .flatMap(r => r.value);
        
        // Remove duplicates by ID
        const uniqueResults = Array.from(
          new Map(allResults.map(r => [r.id, r])).values()
        );
        
        console.log(`[${manga.id}] Found ${uniqueResults.length} unique results for "${manga.title}"`);
          
          // Find the best match with scoring
          const mTitle = manga.title.toLowerCase().trim();
          const mTitleWords = mTitle.split(/\s+/).filter(w => w.length > 2); // Words longer than 2 chars
          
          // Score each result
          const scoredResults = uniqueResults.map(r => {
            let score = 0;
            const rTitle = r.title.toLowerCase().trim();
            
            // Exact match = highest score
            if (rTitle === mTitle) {
              score += 1000;
            }
            
            // Check altTitles for exact match
            if (r.altTitles) {
              const exactAltMatch = r.altTitles.some(alt => 
                alt.toLowerCase().trim() === mTitle
              );
              if (exactAltMatch) score += 900;
            }
            
            // Word-by-word matching
            const rTitleWords = rTitle.split(/\s+/).filter(w => w.length > 2);
            const matchingWords = mTitleWords.filter(mw => 
              rTitleWords.some(rw => rw === mw || rw.includes(mw) || mw.includes(rw))
            );
            score += matchingWords.length * 10;
            
            // Percentage of words matched
            if (mTitleWords.length > 0) {
              const wordMatchRatio = matchingWords.length / mTitleWords.length;
              score += wordMatchRatio * 100;
            }
            
            // Title contains or is contained
            if (rTitle.includes(mTitle)) score += 50;
            if (mTitle.includes(rTitle)) score += 50;
            
            // Check altTitles for partial matches
            if (r.altTitles) {
              r.altTitles.forEach(alt => {
                const altLower = alt.toLowerCase().trim();
                if (altLower.includes(mTitle) || mTitle.includes(altLower)) {
                  score += 30;
                }
              });
            }
            
            return { result: r, score };
          });
          
          // Sort by score and get the best match
          scoredResults.sort((a, b) => b.score - a.score);
          
          // Only use match if score is reasonable (at least 50 points for better accuracy)
          // Increased threshold to avoid false matches
          const bestMatch = scoredResults[0]?.score >= 50 ? scoredResults[0].result : null;
          
          // Log top 3 matches for debugging
          console.log(`[${manga.id}] Top matches for "${manga.title}":`, scoredResults.slice(0, 3).map(s => ({
            title: s.result.title,
            score: s.score,
            coverImage: s.result.coverImage?.substring(0, 50) + '...',
            id: s.result.id
          })));
          
          if (bestMatch && bestMatch.coverImage) {
            console.log(`✅ [${manga.id}] Found cover image for "${manga.title}":`, {
              matchedTitle: bestMatch.title,
              matchedId: bestMatch.id,
              score: scoredResults[0].score,
              coverImage: bestMatch.coverImage.substring(0, 80) + '...'
            });
            setFetchedCoverImage(bestMatch.coverImage);
            
            // Also update the stored manga with the cover image
            import('../services/storage').then(({ updateTrackedManga }) => {
              updateTrackedManga(manga.id, { coverImage: bestMatch.coverImage });
            });
          } else {
            console.log(`❌ [${manga.id}] No good match found for "${manga.title}". Top result score:`, scoredResults[0]?.score, 'Title:', scoredResults[0]?.result?.title, 'ID:', scoredResults[0]?.result?.id);
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
        {/* Show image if we have an imageUrl */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={manga.title}
            className="w-24 h-32 object-cover rounded flex-shrink-0"
            crossOrigin="anonymous"
            onError={(e) => {
              // If image fails to load, hide it
              const target = e.target as HTMLImageElement;
              console.error('❌ Image failed to load:', {
                title: manga.title,
                original: coverImageToUse,
                proxied: imageUrl,
                actualSrc: target.src,
                error: 'Image load failed'
              });
              
              // Try to reload without proxy if it's a MangaDex image
              if (imageUrl.includes('/api/image-proxy') && coverImageToUse && coverImageToUse.includes('mangadex.org')) {
                console.log('Retrying with direct MangaDex URL:', coverImageToUse);
                target.src = coverImageToUse;
                return;
              }
              
              // Hide the image on error
              target.style.display = 'none';
            }}
            onLoad={() => {
              console.log('✅ Image loaded successfully:', {
                title: manga.title,
                source: fetchedCoverImage ? 'fetched' : 'stored',
                url: imageUrl
              });
            }}
            loading="lazy"
          />
        ) : isFetching ? (
          // Show loading spinner only when fetching and no imageUrl
          <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto mb-1"></div>
              <p className="text-xs text-gray-500">Loading...</p>
            </div>
          </div>
        ) : (
          // Show placeholder only when no imageUrl and not fetching
          <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">No image</p>
            </div>
          </div>
        )}

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

