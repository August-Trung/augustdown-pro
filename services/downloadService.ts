export const downloadMediaFile = async (
  url: string,
  filename: string
): Promise<void> => {
  const downloadUrl = `/api/download?url=${encodeURIComponent(
    url
  )}&filename=${encodeURIComponent(filename)}`;

  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const getPreviewUrl = (url?: string): string => {
  if (!url) return "/ver-bigger-logo.png";
  if (url.startsWith("/")) return url;
  return `/api/preview?url=${encodeURIComponent(url)}`;
};
