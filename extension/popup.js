// Popup script for YouRead extension

const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';

// Initialize popup
async function initPopup() {
  const statusDiv = document.getElementById('status');
  const mangaInfoDiv = document.getElementById('mangaInfo');
  const actionsDiv = document.getElementById('actions');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on MangaNato
    if (tab.url?.includes('manganato')) {
      // Check if it's a bookmark or history page
      if (tab.url?.includes('/bookmark') || tab.url?.includes('/history')) {
        await showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv);
      } else {
        // Regular manga page
        const { lastDetectedManga } = await chrome.storage.local.get('lastDetectedManga');
        
        if (lastDetectedManga) {
          showMangaInfo(lastDetectedManga, mangaInfoDiv, actionsDiv);
          statusDiv.innerHTML = '<div class="status success">✓ Manga detected!</div>';
        } else {
          statusDiv.innerHTML = '<div class="status info">Scanning page for manga...</div>';
          mangaInfoDiv.innerHTML = '<div class="loading">Please wait...</div>';
          
          // Request content script to extract info
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MANGA' }, (response) => {
            if (response && response.manga) {
              showMangaInfo(response.manga, mangaInfoDiv, actionsDiv);
              statusDiv.innerHTML = '<div class="status success">✓ Manga detected!</div>';
            } else {
              statusDiv.innerHTML = '<div class="status error">Could not detect manga on this page</div>';
              mangaInfoDiv.innerHTML = '<p style="color: #6b7280; font-size: 12px;">Make sure you\'re on a manga page (not a chapter page).</p>';
            }
          });
        }
      }
    } else {
      statusDiv.innerHTML = '<div class="status info">Visit a MangaNato manga page to track it</div>';
      actionsDiv.innerHTML = `
        <button class="button primary" onclick="window.open('${YOUREAD_URL}', '_blank')">
          Open YouRead
        </button>
      `;
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    statusDiv.innerHTML = '<div class="status error">Error loading extension</div>';
  }
}

// Show history import interface
async function showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv) {
  try {
    // Get detected history
    const { detectedHistory } = await chrome.storage.local.get('detectedHistory');
    
    if (detectedHistory && detectedHistory.length > 0) {
      statusDiv.innerHTML = `<div class="status success">✓ Found ${detectedHistory.length} manga on this page!</div>`;
      
      mangaInfoDiv.innerHTML = `
        <div class="manga-info">
          <h3>Ready to Import</h3>
          <p>Found <strong>${detectedHistory.length}</strong> manga with reading progress on this page</p>
          <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
            Click "Import All Pages" to automatically collect manga from ALL pages of your bookmarks!
          </p>
        </div>
      `;
      
      actionsDiv.innerHTML = `
        <button class="button primary" id="importAllPages">
          Import All Pages (Auto-collect from all pages)
        </button>
        <button class="button secondary" id="importCurrentPage">
          Import This Page Only (${detectedHistory.length} manga)
        </button>
        <button class="button secondary" onclick="window.open('${YOUREAD_URL}', '_blank')" style="margin-top: 8px;">
          Open YouRead
        </button>
      `;
      
      document.getElementById('importAllPages').addEventListener('click', async () => {
        await importHistoryToYouRead(detectedHistory, tab);
      });
      
      document.getElementById('importCurrentPage').addEventListener('click', async () => {
        await chrome.storage.local.set({ pendingBulkImport: detectedHistory });
        chrome.tabs.create({ 
          url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(JSON.stringify(detectedHistory))}` 
        });
        window.close();
      });
    } else {
      statusDiv.innerHTML = '<div class="status info">Scanning history page...</div>';
      mangaInfoDiv.innerHTML = '<div class="loading">Please wait...</div>';
      
      // Request content script to extract history directly
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_HISTORY' });
        
        if (response && response.mangaList && response.mangaList.length > 0) {
          await chrome.storage.local.set({ detectedHistory: response.mangaList });
          showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv);
        } else {
          statusDiv.innerHTML = '<div class="status error">No manga found on this page</div>';
          mangaInfoDiv.innerHTML = '<p style="color: #6b7280; font-size: 12px;">Make sure you\'re logged in and on the MangaNato bookmark page: https://www.manganato.gg/bookmark</p>';
        }
      } catch (error) {
        console.error('Error extracting history:', error);
        // Try to extract from page directly
        statusDiv.innerHTML = '<div class="status info">Scanning page... Please refresh the page and try again.</div>';
        mangaInfoDiv.innerHTML = '<p style="color: #6b7280; font-size: 12px;">If this persists, try refreshing the bookmark page and clicking the extension again.</p>';
      }
    }
  } catch (error) {
    console.error('Error showing history import:', error);
    statusDiv.innerHTML = '<div class="status error">Error loading history</div>';
  }
}

// Import all pages of history
async function importAllPages(tab, mangaList, maxPages = 20) {
  try {
    const allManga = [...mangaList];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage < maxPages) {
      try {
        // Wait for page to be ready
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Extract from current page
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_HISTORY' });
        
        if (response && response.mangaList && response.mangaList.length > 0) {
          // Add new manga (avoid duplicates)
          response.mangaList.forEach(manga => {
            if (!allManga.find(m => m.id === manga.id)) {
              allManga.push(manga);
            }
          });
        }
        
        // Check for next page
        const nextPageResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_NEXT_PAGE_URL' });
        
        if (nextPageResponse && nextPageResponse.nextUrl) {
          // Navigate to next page
          await chrome.tabs.update(tab.id, { url: nextPageResponse.nextUrl });
          currentPage++;
          
          // Update status if popup is still open
          try {
            const statusEl = document.getElementById('status');
            if (statusEl) {
              statusEl.innerHTML = `<div class="status info">Collecting from page ${currentPage}... Found ${allManga.length} manga so far</div>`;
            }
          } catch (e) {
            // Popup might be closed
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error on page ${currentPage}:`, error);
        hasMorePages = false;
      }
    }
    
    return allManga;
  } catch (error) {
    console.error('Error importing all pages:', error);
    return mangaList; // Return what we have
  }
}

// Import history to YouRead
async function importHistoryToYouRead(mangaList, tab) {
  const statusDiv = document.getElementById('status');
  const mangaInfoDiv = document.getElementById('mangaInfo');
  
  try {
    // First, try to collect from all pages
    statusDiv.innerHTML = '<div class="status info">🔄 Collecting manga from all pages... This may take a moment.</div>';
    mangaInfoDiv.innerHTML = '<div class="loading">Please wait while we collect all your manga...</div>';
    
    const allManga = await importAllPages(tab, mangaList);
    
    statusDiv.innerHTML = `<div class="status success">✓ Collected ${allManga.length} manga from all pages!</div>`;
    mangaInfoDiv.innerHTML = `<div class="manga-info"><h3>Ready to Import</h3><p>Found <strong>${allManga.length}</strong> total manga</p></div>`;
    
    // Store all manga for website to pick up
    await chrome.storage.local.set({ pendingBulkImport: allManga });
    
    // Open YouRead website with bulk import data
    const importData = JSON.stringify(allManga);
    chrome.tabs.create({ 
      url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(importData)}` 
    });
    
    // Close popup after a short delay
    setTimeout(() => window.close(), 500);
  } catch (error) {
    console.error('Error importing history:', error);
    statusDiv.innerHTML = '<div class="status error">Error collecting pages. Importing current page only.</div>';
    
    // Fallback: just import current page
    await chrome.storage.local.set({ pendingBulkImport: mangaList });
    chrome.tabs.create({ 
      url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(JSON.stringify(mangaList))}` 
    });
    setTimeout(() => window.close(), 500);
  }
}

// Show manga information
function showMangaInfo(manga, mangaInfoDiv, actionsDiv) {
  mangaInfoDiv.innerHTML = `
    <div class="manga-info">
      <h3>${manga.title}</h3>
      ${manga.author ? `<p>Author: ${manga.author}</p>` : ''}
      ${manga.chapters ? `<p>Chapters: ${manga.chapters}</p>` : ''}
      ${manga.status ? `<p>Status: ${manga.status}</p>` : ''}
    </div>
  `;

  actionsDiv.innerHTML = `
    <button class="button primary" id="addToYouRead">
      Add to YouRead
    </button>
    <button class="button secondary" onclick="window.open('${YOUREAD_URL}', '_blank')">
      Open YouRead
    </button>
  `;

  document.getElementById('addToYouRead').addEventListener('click', () => {
    addToYouRead(manga);
  });
}

// Add manga to YouRead
async function addToYouRead(manga) {
  try {
    // Store manga for website to pick up
    await chrome.storage.local.set({ pendingManga: manga });
    
    // Open YouRead website
    chrome.tabs.create({ 
      url: `${YOUREAD_URL}?manga=${encodeURIComponent(JSON.stringify(manga))}` 
    });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Error adding to YouRead:', error);
    alert('Error adding manga. Please try opening YouRead manually.');
  }
}

// Initialize when popup opens
initPopup();

