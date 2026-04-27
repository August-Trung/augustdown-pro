import express from "express";
import cors from "cors";
import { instagramGetUrl } from "instagram-url-direct";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ytdl from "@distube/ytdl-core";

const app = express();
const port = Number(process.env.PORT || 8788);
const facebookCookiePath = path.join(process.cwd(), "facebook-cookie.local");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const supportedPlatforms = new Set(["instagram", "tiktok", "facebook", "youtube"]);

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

const isYouTubeUrl = (value) => {
  try {
    return ytdl.validateURL(value);
  } catch {
    return false;
  }
};

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

const normalizeCookie = (value = "") => {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item?.name && item?.value)
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");
    }
  } catch {
    // Fall through to text parsing.
  }

  const keyValueLines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([A-Za-z0-9_.-]+)\s*[:=]\s*(.+)$/);
      return match ? `${match[1]}=${match[2]}` : "";
    })
    .filter(Boolean);

  if (
    keyValueLines.length &&
    keyValueLines.some((line) => line.startsWith("c_user=")) &&
    keyValueLines.some((line) => line.startsWith("xs="))
  ) {
    return keyValueLines.join("; ");
  }

  return input
    .replace(/\r?\n/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+/g, " ")
    .trim();
};

const getFacebookCookie = () => {
  const envCookie = normalizeCookie(process.env.FACEBOOK_COOKIE || "");
  if (envCookie) return envCookie;

  try {
    return normalizeCookie(fs.readFileSync(facebookCookiePath, "utf8"));
  } catch {
    return "";
  }
};

const hasUsableFacebookCookie = (cookie) =>
  /(?:^|;\s*)c_user=/.test(cookie) && /(?:^|;\s*)xs=/.test(cookie);

const facebookHeaders = (cookie = "") => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  ...(cookie ? { Cookie: cookie } : {}),
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

const decodeFacebookEfg = (url) => {
  try {
    const value = new URL(url).searchParams.get("efg");
    if (!value) return null;
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const facebookAssetKey = (url, index) => {
  const efg = decodeFacebookEfg(url);
  if (efg?.xpv_asset_id) return `asset:${efg.xpv_asset_id}`;
  if (efg?.asset_id) return `asset:${efg.asset_id}`;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+/g, "/");
    const file = path.split("/").filter(Boolean).pop() || "";
    return file ? `file:${file.replace(/\.(mp4|m3u8|jpg|jpeg|png|webp)$/i, "")}` : `url:${index}`;
  } catch {
    return `url:${index}`;
  }
};

const facebookVideoScore = (url) => {
  const efg = decodeFacebookEfg(url);
  const tag = String(efg?.vencode_tag || "");
  let score = 0;

  if (/\.mp4(\?|$)/i.test(url)) score += 1000;
  if (/\.m3u8(\?|$)/i.test(url)) score -= 100;
  if (/\bhd\b|\.hd|1280|1080|720/i.test(tag)) score += 500;
  if (/\bsd\b|\.sd|400/i.test(tag)) score -= 50;

  try {
    const bitrate = Number(new URL(url).searchParams.get("bitrate"));
    if (Number.isFinite(bitrate)) score += bitrate / 1000;
  } catch {
    // URL score remains usable without query parsing.
  }

  return score;
};

const chooseBestFacebookMediaUrls = (urls, type) => {
  const groups = new Map();

  urls.forEach((url, index) => {
    const key = facebookAssetKey(url, index);
    const current = groups.get(key);
    const score = type === "video" ? facebookVideoScore(url) : url.length;
    if (!current || score > current.score) {
      groups.set(key, { url, score });
    }
  });

  return [...groups.values()].map((item) => item.url);
};

const refererForMediaUrl = (url) => {
  if (/facebook|fbcdn|fbsbx/i.test(url)) return "https://www.facebook.com/";
  if (/tik/i.test(url)) return "https://www.tiktok.com/";
  return "https://www.instagram.com/";
};

const mediaHeaders = (url) => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: refererForMediaUrl(url),
  ...(/facebook|fbcdn|fbsbx/i.test(url) && getFacebookCookie()
    ? { Cookie: getFacebookCookie() }
    : {}),
});

const parseYouTubeDownloadToken = (value) => {
  const match = String(value || "").match(/^youtube:([^:]+):([^:]+)$/);
  if (!match) return null;
  return {
    videoId: match[1],
    format: match[2],
  };
};

const streamYouTubeWithYtDlp = (videoId, format, filename, res) =>
  new Promise((resolve, reject) => {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const isAudio = format === "mp3";
    const args = isAudio
      ? [
          "--quiet",
          "--no-progress",
          "--no-playlist",
          "--no-warnings",
          "--extract-audio",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--output",
          "-",
          watchUrl,
        ]
      : [
          "--quiet",
          "--no-progress",
          "--no-playlist",
          "--no-warnings",
          "--format",
          `${format}/18/best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]`,
          "--output",
          "-",
          watchUrl,
        ];
    const child = spawn(
      "yt-dlp",
      args,
      { windowsHide: true }
    );
    const stderr = [];

    res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, max-age=0, no-store");

    child.stderr.on("data", (chunk) => {
      stderr.push(chunk.toString());
    });

    child.on("error", reject);
    child.stdout.on("error", reject);
    res.on("close", () => {
      if (!res.writableEnded && !child.killed) child.kill();
    });

    child.stdout.pipe(res);
    child.on("close", (code) => {
      if (code === 0 || res.writableEnded) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.join("").trim() || `yt-dlp exited with status ${code}`
        )
      );
    });
  });

const getYouTubeInfoWithYtDlp = (sourceUrl) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "yt-dlp",
      [
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--skip-download",
        sourceUrl,
      ],
      { windowsHide: true }
    );
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(stdout).toString("utf8").trim();
      if (code !== 0) {
        reject(
          new Error(
            Buffer.concat(stderr).toString("utf8").trim() ||
              `yt-dlp exited with status ${code}`
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });
  });

const chooseYouTubeYtDlpFormat = (formats = []) => {
  const progressive = formats
    .filter(
      (format) =>
        format.vcodec &&
        format.vcodec !== "none" &&
        format.acodec &&
        format.acodec !== "none" &&
        format.ext === "mp4"
    )
    .sort((a, b) => (toNumber(b.height) || 0) - (toNumber(a.height) || 0));

  return progressive[0] || formats.find((format) => format.format_id === "18");
};

const getYouTubeDownloadOptions = (info, cover) => {
  const id = info.id || "";
  const videoFormats = (info.formats || [])
    .filter(
      (format) =>
        format.format_id &&
        format.vcodec &&
        format.vcodec !== "none" &&
        format.acodec &&
        format.acodec !== "none" &&
        format.ext === "mp4" &&
        toNumber(format.height)
    )
    .sort((a, b) => (toNumber(b.height) || 0) - (toNumber(a.height) || 0));
  const seenHeights = new Set();
  const media = [];

  for (const format of videoFormats) {
    const height = toNumber(format.height);
    if (!height || seenHeights.has(height)) continue;
    seenHeights.add(height);
    const label = `MP4 ${format.format_note || `${height}p`}`;
    media.push({
      id: `${id}-${format.format_id}`,
      type: "video",
      url: `youtube:${id}:${format.format_id}`,
      thumbnail: cover,
      filename: sanitizeFilename(`youtube-${id}-${height}p.mp4`),
      label,
      width: toNumber(format.width),
      height,
    });
  }

  media.push({
    id: `${id}-mp3`,
    type: "audio",
    url: `youtube:${id}:mp3`,
    thumbnail: cover,
    filename: sanitizeFilename(`youtube-${id}-audio.mp3`),
    label: "MP3 audio",
  });

  return media;
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

  const facebookCookie = getFacebookCookie();
  const hasCookie = hasUsableFacebookCookie(facebookCookie);
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: facebookHeaders(facebookCookie),
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
    if (!hasCookie) {
      throw new Error(
        isFacebookStoryUrl(sourceUrl)
          ? "Facebook Story/highlight cần cookie phiên Facebook. Hãy lưu cookie Facebook trong phần cấu hình rồi thử lại."
          : "Facebook yêu cầu đăng nhập cho link này. Hãy lưu cookie Facebook trong phần cấu hình."
      );
    }
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
  const { videoUrls: rawVideoUrls, imageUrls: rawImageUrls } =
    splitFacebookMediaUrls(allMediaUrls);
  const videoUrls = chooseBestFacebookMediaUrls(rawVideoUrls, "video");
  const imageUrls = chooseBestFacebookMediaUrls(rawImageUrls, "image");
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
    thumbnail: url,
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
      thumbnail: ogVideo,
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
      if (!hasCookie) {
        throw new Error(
          "Facebook Story/highlight cần cookie phiên Facebook. Hãy lưu cookie Facebook trong phần cấu hình rồi thử lại."
        );
      }
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

const chooseYouTubeFormat = (formats) => {
  const progressive = formats
    .filter((format) => format.hasVideo && format.hasAudio && format.url)
    .sort((a, b) => {
      const aHeight = toNumber(a.height) || 0;
      const bHeight = toNumber(b.height) || 0;
      return bHeight - aHeight;
    });

  if (progressive.length) return progressive[0];

  return formats
    .filter((format) => format.hasVideo && format.url)
    .sort((a, b) => (toNumber(b.height) || 0) - (toNumber(a.height) || 0))[0];
};

const extractYouTube = async (sourceUrl) => {
  if (!isYouTubeUrl(sourceUrl)) {
    const error = new Error("Vui lòng nhập link YouTube hợp lệ.");
    error.status = 400;
    throw error;
  }

  const info = await getYouTubeInfoWithYtDlp(sourceUrl);
  const thumbnails = Array.isArray(info.thumbnails) ? info.thumbnails : [];
  const cover =
    info.thumbnail ||
    thumbnails.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ||
    "/ver-bigger-logo.png";
  const id = info.id || ytdl.getURLVideoID(sourceUrl);
  const media = getYouTubeDownloadOptions({ ...info, id }, cover);
  if (!media.length) {
    throw new Error("Không tìm thấy định dạng tải phù hợp cho video YouTube này.");
  }

  return {
    platform: "youtube",
    id,
    sourceUrl: info.webpage_url || `https://www.youtube.com/watch?v=${id}`,
    title: info.title || "YouTube video",
    cover,
    author: {
      id: info.channel_id || info.uploader_id || info.channel || "youtube",
      unique_id: info.uploader_id || info.channel || info.uploader || "youtube",
      nickname: info.uploader || info.channel || "YouTube",
      avatar: "/ver-bigger-logo.png",
      verified: Boolean(info.channel_is_verified),
    },
    media,
  };
};

const extractByPlatform = async (platform, url) => {
  if (platform === "instagram") return extractInstagram(url);
  if (platform === "tiktok") return extractTikTok(url);
  if (platform === "facebook") return extractFacebook(url);
  if (platform === "youtube") return extractYouTube(url);

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
      youtube: "ready",
      twitter: "coming_soon",
    },
  });
});

app.get("/api/download", async (req, res) => {
  const url = String(req.query.url || "").trim();
  const filename = sanitizeFilename(req.query.filename);
  const youtubeDownload = parseYouTubeDownloadToken(url);

  if (youtubeDownload) {
    try {
      await streamYouTubeWithYtDlp(
        youtubeDownload.videoId,
        youtubeDownload.format,
        filename,
        res
      );
      return;
    } catch (error) {
      console.error("YouTube download failed:", error);
      if (!res.headersSent) {
        return res.status(502).json({
          code: 1,
          msg: error?.message || "Không thể tải video YouTube qua server.",
        });
      }
      res.destroy(error);
      return;
    }
  }

  if (!url || !isAllowedMediaUrl(url)) {
    return res.status(400).json({
      code: 1,
      msg: "Media URL không hợp lệ.",
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: mediaHeaders(url),
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
  const youtubeDownload = parseYouTubeDownloadToken(url);

  if (youtubeDownload) {
    return res.redirect(
      302,
      `https://i.ytimg.com/vi/${encodeURIComponent(youtubeDownload.videoId)}/hqdefault.jpg`
    );
  }

  if (!url || !isAllowedMediaUrl(url)) {
    return res.status(400).json({
      code: 1,
      msg: "Preview URL không hợp lệ.",
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: mediaHeaders(url),
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

app.get("/api/facebook/session", (_req, res) => {
  const cookie = getFacebookCookie();
  res.json({
    code: 0,
    configured: hasUsableFacebookCookie(cookie),
    source: process.env.FACEBOOK_COOKIE ? "env" : cookie ? "local" : "none",
  });
});

app.post("/api/facebook/session", (req, res) => {
  const cookie = normalizeCookie(req.body?.cookie || "");

  if (!hasUsableFacebookCookie(cookie)) {
    return res.status(400).json({
      code: 1,
      msg: "Cookie Facebook cần có ít nhất c_user và xs.",
    });
  }

  fs.writeFileSync(facebookCookiePath, cookie, "utf8");
  res.json({ code: 0, configured: true });
});

app.delete("/api/facebook/session", (_req, res) => {
  try {
    fs.rmSync(facebookCookiePath, { force: true });
  } catch {
    // File is optional.
  }
  res.json({ code: 0, configured: Boolean(process.env.FACEBOOK_COOKIE) });
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

app.post("/api/youtube", async (req, res) => {
  const startedAt = Date.now();
  const url = String(req.body?.url || "").trim();

  try {
    const data = await extractYouTube(url);
    res.json(ok(data, startedAt));
  } catch (error) {
    res.status(error.status || 502).json({
      code: 1,
      msg: error?.message || "Không thể lấy video YouTube.",
    });
  }
});

app.listen(port, () => {
  console.log(`AugustDown Pro API running at http://localhost:${port}`);
});
