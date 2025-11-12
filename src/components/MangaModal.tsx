import { X } from 'lucide-react';
import { TrackedManga } from '../types';

interface MangaModalProps {
  manga: TrackedManga | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<TrackedManga>) => void;
}

export default function MangaModal({ manga, isOpen, onClose, onSave }: MangaModalProps) {
  if (!isOpen || !manga) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const updates: Partial<TrackedManga> = {
      readingStatus: formData.get('status') as TrackedManga['readingStatus'],
      lastReadChapter: formData.get('lastChapter') 
        ? parseInt(formData.get('lastChapter') as string) 
        : undefined,
      totalChapters: formData.get('totalChapters')
        ? parseInt(formData.get('totalChapters') as string)
        : undefined,
      manganatoUrl: formData.get('manganatoUrl') as string || undefined,
    };

    onSave(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Edit Manga</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reading Status
            </label>
            <select
              name="status"
              defaultValue={manga.readingStatus}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="reading">Reading</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="planning">Planning to Read</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Read Chapter
            </label>
            <input
              type="number"
              name="lastChapter"
              defaultValue={manga.lastReadChapter || ''}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Chapters
            </label>
            <input
              type="number"
              name="totalChapters"
              defaultValue={manga.totalChapters || ''}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MangaNato URL (optional)
            </label>
            <input
              type="url"
              name="manganatoUrl"
              defaultValue={manga.manganatoUrl || ''}
              placeholder="https://manganato.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

