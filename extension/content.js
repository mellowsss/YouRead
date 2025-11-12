// Content script to detect manga on MangaNato pages

(function() {
  'use strict';

  // Configuration - Update this with your YouRead website URL
  const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';
  // For local development, use: 'http://localhost:5173'

  // Extract manga from bookmark/history page
  function extractHistoryManga() {
    const url = window.location.href;
    
    // Check if we're on a bookmark or history page
    if (!url.includes('/history') && !url.includes('/bookmark')) {
      return null;
    }

    try {
      const mangaList = [];
      
      // For bookmark page, look for bookmark entries
      // Try multiple selectors to find bookmark items
      const items = document.querySelectorAll(
        '.panel-bookmark .bookmark-item, ' +
        '.bookmark-item, ' +
        '.item-story, ' +
        '.story-item, ' +
        '.history-item, ' +
        '[class*="bookmark"], ' +
        '[class*="story-item"], ' +
        '.panel-content-history .item-story, ' +
        'table tbody tr, ' +
        '.list-story .item-story'
      );
      
      items.forEach((item) => {
        try {
          // Get manga link - try multiple selectors
          const linkElement = item.querySelector(
            'a[href*="/manga/"], ' +
            '.item-title a, ' +
            'h3 a, ' +
            '.story-name a, ' +
            '.bookmark-title a, ' +
            'a[title]'
          );
          
          if (!linkElement) return;
          
          const href = linkElement.getAttribute('href') || '';
          if (!href.includes('/manga/')) return;
          
          const fullUrl = href.startsWith('http') ? href : `https://www.manganato.gg${href}`;
          const urlParts = fullUrl.split('/manga/');
          const mangaId = urlParts[1]?.split('/')[0]?.split('?')[0];
          
          if (!mangaId) return;
          
          // Get title - from link or title attribute
          const title = linkElement.textContent?.trim() || 
                       linkElement.getAttribute('title')?.trim() || 
                       item.querySelector('.item-title, h3, .story-name')?.textContent?.trim() || 
                       '';
          
          if (!title) return;
          
          // Get cover image - try multiple selectors
          const coverElement = item.querySelector('img');
          const coverImage = coverElement?.getAttribute('src') || 
                           coverElement?.getAttribute('data-src') || 
                           coverElement?.getAttribute('data-original') ||
                           undefined;
          const fullCoverImage = coverImage?.startsWith('http') 
            ? coverImage 
            : coverImage 
              ? `https://www.manganato.gg${coverImage}` 
              : undefined;
          
          // Get last read chapter from "Viewed : Chapter X" text
          let lastReadChapter = undefined;
          const itemText = item.textContent || '';
          
          // Look for "Viewed : Chapter X" pattern
          const viewedMatch = itemText.match(/Viewed\s*:\s*[Cc]h(?:apter)?\.?\s*(\d+)/i);
          if (viewedMatch) {
            lastReadChapter = parseInt(viewedMatch[1]);
          } else {
            // Fallback: look for any chapter number near "Viewed"
            const viewedElement = Array.from(item.querySelectorAll('*')).find(el => 
              el.textContent?.includes('Viewed')
            );
            if (viewedElement) {
              const chapterMatch = viewedElement.textContent?.match(/(\d+)/);
              if (chapterMatch) {
                lastReadChapter = parseInt(chapterMatch[1]);
              }
            }
          }
          
          // Get total chapters from "Current : Chapter X" text
          let totalChapters = undefined;
          const currentMatch = itemText.match(/Current\s*:\s*[Cc]h(?:apter)?\.?\s*(\d+)/i);
          if (currentMatch) {
            totalChapters = parseInt(currentMatch[1]);
          }
          
          mangaList.push({
            id: `manganato_${mangaId}`,
            title: title,
            coverImage: fullCoverImage,
            manganatoUrl: fullUrl,
            lastReadChapter: lastReadChapter,
            totalChapters: totalChapters,
          });
        } catch (error) {
          console.error('Error extracting manga from bookmark item:', error);
        }
      });
      
      return mangaList.length > 0 ? mangaList : null;
    } catch (error) {
      console.error('Error extracting bookmark manga:', error);
      return null;
    }
  }

  // Extract manga information from the current page
  function extractMangaInfo() {
    const url = window.location.href;
    
    // Check if we're on a bookmark or history page first
    const historyManga = extractHistoryManga();
    if (historyManga) {
      return { type: 'history', manga: historyManga };
    }
    
    // Check if we're on a manga page (not a chapter page)
    const isMangaPage = url.includes('/manga/') && !url.includes('/chapter/');
    
    if (!isMangaPage) {
      return null;
    }

    try {
      // Extract manga ID from URL
      const urlParts = url.split('/manga/');
      const mangaId = urlParts[1]?.split('/')[0]?.split('?')[0];
      
      if (!mangaId) return null;

      // Extract title
      const titleElement = document.querySelector('h1, .story-info-right h1, .story-info-right h2, [class*="story-title"]');
      const title = titleElement?.textContent?.trim() || '';

      // Extract cover image
      const coverElement = document.querySelector('.story-info-left img, .info-image img, [class*="cover"] img');
      const coverImage = coverElement?.getAttribute('src') || coverElement?.getAttribute('data-src') || undefined;
      const fullCoverImage = coverImage?.startsWith('http') 
        ? coverImage 
        : coverImage 
          ? `https://www.manganato.gg${coverImage}` 
          : undefined;

      // Extract description
      const descElement = document.querySelector('.panel-story-info-description, .story-description, [class*="description"]');
      const description = descElement?.textContent?.trim() || undefined;

      // Extract author
      const authorElement = document.querySelector('a[href*="/author/"], .story-info-right a[href*="/author/"]');
      const author = authorElement?.textContent?.trim() || undefined;

      // Extract genres
      const genreElements = document.querySelectorAll('a[href*="/genre/"], .story-info-right a[href*="/genre/"]');
      const genres = Array.from(genreElements)
        .map(el => el.textContent?.trim())
        .filter(g => !!g);

      // Extract status
      const statusElement = document.querySelector('.story-info-right, .info-status');
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
      const chapterList = document.querySelectorAll('.row-content-chapter a, .chapter-name, [class*="chapter"] a');
      const totalChapters = chapterList.length;

      return {
        type: 'single',
        manga: {
          id: `manganato_${mangaId}`,
          title: title || 'Unknown Title',
          description,
          coverImage: fullCoverImage,
          status,
          chapters: totalChapters > 0 ? totalChapters : undefined,
          author,
          genres: genres.length > 0 ? genres : undefined,
          manganatoUrl: url,
        }
      };
    } catch (error) {
      console.error('Error extracting manga info:', error);
      return null;
    }
  }

  // Send manga info to background script
  function sendMangaInfo() {
    const mangaInfo = extractMangaInfo();
    
    if (mangaInfo) {
      if (mangaInfo.type === 'history') {
        // Send history manga list
        chrome.runtime.sendMessage({
          type: 'HISTORY_DETECTED',
          mangaList: mangaInfo.manga,
          url: window.location.href
        });
      } else if (mangaInfo.type === 'single') {
        // Send single manga
        chrome.runtime.sendMessage({
          type: 'MANGA_DETECTED',
          manga: mangaInfo.manga,
          url: window.location.href
        });
      }
    }
  }

  // Listen for requests to extract history
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_HISTORY') {
      try {
        const historyManga = extractHistoryManga();
        sendResponse({ mangaList: historyManga || [] });
      } catch (error) {
        console.error('Error in EXTRACT_HISTORY:', error);
        sendResponse({ mangaList: [], error: error.message });
      }
      return true; // Keep channel open for async response
    } else if (message.type === 'GET_NEXT_PAGE_URL') {
      // Find next page link
      const nextPageLink = document.querySelector('a[href*="page="], .page-next a, .pagination a:last-child');
      if (nextPageLink) {
        const href = nextPageLink.getAttribute('href');
        const nextUrl = href?.startsWith('http') ? href : `https://www.manganato.gg${href}`;
        sendResponse({ nextUrl: nextUrl });
      } else {
        sendResponse({ nextUrl: null });
      }
      return true;
    }
    return false;
  });

  // Check if we're on a manga page and extract info
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendMangaInfo);
  } else {
    sendMangaInfo();
  }

  // Also check when navigating within the same page (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(sendMangaInfo, 1000); // Wait a bit for page to load
    }
  }).observe(document, { subtree: true, childList: true });

})();

