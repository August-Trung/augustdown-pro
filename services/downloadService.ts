export const downloadMediaFile = async (
  url: string,
  filename: string,
  onProgress?: (status: { progress?: number; speed?: string; phase?: string }) => void
): Promise<void> => {
  const downloadUrl = `/api/download?url=${encodeURIComponent(
    url
  )}&filename=${encodeURIComponent(filename)}`;

  if (url.startsWith("youtube:")) {
    const prepareResponse = await fetch("/api/youtube/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename }),
    });
    if (!prepareResponse.ok) throw new Error("Could not prepare YouTube file");
    const prepareData = await prepareResponse.json();
    const jobId = prepareData.jobId;

    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const jobResponse = await fetch(`/api/youtube/jobs/${jobId}`);
      if (!jobResponse.ok) throw new Error("Could not check YouTube job");
      const job = await jobResponse.json();
      onProgress?.({
        progress: job.progress,
        speed: job.speed,
        phase: job.phase,
      });

      if (job.status === "error") {
        throw new Error(job.error || "Could not prepare YouTube file");
      }

      if (job.status === "ready" && job.downloadUrl) {
        const anchor = document.createElement("a");
        anchor.href = job.downloadUrl;
        anchor.download = filename;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return;
      }
    }
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
