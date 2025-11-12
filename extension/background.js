// Background service worker for YouRead extension

const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';
// For local development, use: 'http://localhost:5173'

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANGA_DETECTED') {
    handleMangaDetected(message.manga, message.url);
    sendResponse({ success: true });
  } else if (message.type === 'HISTORY_DETECTED') {
    handleHistoryDetected(message.mangaList, message.url);
    sendResponse({ success: true });
  } else if (message.type === 'IMPORT_HISTORY') {
    importHistoryFromPage(message.tabId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async
  }
  return true; // Keep the message channel open for async response
});

// Handle detected history
async function handleHistoryDetected(mangaList, url) {
  try {
    await chrome.storage.local.set({
      detectedHistory: mangaList,
      detectedHistoryUrl: url,
      detectedHistoryTime: Date.now()
    });
    
    chrome.action.setBadgeText({ text: `${mangaList.length}` });
    chrome.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
  } catch (error) {
    console.error('Error handling history detection:', error);
  }
}

// Import history from a page
async function importHistoryFromPage(tabId) {
  try {
    // First, make sure content script is injected
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.includes('manganato')) {
      return { success: false, error: 'Not on MangaNato page' };
    }
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to send message to content script with retries
    let lastError = null;
    for (let i = 0; i < 3; i++) {
      try {
        const results = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_HISTORY' });
        if (results && results.mangaList !== undefined) {
          return { success: true, mangaList: results.mangaList || [] };
        }
      } catch (sendError) {
        lastError = sendError;
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // If all retries failed
    throw lastError || new Error('Could not communicate with content script');
  } catch (error) {
    console.error('Error importing history:', error);
    return { success: false, error: error.message };
  }
}

// Handle detected manga
async function handleMangaDetected(manga, url) {
  try {
    // Store the manga info
    await chrome.storage.local.set({
      lastDetectedManga: manga,
      lastDetectedUrl: url,
      lastDetectedTime: Date.now()
    });

    // Try to sync with YouRead website
    await syncWithYouRead(manga);

    // Update badge
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);

  } catch (error) {
    console.error('Error handling manga detection:', error);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Sync manga with YouRead website
async function syncWithYouRead(manga) {
  try {
    // Open YouRead in a new tab or use existing one
    const tabs = await chrome.tabs.query({ url: `${YOUREAD_URL}/*` });
    
    if (tabs.length > 0) {
      // Tab already open, send message to it
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'ADD_MANGA',
        manga: manga
      }).catch(() => {
        // If message fails, open new tab
        openYouReadWithManga(manga);
      });
    } else {
      // Open new tab
      openYouReadWithManga(manga);
    }
  } catch (error) {
    console.error('Error syncing with YouRead:', error);
    // Fallback: open YouRead website
    chrome.tabs.create({ url: YOUREAD_URL });
  }
}

// Open YouRead website with manga data
function openYouReadWithManga(manga) {
  // Store manga in storage for the website to pick up
  chrome.storage.local.set({ pendingManga: manga });
  
  // Open YouRead website
  chrome.tabs.create({ 
    url: `${YOUREAD_URL}?manga=${encodeURIComponent(JSON.stringify(manga))}` 
  });
}

// Listen for tab updates to detect when user navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('manganato')) {
    // Clear badge when navigating away
    chrome.action.setBadgeText({ text: '' });
  }
});

