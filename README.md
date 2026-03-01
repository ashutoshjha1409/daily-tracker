# Daily Tracker

Minimal daily task tracker with streaks, metrics, and persistent local data (IndexedDB).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Using without the dev server

The app is built as a **static export**, so you can run it without Node after building.

### Option 1: Static files (no server)

```bash
npm run build
```

This produces a static site in the **`out/`** folder. To use it:

- **Local file:** Open `out/index.html` in your browser (file://). Note: some browsers restrict IndexedDB or routing for file://; if something breaks, use Option 2.
- **Simple HTTP server:** From the project root, run:
  ```bash
  npx serve out
  ```
  Then open the URL shown (e.g. http://localhost:3000).

### Option 2: Production server (Node)

```bash
npm run build
npm run start
```

Serves the built app on port 3000. Requires Node on the machine where you run it.

### Option 3: Deploy somewhere

Upload the contents of **`out/`** to any static host (e.g. Vercel, Netlify, GitHub Pages, or a simple web server). No server-side code is required; data is stored in the browser (IndexedDB and localStorage).
