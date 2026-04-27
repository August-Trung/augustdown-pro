import { ExtractResponse, Platform } from "../types";

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
    body: JSON.stringify({ platform, url: cleanUrl }),
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
  const response = await fetch("/api/facebook/session");
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Could not read Facebook session");
  }
  return data;
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
};

export const clearFacebookSession = async (): Promise<void> => {
  const response = await fetch("/api/facebook/session", {
    method: "DELETE",
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Could not clear Facebook session");
  }
};
