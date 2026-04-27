import express from "express";
import cors from "cors";
import { instagramGetUrl } from "instagram-url-direct";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const app = express();
const port = Number(process.env.PORT || 8788);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const supportedPlatforms = new Set(["instagram", "tiktok", "facebook"]);

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

const videoExtensionForUrl = (url) => (url.includes(".m3u8") ? "m3u8" : "mp4");

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

const isFacebookUrl = (value) =>
  isUrlForHost(value, (hostname) =>
    /(^|\.)((facebook\.com)|(fb\.watch)|(m\.facebook\.com)|(web\.facebook\.com))$/i.test(hostname)
  );

const isFacebookStoryUrl = (value) => {
  try {
    return new URL(value).pathname.includes("/stories/");
  } catch {
    return false;
  }
};

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
    /(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com|cdninstagram\.com|instagram\.com|tikwm\.com|tiktokcdn(?:-[a-z0-9]+)?\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|muscdn\.com|snssdk\.com)$/i.test(
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

const decodeHtmlEntities = (value = "") =>
  String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const decodeFacebookValue = (value = "") => {
  const htmlDecoded = decodeHtmlEntities(value);
  try {
    return JSON.parse(`"${htmlDecoded.replace(/"/g, '\\"')}"`);
  } catch {
    return htmlDecoded
      .replace(/\\\//g, "/")
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003d/gi, "=");
  }
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const getMetaContent = (html, property) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return "";
};

const extractFacebookUrls = (html) => {
  const patterns = [
    /"browser_native_hd_url"\s*:\s*"([^"]+)"/g,
    /"browser_native_sd_url"\s*:\s*"([^"]+)"/g,
    /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g,
    /"playable_url_dash"\s*:\s*"([^"]+)"/g,
    /"playable_url"\s*:\s*"([^"]+)"/g,
    /"preferred_thumbnail"\s*:\s*\{[^}]*"uri"\s*:\s*"([^"]+)"/g,
    /"thumbnailImage"\s*:\s*\{[^}]*"uri"\s*:\s*"([^"]+)"/g,
    /"hd_src"\s*:\s*"([^"]+)"/g,
    /"sd_src"\s*:\s*"([^"]+)"/g,
    /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
    /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
    /hd_src_no_ratelimit:"([^"]+)"/g,
    /sd_src_no_ratelimit:"([^"]+)"/g,
    /https?:\\\/\\\/[^"'<>]+?\.m3u8[^"'<>]*/g,
    /https?:\\\/\\\/[^"'<>]+?\.mp4[^"'<>]*/g,
    /https?:\\\/\\\/[^"'<>]+?\.jpg[^"'<>]*/g,
    /https?:\\\/\\\/[^"'<>]+?\.webp[^"'<>]*/g,
    /https?:\/\/[^"'<>]+?\.m3u8[^"'<>]*/g,
    /https?:\/\/[^"'<>]+?\.mp4[^"'<>]*/g,
    /https?:\/\/[^"'<>]+?\.jpg[^"'<>]*/g,
    /https?:\/\/[^"'<>]+?\.webp[^"'<>]*/g,
  ];

  const urls = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1] || match[0];
      const decoded = decodeFacebookValue(raw);
      if (/^https?:\/\//i.test(decoded)) urls.push(decoded);
    }
  }

  return unique(urls);
};

const splitFacebookMediaUrls = (urls) => {
  const videoUrls = [];
  const imageUrls = [];

  urls.forEach((url) => {
    if (/\.(mp4|m3u8)(\?|$)/i.test(url)) {
      videoUrls.push(url);
      return;
    }
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
      imageUrls.push(url);
    }
  });

  return {
    videoUrls: unique(videoUrls),
    imageUrls: unique(imageUrls),
  };
};

const refererForMediaUrl = (url) => {
  if (/facebook|fbcdn|fbsbx/i.test(url)) return "https://www.facebook.com/";
  if (/tik/i.test(url)) return "https://www.tiktok.com/";
  return "https://www.instagram.com/";
};

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

const makeFacebookId = (url) => {
  const idMatch = url.match(/(?:videos|reel|watch|posts)\/(\d+)/i);
  if (idMatch?.[1]) return idMatch[1];

  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("v") ||
      parsed.searchParams.get("story_fbid") ||
      parsed.pathname.split("/").filter(Boolean).pop() ||
      String(Date.now())
    );
  } catch {
    return String(Date.now());
  }
};

const extractFacebook = async (sourceUrl) => {
  if (!isFacebookUrl(sourceUrl)) {
    const error = new Error("Vui lòng nhập link Facebook hợp lệ.");
    error.status = 400;
    throw error;
  }

  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Facebook responded ${response.status}.`);
  }

  const html = await response.text();
  const resolvedUrl = response.url || sourceUrl;
  const redirectedToLogin =
    /\/login(\.php)?/i.test(resolvedUrl) ||
    /id=["']login_form["']|name=["']login["']|Log in to Facebook|Đăng nhập Facebook/i.test(html);

  if (redirectedToLogin) {
    if (isFacebookStoryUrl(sourceUrl)) {
      throw new Error(
        "Facebook Story/highlight này cần đăng nhập để xem. Server hiện chưa có cookie phiên Facebook nên không thể lấy media."
      );
    }
    throw new Error(
      "Facebook yêu cầu đăng nhập cho link này. Hãy dùng link public hoặc cấu hình cookie phiên Facebook."
    );
  }

  const allMediaUrls = extractFacebookUrls(html);
  const { videoUrls, imageUrls } = splitFacebookMediaUrls(allMediaUrls);
  const cover =
    getMetaContent(html, "og:image") ||
    getMetaContent(html, "twitter:image") ||
    imageUrls[0] ||
    "/ver-bigger-logo.png";
  const title =
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title") ||
    "Facebook media";
  const description =
    getMetaContent(html, "og:description") ||
    getMetaContent(html, "description") ||
    title;
  const siteName = getMetaContent(html, "og:site_name") || "Facebook";
  const id = makeFacebookId(resolvedUrl);

  const media = videoUrls.map((url, index) => ({
    id: `${id}-video-${index + 1}`,
    type: "video",
    url,
    thumbnail: cover,
    filename: sanitizeFilename(
      `facebook-${id}-${index + 1}.${videoExtensionForUrl(url)}`
    ),
  }));

  const ogVideo = getMetaContent(html, "og:video");
  if (ogVideo && !media.some((item) => item.url === ogVideo)) {
    media.push({
      id: `${id}-video-${media.length + 1}`,
      type: "video",
      url: ogVideo,
      thumbnail: cover,
      filename: filenameFor("facebook", id, media.length, "video", title),
    });
  }

  const fallbackImages = unique([
    ...imageUrls,
    cover && cover !== "/ver-bigger-logo.png" ? cover : "",
  ]);

  if (!media.length && fallbackImages.length) {
    fallbackImages.slice(0, 6).forEach((url, index) => {
      media.push({
        id: `${id}-image-${index + 1}`,
        type: "image",
        url,
        thumbnail: url,
        filename: filenameFor("facebook", id, index, "image", title),
      });
    });
  }

  if (!media.length) {
    if (isFacebookStoryUrl(sourceUrl)) {
      throw new Error(
        "Facebook Story không trả media cho server chưa đăng nhập. Story/reel highlight thường cần cookie phiên Facebook có quyền xem."
      );
    }
    throw new Error(
      "Facebook không trả dữ liệu media cho link này. Hãy kiểm tra link có public không, không phải private/group/story/deleted, rồi thử lại."
    );
  }

  return {
    platform: "facebook",
    id,
    sourceUrl: resolvedUrl,
    title: description,
    cover,
    author: {
      id: "facebook",
      unique_id: "facebook",
      nickname: siteName,
      avatar: "/ver-bigger-logo.png",
    },
    media,
  };
};

const extractByPlatform = async (platform, url) => {
  if (platform === "instagram") return extractInstagram(url);
  if (platform === "tiktok") return extractTikTok(url);
  if (platform === "facebook") return extractFacebook(url);

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
      facebook: "ready",
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
        Referer: refererForMediaUrl(url),
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
        Referer: refererForMediaUrl(url),
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

app.post("/api/facebook", async (req, res) => {
  const startedAt = Date.now();
  const url = String(req.body?.url || "").trim();

  try {
    const data = await extractFacebook(url);
    res.json(ok(data, startedAt));
  } catch (error) {
    res.status(error.status || 502).json({
      code: 1,
      msg: error?.message || "Không thể lấy media Facebook.",
    });
  }
});

app.listen(port, () => {
  console.log(`AugustDown Pro API running at http://localhost:${port}`);
});
