// Background service worker for YouRead extension

const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';
// For local development, use: 'http://localhost:5173'

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANGA_DETECTED') {
    handleMangaDetected(message.manga, message.url);
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

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

