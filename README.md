# QuickDiff

**The zero-server diff tool — runs 100% in your browser, nothing ever leaves your machine.**

👉 Live demo: [https://quickdiff.dev](https://https://quickdiff.dev)

---

## 🔐 Why QuickDiff?

- **Zero server dependency** — nothing is uploaded, ever.  
- **Works offline** — install as a PWA and use it anywhere.  
- **Instant** — no network roundtrips = no waiting.  

Perfect for developers who want speed, portability, and peace of mind.

---

## ✨ Features

- **Side-by-side or inline view** — switch layouts instantly.
- **Whitespace handling** — choose whether to ignore or respect whitespace.
- **Auto language detection** — or pick manually from a searchable language menu.
- **Keyboard shortcuts** — VS Code-style (format, swap, share, download, fullscreen, etc.).
- **File support**  
  - Drag & drop, paste, or load files directly.  
  - Import/export `.qdiff` bundles.  
  - Download unified diff `.patch` files.
- **Sharing** — generate sharable URLs with embedded diff data.
- **Stats** — live additions/deletions counter in the toolbar.
- **Customization** — toggle minimap, wrapping, read-only/edit modes.
- **Offline-ready** — PWA with service worker support.

---

## 📸 Demo

![QuickDiff demo screenshot](demo-screenshot.png)

---

## 🚀 Getting Started

You don’t need to install anything. Just open the [live demo](https://https://quickdiff.dev) and start comparing.

If you’d like to self-host:

```bash
git clone https://github.com/thaqiif/QuickDiff.git
cd QuickDiff
# Serve the `public/` folder with any static server
npx serve public
```

Then open `http://localhost:3000` in your browser.

---

## 🎮 Usage

1. Load or paste two files/snippets into **Left (Original)** and **Right (Modified)** panes.
2. Adjust layout, wrapping, and whitespace handling from the toolbar.
3. Use keyboard shortcuts like:
   - `Ctrl+Shift+X` → Swap sides
   - `Shift+Alt+F` → Format both sides
   - `Ctrl+Shift+S` → Share via URL
   - `Ctrl+Shift+D` → Download patch
   - `?` → Show help modal
4. Export or share your diff when ready.

---

## 🛠 Tech Stack

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the core of VS Code)
- Vanilla JS + CSS (no heavy frameworks)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) for hosting
- PWA for offline support

---

## 🤝 Contributing

Pull requests are welcome!  
If you’d like to suggest features, report bugs, or improve docs:

- Open an [issue](https://github.com/thaqiif/QuickDiff/issues)
- Fork the repo and submit a PR
