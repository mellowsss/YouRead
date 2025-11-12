# How to Publish Your Extension to Chrome Web Store

## Step 1: Prepare Your Extension

### 1.1 Create Icons (Required)
Before publishing, you MUST create the icon files:

1. Open `icons/generate-logo-icons.html` in your browser
2. Click "Generate Icons"
3. Right-click each canvas and save as:
   - `icon16.png` (16x16)
   - `icon48.png` (48x48)
   - `icon128.png` (128x128)
4. Save them in the `icons/` folder

### 1.2 Update Configuration
Make sure the YouRead URL is correct in:
- `background.js` (line 3)
- `content.js` (line 5)
- `popup.js` (line 3)

### 1.3 Create a ZIP File
1. Make sure all icon files exist
2. Create a ZIP of the entire `extension` folder
3. Name it something like `youread-extension-v1.0.0.zip`

## Step 2: Create a Chrome Web Store Developer Account

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the **one-time $5 registration fee** (if you haven't already)
4. Accept the Developer Agreement

## Step 3: Package Your Extension

### Option A: Create ZIP Manually
1. Make sure you have all required files:
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `popup.html`
   - `popup.js`
   - `icons/icon16.png`
   - `icons/icon48.png`
   - `icons/icon128.png`

2. Create a ZIP file containing ONLY these files (no folders, or keep folder structure)
3. Test the ZIP by loading it as an unpacked extension first

### Option B: Use Chrome's Pack Extension (Optional)
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Pack extension"
4. Select your extension folder
5. Chrome will create a `.crx` file (but you'll still need a ZIP for the store)

## Step 4: Upload to Chrome Web Store

1. Go to: https://chrome.google.com/webstore/devconsole
2. Click **"New Item"** button
3. Click **"Choose File"** and select your ZIP file
4. Click **"Upload"**
5. Wait for Chrome to validate your extension

## Step 5: Fill Out Store Listing

You'll need to provide:

### Required Information:

1. **Name**: "YouRead - Manga Tracker"
2. **Summary**: Short description (132 characters max)
   - Example: "Track your manga reading progress from MangaNato automatically"
3. **Description**: Full description (can be longer)
   ```
   YouRead is a minimalistic manga tracking tool that automatically syncs 
   with MangaNato. Track your reading progress, manage your library, and 
   never lose track of what you're reading.
   
   Features:
   - Auto-detect manga from MangaNato pages
   - One-click sync to your YouRead library
   - Track reading progress and status
   - Beautiful, minimalistic design
   ```

4. **Category**: Choose "Productivity" or "Entertainment"

5. **Language**: Select your primary language

6. **Icon**: Upload a 128x128 PNG icon (use your icon128.png)

7. **Screenshots** (Required - at least 1):
   - Take screenshots of:
     - The extension popup
     - A MangaNato page with the extension working
     - Your YouRead website
   - Minimum size: 1280x800 or 640x400
   - Format: PNG or JPEG

8. **Promotional Images** (Optional but recommended):
   - Small promotional tile: 440x280
   - Large promotional tile: 920x680
   - Marquee: 1400x560

9. **Privacy**: 
   - Privacy Policy URL (if you collect data)
   - Since you use localStorage only, you can mention that

## Step 6: Set Visibility

- **Unlisted**: Only people with the link can install
- **Public**: Anyone can find and install (recommended after testing)

## Step 7: Submit for Review

1. Review all your information
2. Click **"Submit for Review"**
3. Chrome will review your extension (usually 1-3 business days)
4. You'll get an email when it's approved or if changes are needed

## Step 8: After Approval

- Your extension will be live on the Chrome Web Store
- Users can install it directly
- You can update it anytime by uploading a new version

## Important Notes:

### Privacy Policy
If your extension:
- Collects user data
- Uses external APIs
- Stores data on servers

You MUST provide a privacy policy URL. Since YouRead uses localStorage only, you can create a simple privacy policy stating that.

### Permissions
Your extension requests these permissions:
- `storage` - For saving manga data locally
- `tabs` - To detect MangaNato pages
- `activeTab` - To interact with pages

Make sure your description explains why each permission is needed.

### Testing Before Publishing
1. Load your extension as "Unpacked" in Chrome
2. Test all features thoroughly
3. Make sure icons display correctly
4. Test on different MangaNato pages
5. Verify the popup works

## Common Issues:

1. **"Invalid manifest"**: Check your manifest.json syntax
2. **"Missing icons"**: Make sure all 3 icon sizes are included
3. **"Invalid ZIP"**: Don't include the parent folder, just the extension files
4. **Rejected for permissions**: Explain clearly why you need each permission

## Quick Checklist:

- [ ] All icon files created (16, 48, 128)
- [ ] Extension tested locally
- [ ] ZIP file created with all files
- [ ] Developer account created ($5 paid)
- [ ] Store listing filled out completely
- [ ] Screenshots prepared
- [ ] Privacy policy ready (if needed)
- [ ] Description and summary written
- [ ] Ready to submit!

## Need Help?

- Chrome Web Store Help: https://support.google.com/chrome_webstore
- Developer Documentation: https://developer.chrome.com/docs/webstore

Good luck with your publication! 🚀

