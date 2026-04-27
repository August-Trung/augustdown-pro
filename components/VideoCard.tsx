import React, { useState } from "react";
import { ExtractedMediaData, MediaItem } from "../types";
import { downloadMediaFile, getPreviewUrl } from "../services/downloadService";

interface VideoCardProps {
  data: ExtractedMediaData;
  t: any;
}

const VideoCard: React.FC<VideoCardProps> = ({ data, t }) => {
  const [localDownloading, setLocalDownloading] = useState<string | null>(null);
  const [selected, setSelected] = useState(data.media[0]);

  const handleDownload = async (item: MediaItem) => {
    setLocalDownloading(item.id);
    try {
      await downloadMediaFile(item.url, item.filename);
    } catch (error) {
      console.error(error);
    } finally {
      setLocalDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    setLocalDownloading("all");
    try {
      for (const item of data.media) {
        await downloadMediaFile(item.url, item.filename);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLocalDownloading(null);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(selected.url);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="glass-morphism rounded-xl overflow-hidden border border-white/10 shadow-xl flex flex-col md:flex-row h-auto md:min-h-[320px]">
        <div className="w-full md:w-[260px] relative shrink-0 bg-black overflow-hidden">
          {selected.type === "video" ? (
            <video
              src={selected.url}
              poster={getPreviewUrl(selected.thumbnail)}
              className="w-full h-full object-cover aspect-video md:aspect-auto"
              controls
              playsInline
            />
          ) : selected.type === "audio" ? (
            <div className="w-full h-full min-h-[220px] flex items-center justify-center bg-zinc-950 p-5">
              <audio src={selected.url} controls className="w-full" />
            </div>
          ) : (
            <img
              src={getPreviewUrl(selected.url)}
              alt={data.title}
              className="w-full h-full object-cover aspect-video md:aspect-auto"
            />
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <div className="bg-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black italic text-white uppercase tracking-tight shadow-lg">
              {selected.type}
            </div>
            {selected.width && selected.height && (
              <div className="text-[9px] font-bold text-white/90 bg-black/50 px-1 rounded backdrop-blur-sm">
                {selected.width}x{selected.height}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={getPreviewUrl(data.author.avatar)}
                  className="w-9 h-9 rounded-full border border-white/10 shadow-lg"
                  alt={data.author.nickname}
                />
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm leading-none mb-0.5">
                    {data.author.nickname}
                  </h3>
                  <p className="text-zinc-500 text-[10px] font-medium tracking-tight">
                    @{data.author.unique_id}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-white font-black text-xs">
                  {data.platform.toUpperCase()}
                </span>
                <span className="text-zinc-500 text-[8px] uppercase font-black tracking-widest opacity-70">
                  {data.media.length} items
                </span>
              </div>
            </div>

            <p className="text-zinc-300 text-[11px] mb-4 line-clamp-3 font-medium text-left leading-relaxed">
              {data.title}
            </p>

            {data.media.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {data.media.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`relative aspect-square overflow-hidden rounded-lg border transition-all ${
                      selected.id === item.id
                        ? "border-rose-400"
                        : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                    title={`Media ${index + 1}`}
                  >
                    <img
                      src={getPreviewUrl(item.thumbnail)}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 rounded">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {data.media.length > 1 && (
              <button
                onClick={handleDownloadAll}
                disabled={localDownloading === "all"}
                className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-rose-500 flex items-center justify-center gap-2.5 shadow-xl shadow-rose-500/10 active:scale-[0.98] disabled:opacity-50"
              >
                {localDownloading === "all" && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {localDownloading === "all" ? t.processing : t.btnDownloadAll}
              </button>
            )}
            <button
              onClick={() => handleDownload(selected)}
              disabled={localDownloading === selected.id}
              className="w-full py-3 bg-white text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-rose-500 hover:text-white flex items-center justify-center gap-2.5 shadow-xl shadow-rose-500/5 active:scale-[0.98] disabled:opacity-50"
            >
              {localDownloading === selected.id && (
                <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              )}
              {localDownloading === selected.id ? t.processing : t.btnNoWm}
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => window.open(data.sourceUrl, "_blank", "noopener,noreferrer")}
                className="py-2.5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all"
              >
                {t.btnWm}
              </button>
              <button
                onClick={copyLink}
                className="py-2.5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all"
              >
                {t.btnAudio}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
