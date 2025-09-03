# QuickDiff 🔍

A side-by-side code comparison tool I built because I got tired of manually comparing JSON files and switching between tabs to spot differences.

👉 Live demo: [https://quickdiff.dev](https://quickdiff.dev)


## What it does

- Compare code/text files side-by-side with Monaco Editor (the same engine VS Code uses)
- Works completely offline - no uploading files to random servers
- Auto-detects programming languages for syntax highlighting
- Share comparisons via URL without needing a backend
- Export/import comparisons as .qdiff files
- Format code with built-in prettifiers
- Fullscreen mode for better viewing

## Why I built this 🤷‍♂️

Two weeks ago I was comparing some JSON API responses and it was really tedious. Existing tools either required uploading sensitive files to servers or just felt clunky. I wanted something that felt like VS Code but focused on diffs.

Started as a "let me see if I can build this" weekend project and turned into something I actually use daily now.

## Getting started

Just open it in your browser - no setup needed. Drag files into the left/right panels or paste content directly.

For development:
```bash
npm install
npm run dev
```

## Features

- **File handling**: Drag & drop, file picker, or paste from clipboard
- **Language support**: JavaScript, Python, JSON, SQL, HTML, CSS, and more with auto-detection
- **Sharing**: Generate URLs for quick sharing (data gets compressed into the URL)
- **Export**: Save as .qdiff files for larger comparisons
- **Customization**: Toggle whitespace handling, word wrap, layout modes
- **Keyboard shortcuts**: F11 for fullscreen, Shift+Alt+F to format, etc.
- **PWA**: Install as a desktop app, works offline

## Tech stack

- Monaco Editor for the diff engine
- Vanilla JavaScript (no framework needed)
- Cloudflare Workers for hosting
- Service Worker for offline functionality

## How sharing works 🔗

The complete content from both editors gets encoded into the URL itself - no server needed. It's basically shoving your entire comparison into the URL bar (don't worry, it's compressed). For larger files that would make URLs stupidly long, you can export as .qdiff files instead. When someone opens a shared link, it loads in read-only mode to prevent accidental "oops I deleted everything" moments.

## Deployment

```bash
npm run deploy
```

Deploys to Cloudflare Workers. The `wrangler.toml` config handles static asset serving.

## License

No license file yet - need to add one.
