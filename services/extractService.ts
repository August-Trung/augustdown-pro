import { ExtractResponse, Platform } from "../types";

export const facebookCookieKey = "augustdown_facebook_cookie_v1";
export const youtubeCookieKey = "augustdown_youtube_cookie_v1";

const getStoredCookie = (key: string) => localStorage.getItem(key) || "";
const normalizeCookieInput = (value: string) => value.trim();
const hasFacebookCookieKeys = (cookie: string) =>
  /(?:^|;\s*)c_user=/.test(cookie) && /(?:^|;\s*)xs=/.test(cookie);
const hasYouTubeCookieKeys = (cookie: string) =>
  /(?:^|;\s*)VISITOR_INFO1_LIVE=/.test(cookie) ||
  /(?:^|;\s*)__Secure-/.test(cookie) ||
  /(?:^|;\s*)SID=/.test(cookie) ||
  /(?:^|;\s*)LOGIN_INFO=/.test(cookie);

export const getFacebookCookie = () => getStoredCookie(facebookCookieKey);
export const getYouTubeCookie = () => getStoredCookie(youtubeCookieKey);

export const fetchExtractedMedia = async (
  platform: Platform,
  url: string
): Promise<ExtractResponse> => {
  const cleanUrl = url.trim();
  if (!cleanUrl) throw new Error("URL is empty");

  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      platform,
      url: cleanUrl,
      cookies: {
        facebook: getFacebookCookie(),
        youtube: getYouTubeCookie(),
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Could not fetch media");
  }

  return data;
};

export const fetchFacebookSession = async (): Promise<{
  configured: boolean;
  source: string;
}> => {
  return {
    configured: Boolean(getFacebookCookie()),
    source: "localStorage",
  };
};

export const saveFacebookSession = async (cookie: string): Promise<void> => {
  const normalizedCookie = normalizeCookieInput(cookie);
  if (!hasFacebookCookieKeys(normalizedCookie)) {
    throw new Error("Cookie Facebook cần có ít nhất c_user và xs.");
  }
  localStorage.setItem(facebookCookieKey, normalizedCookie);
};

export const clearFacebookSession = async (): Promise<void> => {
  localStorage.removeItem(facebookCookieKey);
};

export const fetchYouTubeSession = async (): Promise<{
  configured: boolean;
  source: string;
}> => {
  return {
    configured: Boolean(getYouTubeCookie()),
    source: "localStorage",
  };
};

export const saveYouTubeSession = async (cookie: string): Promise<void> => {
  const normalizedCookie = normalizeCookieInput(cookie);
  if (!hasYouTubeCookieKeys(normalizedCookie)) {
    throw new Error("Cookie YouTube không hợp lệ.");
  }
  localStorage.setItem(youtubeCookieKey, normalizedCookie);
};

export const clearYouTubeSession = async (): Promise<void> => {
  localStorage.removeItem(youtubeCookieKey);
};
