# AugustDown Pro

Multi-platform media downloader built from the working `instadownloader-pro` React/Vite + Express app, with TikTok extraction logic added from `tokdownloader-pro`.

## Features

- Instagram public Reel, post, TV, photo, and carousel extraction via `instagram-url-direct`.
- TikTok public video/photo extraction via `https://www.tikwm.com/api/?url=...&hd=1`.
- Facebook public video/image/reel extraction from page metadata and embedded video JSON.
- YouTube public video extraction via `@distube/ytdl-core`, with `/api/download` streamed through local `yt-dlp`.
- Unified backend API: `POST /api/extract` with `{ "platform": "instagram" | "tiktok" | "facebook" | "youtube", "url": "..." }`.
- Normalized response: `platform`, `id`, `sourceUrl`, `title`, `cover`, `author`, and `media[]`.
- Downloads are proxied through `/api/download` instead of automatically opening CDN tabs.
- React UI with platform selector, paste/fetch, media preview, multi-item list, VI/EN text, and per-platform history.
- Local Facebook session cookie storage for login-gated Story/highlight attempts.
- X/Twitter is marked coming soon.

## Run

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.
Backend runs at `http://localhost:8788`.

YouTube downloads require `yt-dlp` on `PATH`:

```bash
yt-dlp --version
```

For faster YouTube 720p/1080p downloads, install `aria2c`. The backend will
auto-detect the WinGet install path or use `ARIA2C_PATH` when provided.

```bash
winget install --id aria2.aria2 --exact
```

## Build

```bash
npm run build
```

## Deploy

Production can run as one Node app:

```bash
npm install
npm run build
npm run server
```

`server.js` serves both `dist/` and `/api/*`, so the public domain should point
to this Node process. If the frontend is hosted separately as static files, set
`VITE_API_BASE_URL` at build time to the backend origin, for example:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

## API

Health check:

```bash
curl http://localhost:8788/api/health
```

Extract:

```bash
curl -X POST http://localhost:8788/api/extract \
  -H "Content-Type: application/json" \
  -d "{\"platform\":\"facebook\",\"url\":\"https://www.facebook.com/watch/?v=<public-video-id>\"}"
```

Download:

```bash
curl "http://localhost:8788/api/download?url=<media-url>&filename=media.mp4"
```

## Notes

Private, deleted, geo-blocked, story-only, group-only, login-gated, or expired URLs may fail depending on upstream platform limits. Facebook Story/highlight URLs often require a logged-in session cookie with permission to view that story. The browser stores Facebook and YouTube cookies in `localStorage` and sends them to the backend only when extracting/downloading. Download only content you have rights to use.
