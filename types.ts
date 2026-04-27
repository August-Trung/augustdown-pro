export type Platform = "instagram" | "tiktok" | "facebook" | "youtube" | "twitter";

export type MediaType = "video" | "image" | "audio";

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  thumbnail: string;
  filename: string;
  label?: string;
  width?: number;
  height?: number;
}

export interface ExtractedMediaData {
  platform: Platform;
  id: string;
  sourceUrl: string;
  title: string;
  cover: string;
  media: MediaItem[];
  author: {
    id: string;
    unique_id: string;
    nickname: string;
    avatar: string;
    verified?: boolean;
    private?: boolean;
  };
}

export interface ExtractResponse {
  code: number;
  msg: string;
  processed_time: number;
  data: ExtractedMediaData;
}
