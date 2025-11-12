import { Manga, MangaSearchResult } from '../types';

// Use our own API proxy (Vercel serverless function)
const API_PROXY = '/api/manganato-proxy';

const MANGANATO_BASE = 'https://www.manganato.gg';

/**
 * Fetch HTML from MangaNato using our proxy
 */
async function fetchManganatoHtml(url: string): Promise<string | null> {
  try {
    const proxyUrl = `${API_PROXY}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      console.error(`Proxy error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching from proxy:', error);
    return null;
  }
}

/**
 * Extract manga ID from MangaNato URL
 */
function extractMangaId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const mangaId = pathParts[pathParts.length - 1];
    return mangaId || null;
  } catch {
    return null;
  }
}

/**
 * Search for manga on MangaNato
 */
export async function searchManganato(query: string): Promise<MangaSearchResult[]> {
  try {
    const searchUrl = `${MANGANATO_BASE}/search/story/${encodeURIComponent(query)}`;
    const html = await fetchManganatoHtml(searchUrl);
    
    if (!html) {
      return [];
    }
    
    // Parse HTML to extract manga results
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const results: MangaSearchResult[] = [];
    
    // MangaNato search results - try multiple selectors
    const items = doc.querySelectorAll('.search-story-item, .item-story, .story-item, [class*="story-item"], .panel-content-genre .content-genres-item');
    
    items.forEach((item) => {
      const titleElement = item.querySelector('h3 a, .item-title a, a.story-name, a[title], h3, .story-name');
      const coverElement = item.querySelector('img');
      const linkElement = item.querySelector('a') || titleElement;
      
      if (linkElement) {
        const title = titleElement?.textContent?.trim() || linkElement.textContent?.trim() || linkElement.getAttribute('title') || '';
        const href = linkElement.getAttribute('href') || '';
        const coverImage = coverElement?.getAttribute('src') || coverElement?.getAttribute('data-src') || coverElement?.getAttribute('data-original') || undefined;
        const fullUrl = href.startsWith('http') ? href : href ? `${MANGANATO_BASE}${href}` : '';
        const mangaId = fullUrl ? extractMangaId(fullUrl) : null;
        
        if (title && mangaId && !results.find(r => r.id === `manganato_${mangaId}`)) {
          results.push({
            id: `manganato_${mangaId}`,
            title,
            coverImage: coverImage?.startsWith('http') 
              ? coverImage 
              : coverImage 
                ? `${MANGANATO_BASE}${coverImage}` 
                : undefined,
            description: item.querySelector('.item-story-desc, .story-desc, .text-gray')?.textContent?.trim() || undefined,
          });
        }
      }
    });
    
    // Fallback: try to find any links that look like manga pages
    if (results.length === 0) {
      const allLinks = doc.querySelectorAll('a[href*="/manga/"], a[href*="/story/"]');
      allLinks.forEach((link) => {
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const href = link.getAttribute('href') || '';
        if (title && href) {
          const fullUrl = href.startsWith('http') ? href : `${MANGANATO_BASE}${href}`;
          const mangaId = extractMangaId(fullUrl);
          if (mangaId && !results.find(r => r.id === `manganato_${mangaId}`)) {
            results.push({
              id: `manganato_${mangaId}`,
              title,
              coverImage: undefined,
            });
          }
        }
      });
    }
    
    return results.slice(0, 20); // Limit to 20 results
  } catch (error) {
    console.error('Error searching MangaNato:', error);
    return [];
  }
}

/**
 * Get manga details from MangaNato URL
 */
export async function getManganatoDetails(url: string): Promise<Manga | null> {
  try {
    const mangaId = extractMangaId(url);
    if (!mangaId) {
      console.error('Could not extract manga ID from URL:', url);
      return null;
    }
    
    const html = await fetchManganatoHtml(url);
    
    if (!html) {
      console.error('Failed to fetch HTML from proxy');
      return null;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract title
    const titleElement = doc.querySelector('h1, .story-info-right h1, .story-info-right h2, [class*="story-title"]');
    const title = titleElement?.textContent?.trim() || '';
    
    // Extract cover image - try multiple selectors
    let coverElement = doc.querySelector('.story-info-left img, .info-image img, [class*="cover"] img');
    
    // If not found, try more selectors
    if (!coverElement) {
      coverElement = doc.querySelector('img[src*="cover"], img[src*="thumb"], img[src*="manga"], .item-img img, .story-img img');
    }
    
    // Try multiple attributes
    let coverImage = coverElement?.getAttribute('src') || 
                     coverElement?.getAttribute('data-src') || 
                     coverElement?.getAttribute('data-original') ||
                     coverElement?.getAttribute('data-lazy-src') ||
                     undefined;
    
    // If still no image, try background-image from style
    if (!coverImage && coverElement) {
      const style = coverElement.getAttribute('style') || window.getComputedStyle(coverElement as Element).backgroundImage;
      if (style && style.includes('url(')) {
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match && match[1]) {
          coverImage = match[1];
        }
      }
    }
    
    // Make absolute URL if relative
    const fullCoverImage = coverImage?.startsWith('http') 
      ? coverImage 
      : coverImage 
        ? (coverImage.startsWith('//') 
          ? `https:${coverImage}`
          : coverImage.startsWith('/')
          ? `${MANGANATO_BASE}${coverImage}`
          : `${MANGANATO_BASE}/${coverImage}`)
        : undefined;
    
    // Extract description
    const descElement = doc.querySelector('.panel-story-info-description, .story-description, [class*="description"]');
    const description = descElement?.textContent?.trim() || undefined;
    
    // Extract author
    const authorElement = doc.querySelector('a[href*="/author/"], .story-info-right a[href*="/author/"]');
    const author = authorElement?.textContent?.trim() || undefined;
    
    // Extract genres
    const genreElements = doc.querySelectorAll('a[href*="/genre/"], .story-info-right a[href*="/genre/"]');
    const genres = Array.from(genreElements)
      .map(el => el.textContent?.trim())
      .filter((g): g is string => !!g);
    
    // Extract status
    const statusElement = doc.querySelector('.story-info-right, .info-status');
    let status = undefined;
    if (statusElement) {
      const statusText = statusElement.textContent || '';
      if (statusText.includes('Completed') || statusText.includes('completed')) {
        status = 'completed';
      } else if (statusText.includes('Ongoing') || statusText.includes('ongoing')) {
        status = 'ongoing';
      }
    }
    
    // Extract chapter count
    const chapterList = doc.querySelectorAll('.row-content-chapter a, .chapter-name, [class*="chapter"] a');
    const totalChapters = chapterList.length;
    
    return {
      id: `manganato_${mangaId}`,
      title: title || 'Unknown Title',
      description,
      coverImage: fullCoverImage,
      status,
      chapters: totalChapters > 0 ? totalChapters : undefined,
      author,
      genres: genres.length > 0 ? genres : undefined,
      manganatoUrl: url,
    };
  } catch (error) {
    console.error('Error fetching MangaNato details:', error);
    return null;
  }
}

/**
 * Get manga details from MangaNato by manga ID
 */
export async function getManganatoDetailsById(mangaId: string): Promise<Manga | null> {
  // Remove the manganato_ prefix if present
  const cleanId = mangaId.replace(/^manganato_/, '');
  const url = `${MANGANATO_BASE}/manga/${cleanId}`;
  return getManganatoDetails(url);
}

/**
 * Check if a URL is a MangaNato URL
 */
export function isManganatoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('manganato');
  } catch {
    return false;
  }
}

