# AugustDown Pro

Multi-platform media downloader built from the working `instadownloader-pro` React/Vite + Express app, with TikTok extraction logic added from `tokdownloader-pro`.

## Features

- Instagram public Reel, post, TV, photo, and carousel extraction via `instagram-url-direct`.
- TikTok public video/photo extraction via `https://www.tikwm.com/api/?url=...&hd=1`.
- Facebook public video/image/reel extraction from page metadata and embedded video JSON.
- Unified backend API: `POST /api/extract` with `{ "platform": "instagram" | "tiktok", "url": "..." }`.
- Normalized response: `platform`, `id`, `sourceUrl`, `title`, `cover`, `author`, and `media[]`.
- Downloads are proxied through `/api/download` instead of automatically opening CDN tabs.
- React UI with platform selector, paste/fetch, media preview, multi-item list, VI/EN text, and per-platform history.
- Local Facebook session cookie storage for login-gated Story/highlight attempts.
- YouTube and X/Twitter are marked coming soon.

## Run

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.
Backend runs at `http://localhost:8788`.

## Build

```bash
npm run build
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

Private, deleted, geo-blocked, story-only, group-only, login-gated, or expired URLs may fail depending on upstream platform limits. Facebook Story/highlight URLs often require a logged-in session cookie with permission to view that story. For local use, select Facebook and paste either a raw cookie header, a JSON cookie export, or `c_user: ...` / `xs: ...` lines; it is saved to ignored local file `facebook-cookie.local`. Download only content you have rights to use.
