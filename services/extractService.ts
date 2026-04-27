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
