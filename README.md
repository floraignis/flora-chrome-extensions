# Flora Uploader

![Preview](img/preview.png)

Chrome extension for batch uploading photos and videos to **OnlyFans** and **Fansly** in a custom order.

## Features

- **Drag & drop** — drop any number of photos or videos onto the panel
- **Custom order** — type a number next to any file to move it to that position; the rest renumber automatically (if the number exceeds the queue length, the file moves to last)
- **Remove files** — click the 🗑 button next to a file to remove it from the queue
- **Arrow buttons** — move files up or down one position at a time using ↑↓ buttons on each row
- **Keyboard navigation** — click a filename to select it, then use **Arrow Up / Arrow Down** keys to reorder
- **Reverse** — reverse the current order of the entire queue in one click
- **Clear** — remove all files from the queue
- **Resizable panel** — drag the bottom-left corner to resize; file previews scale with the panel width
- **Image previews** — thumbnails shown for standard image formats; HEIC/HEIF and video files show a type label instead

## Supported file types

- Images: JPEG, PNG, WebP, GIF, and other browser-supported formats
- Videos: MP4, MOV, and other browser-supported formats
- HEIC / HEIF (no thumbnail preview, uploaded as-is)

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder

## Usage

### OnlyFans

1. Open the **New Post** page (`/posts/create`)
2. Click the extension icon in the Chrome toolbar to open the uploader panel
3. Drag and drop files onto the drop zone
4. Arrange files in the desired order
5. Click **Upload in Order**

> If the upload field is not visible yet, the extension will automatically click the camera button and wait for it to appear.

### Fansly

1. Open any page with the post creation form (e.g. `/home`)
2. Click the extension icon to open the uploader panel
3. Drag and drop files onto the drop zone
4. Arrange files in the desired order
5. Click **Upload in Order**

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | Service worker — listens for toolbar icon clicks, injects scripts on demand |
| `content.js` | Main logic: panel UI, queue management, upload (works on both sites) |
| `style.css` | Panel styles, scoped under `#of-smart-uploader` |
