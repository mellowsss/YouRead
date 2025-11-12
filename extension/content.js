// Content script to detect manga on MangaNato pages

(function() {
  'use strict';

  // Configuration - Update this with your YouRead website URL
  const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';
  // For local development, use: 'http://localhost:5173'

  // Extract manga information from the current page
  function extractMangaInfo() {
    const url = window.location.href;
    
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
      console.error('Error extracting manga info:', error);
      return null;
    }
  }

  // Send manga info to background script
  function sendMangaInfo() {
    const mangaInfo = extractMangaInfo();
    
    if (mangaInfo) {
      chrome.runtime.sendMessage({
        type: 'MANGA_DETECTED',
        manga: mangaInfo,
        url: window.location.href
      });
    }
  }

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

