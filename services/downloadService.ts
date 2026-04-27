export const downloadMediaFile = async (
  url: string,
  filename: string
): Promise<void> => {
  const downloadUrl = `/api/download?url=${encodeURIComponent(
    url
  )}&filename=${encodeURIComponent(filename)}`;

  if (url.startsWith("youtube:")) {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      let message = "Could not download media";
      try {
        const data = await response.json();
        message = data.msg || message;
      } catch {
        // Keep default message for non-JSON failures.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(anchor);
    return;
  }

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
