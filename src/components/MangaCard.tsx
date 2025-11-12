import { BookOpen, Calendar, Trash2, Edit3, ExternalLink } from 'lucide-react';
import { TrackedManga } from '../types';

interface MangaCardProps {
  manga: TrackedManga;
  onRemove: (id: string) => void;
  onEdit: (manga: TrackedManga) => void;
}

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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {manga.coverImage ? (
          <img
            src={getProxiedImageUrl(manga.coverImage)}
            alt={manga.title}
            className="w-24 h-32 object-cover rounded flex-shrink-0"
            onError={(e) => {
              // If image fails to load, hide it and show placeholder
              const target = e.target as HTMLImageElement;
              console.error('Image failed to load:', manga.coverImage);
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) {
                placeholder.style.display = 'flex';
              }
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', manga.coverImage);
            }}
            loading="lazy"
          />
        ) : null}
        <div 
          className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center flex-shrink-0"
          style={{ display: manga.coverImage ? 'none' : 'flex' }}
        >
          <BookOpen className="w-8 h-8 text-gray-400" />
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

