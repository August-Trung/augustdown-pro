import express from "express";
import cors from "cors";
import { instagramGetUrl } from "instagram-url-direct";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const app = express();
const port = Number(process.env.PORT || 8788);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const supportedPlatforms = new Set(["instagram", "tiktok"]);

const platformLabels = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  twitter: "X/Twitter",
};

const sanitizeFilename = (value) => {
  const filename = String(value || "augustdown-media.mp4")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 140);

  return filename || "augustdown-media.mp4";
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const extensionFor = (type, fallback = "mp4") => {
  if (type === "image") return "jpg";
  if (type === "audio") return "mp3";
  return fallback;
};

const filenameFor = (platform, id, index, type, title) => {
  const base = String(title || `${platform}-${id}`)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return sanitizeFilename(
    `${platform}-${base || id}-${index + 1}.${extensionFor(type)}`
  );
};

const isUrlForHost = (value, matcher) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && matcher(parsed.hostname);
  } catch {
    return false;
  }
};

const isInstagramUrl = (value) =>
  isUrlForHost(value, (hostname) => /(^|\.)instagram\.com$/i.test(hostname));

const isTikTokUrl = (value) =>
  isUrlForHost(value, (hostname) =>
    /(^|\.)((tiktok\.com)|(vm\.tiktok\.com)|(vt\.tiktok\.com))$/i.test(hostname)
  );

const makeInstagramId = (url) => {
  const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([^/?#]+)/i);
  return match?.[1] || String(Date.now());
};

const normalizeInstagramUrl = (value) => {
  const parsed = new URL(value);
  const match = parsed.pathname.match(/^\/(reel|p|tv)\/([^/]+)/i);
  if (!match) return value;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
};

const isAllowedMediaUrl = (value) =>
  isUrlForHost(value, (hostname) =>
    /(^|\.)(fbcdn\.net|cdninstagram\.com|instagram\.com|tikwm\.com|tiktokcdn(?:-[a-z0-9]+)?\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|muscdn\.com|snssdk\.com)$/i.test(
      hostname
    )
  );

const ok = (data, startedAt) => ({
  code: 0,
  msg: "success",
  processed_time: (Date.now() - startedAt) / 1000,
  data,
});

const publicInstagramError =
  "Instagram không trả dữ liệu media cho link này. Hãy kiểm tra link có public không, không phải story/private/deleted, rồi thử lại.";

const extractInstagram = async (sourceUrl) => {
  if (!isInstagramUrl(sourceUrl)) {
    const error = new Error("Vui lòng nhập link Instagram hợp lệ.");
    error.status = 400;
    throw error;
  }

  const cleanSourceUrl = normalizeInstagramUrl(sourceUrl);
  let result;
  try {
    result = await instagramGetUrl(cleanSourceUrl);
  } catch (error) {
    if (String(error?.message || "").includes("Only posts/reels supported")) {
      throw new Error(publicInstagramError);
    }
    throw error;
  }
  const mediaDetails = Array.isArray(result.media_details)
    ? result.media_details
    : [];

  if (!mediaDetails.length) {
    throw new Error("Không tìm thấy media trong link Instagram này.");
  }

  const postInfo = result.post_info || {};
  const id = makeInstagramId(cleanSourceUrl);
  const username = postInfo.owner_username || "instagram";
  const title = `Instagram media by @${username}`;

  const media = mediaDetails.map((item, index) => {
    const type = item.type === "image" ? "image" : "video";
    return {
      id: `${id}-${index + 1}`,
      type,
      url: item.url,
      thumbnail: item.thumbnail || item.url,
      filename: filenameFor("instagram", id, index, type, title),
      width: toNumber(item.dimensions?.width),
      height: toNumber(item.dimensions?.height),
    };
  });

  return {
    platform: "instagram",
    id,
    sourceUrl: cleanSourceUrl,
    title,
    cover: media[0].thumbnail,
    author: {
      id: username,
      unique_id: username,
      nickname: postInfo.owner_fullname || username,
      avatar: "/ver-bigger-logo.png",
      verified: Boolean(postInfo.is_verified),
      private: Boolean(postInfo.is_private),
    },
    media,
  };
};

const extractTikTok = async (sourceUrl) => {
  if (!isTikTokUrl(sourceUrl)) {
    const error = new Error("Vui lòng nhập link TikTok hợp lệ.");
    error.status = 400;
    throw error;
  }

  const response = await fetch(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(sourceUrl)}&hd=1`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`TikWM responded ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 0 || !result.data) {
    throw new Error(result.msg || "Không thể lấy dữ liệu TikTok.");
  }

  const data = result.data;
  const id = String(data.id || Date.now());
  const title = data.title || "TikTok media";
  const cover = data.cover || data.origin_cover || "/ver-bigger-logo.png";
  const media = [];

  const images = Array.isArray(data.images) ? data.images : [];
  if (images.length) {
    images.forEach((url, index) => {
      media.push({
        id: `${id}-image-${index + 1}`,
        type: "image",
        url,
        thumbnail: url,
        filename: filenameFor("tiktok", id, index, "image", title),
      });
    });
  } else {
    const videoUrl = data.hdplay || data.play || data.wmplay;
    if (videoUrl) {
      media.push({
        id: `${id}-video-1`,
        type: "video",
        url: videoUrl,
        thumbnail: cover,
        filename: filenameFor("tiktok", id, 0, "video", title),
      });
    }
  }

  const audioUrl = data.music || data.music_info?.play;
  if (audioUrl) {
    media.push({
      id: `${id}-audio-1`,
      type: "audio",
      url: audioUrl,
      thumbnail: data.music_info?.cover || cover,
      filename: filenameFor("tiktok", id, media.length, "audio", title),
    });
  }

  if (!media.length) {
    throw new Error("Không tìm thấy media trong link TikTok này.");
  }

  const author = data.author || {};
  return {
    platform: "tiktok",
    id,
    sourceUrl,
    title,
    cover,
    author: {
      id: String(author.id || author.unique_id || "tiktok"),
      unique_id: String(author.unique_id || author.id || "tiktok"),
      nickname: String(author.nickname || author.unique_id || "TikTok"),
      avatar: author.avatar || "/ver-bigger-logo.png",
    },
    media,
  };
};

const extractByPlatform = async (platform, url) => {
  if (platform === "instagram") return extractInstagram(url);
  if (platform === "tiktok") return extractTikTok(url);

  const label = platformLabels[platform] || platform || "Platform";
  const error = new Error(`${label} đang ở trạng thái coming soon hoặc experimental.`);
  error.status = 501;
  throw error;
};

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "augustdown-pro",
    platforms: {
      instagram: "ready",
      tiktok: "ready",
      facebook: "experimental",
      youtube: "coming_soon",
      twitter: "coming_soon",
    },
  });
});

app.get("/api/download", async (req, res) => {
  const url = String(req.query.url || "").trim();
  const filename = sanitizeFilename(req.query.filename);

  if (!url || !isAllowedMediaUrl(url)) {
    return res.status(400).json({
      code: 1,
      msg: "Media URL không hợp lệ.",
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: url.includes("tik") ? "https://www.tiktok.com/" : "https://www.instagram.com/",
      },
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`Upstream responded ${upstream.status}`);
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    console.error("Media download failed:", error);
    if (!res.headersSent) {
      res.status(502).json({
        code: 1,
        msg: "Không thể tải media qua server.",
      });
    } else {
      res.destroy(error);
    }
  }
});

app.get("/api/preview", async (req, res) => {
  const url = String(req.query.url || "").trim();

  if (!url || !isAllowedMediaUrl(url)) {
    return res.status(400).json({
      code: 1,
      msg: "Preview URL không hợp lệ.",
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: url.includes("tik") ? "https://www.tiktok.com/" : "https://www.instagram.com/",
      },
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`Upstream responded ${upstream.status}`);
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=1800");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    console.error("Media preview failed:", error);
    if (!res.headersSent) {
      res.redirect(302, "/ver-bigger-logo.png");
    } else {
      res.destroy(error);
    }
  }
});

app.post("/api/extract", async (req, res) => {
  const startedAt = Date.now();
  const platform = String(req.body?.platform || "").trim().toLowerCase();
  const url = String(req.body?.url || "").trim();

  if (!platform || !url) {
    return res.status(400).json({
      code: 1,
      msg: "Vui lòng chọn nền tảng và nhập link.",
    });
  }

  if (!supportedPlatforms.has(platform)) {
    return res.status(501).json({
      code: 1,
      msg: `${platformLabels[platform] || platform} chưa được hỗ trợ.`,
    });
  }

  try {
    const data = await extractByPlatform(platform, url);
    res.json(ok(data, startedAt));
  } catch (error) {
    console.error(`${platformLabels[platform] || platform} fetch failed:`, error);
    res.status(error.status || 502).json({
      code: 1,
      msg:
        error?.message ||
        "Không thể lấy media. Link private, story hoặc link hết hạn có thể không được hỗ trợ.",
    });
  }
});

app.post("/api/instagram", async (req, res) => {
  const startedAt = Date.now();
  const url = String(req.body?.url || "").trim();

  try {
    const data = await extractInstagram(url);
    res.json(ok(data, startedAt));
  } catch (error) {
    res.status(error.status || 502).json({
      code: 1,
      msg: error?.message || "Không thể lấy media Instagram.",
    });
  }
});

app.post("/api/tiktok", async (req, res) => {
  const startedAt = Date.now();
  const url = String(req.body?.url || "").trim();

  try {
    const data = await extractTikTok(url);
    res.json(ok(data, startedAt));
  } catch (error) {
    res.status(error.status || 502).json({
      code: 1,
      msg: error?.message || "Không thể lấy media TikTok.",
    });
  }
});

app.listen(port, () => {
  console.log(`AugustDown Pro API running at http://localhost:${port}`);
});
