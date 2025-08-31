# QuickDiff — Offline & Instant Code Compare

A minimal Progressive Web App (PWA) for comparing code with instant diff visualization, powered by Monaco Editor.

## Features

- **Offline-first**: Works without internet connection after first load
- **Instant comparison**: Real-time side-by-side diff visualization
- **Monaco Editor**: VS Code-like editing experience
- **Keyboard shortcuts**: Efficient workflow with hotkeys
- **Export/Import**: Save and load diff files
- **Multiple languages**: Syntax highlighting for various programming languages

## PWA Installation

1. Open the app in a modern browser
2. Look for the "Install" or "Add to Home Screen" option
3. The app will work offline after installation

## Usage

1. Paste or type code in the left and right panels
2. See differences highlighted automatically
3. Use toolbar buttons for formatting, swapping, clearing, etc.
4. Press `?` for keyboard shortcuts

## Files

- `index.html` - Main application file
- `manifest.json` - PWA manifest for installation
- `sw.js` - Service worker for offline functionality

## Keyboard Shortcuts

- `?` - Show help
- `Shift+Alt+F` - Format code
- `Ctrl+Shift+S` - Share
- `Ctrl+Shift+D` - Download patch
- `Ctrl+Shift+X` - Swap sides
- `Ctrl+Shift+C` - Clear both sides

## Development

This is a single-file application with minimal dependencies. The Monaco Editor is loaded from CDN and cached for offline use.
