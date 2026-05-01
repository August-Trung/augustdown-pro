import { ExtractResponse, Platform } from "../types";

export const facebookCookieKey = "augustdown_facebook_cookie_v1";
export const youtubeCookieKey = "augustdown_youtube_cookie_v1";

const getStoredCookie = (key: string) => localStorage.getItem(key) || "";

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
  const response = await fetch("/api/facebook/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cookie }),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Could not save Facebook session");
  }
  localStorage.setItem(facebookCookieKey, cookie);
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
  const response = await fetch("/api/youtube/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cookie }),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Could not save YouTube session");
  }
  localStorage.setItem(youtubeCookieKey, cookie);
};

export const clearYouTubeSession = async (): Promise<void> => {
  localStorage.removeItem(youtubeCookieKey);
};
