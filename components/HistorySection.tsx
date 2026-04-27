import React from "react";
import { ExtractedMediaData } from "../types";
import { getPreviewUrl } from "../services/downloadService";

interface HistorySectionProps {
  history: ExtractedMediaData[];
  onView: (item: ExtractedMediaData) => void;
  onDownload: (url: string, filename: string) => void;
  onClear: () => void;
  t: any;
}

const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  onView,
  onDownload,
  onClear,
  t,
}) => {
  if (history.length === 0) return null;

  return (
    <section className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {t.historyTitle} <span className="ml-1 text-zinc-700">({history.length})</span>
        </h3>
        <button
          onClick={onClear}
          className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
        >
          {t.clearHistory}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {history.map((item) => (
          <div
            key={`${item.platform}-${item.id}`}
            className="group relative bg-zinc-900/40 rounded-xl border border-white/5 overflow-hidden hover:border-rose-500/30 transition-all hover:shadow-2xl hover:shadow-rose-500/5"
          >
            <div className="aspect-[9/16] relative overflow-hidden">
              <img
                src={getPreviewUrl(item.cover)}
                className="w-full h-full object-cover opacity-65 group-hover:opacity-85 group-hover:scale-110 transition-all duration-500"
                alt="history thumbnail"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                <button
                  onClick={() => onView(item)}
                  className="w-full py-2 bg-white text-black text-[9px] font-black uppercase tracking-tight rounded-lg hover:bg-rose-500 hover:text-white transition-all"
                >
                  {t.viewNow}
                </button>
                <button
                  onClick={() => onDownload(item.media[0].url, item.media[0].filename)}
                  className="w-full py-2 bg-zinc-800 text-white text-[9px] font-black uppercase tracking-tight rounded-lg hover:bg-zinc-700 transition-all"
                >
                  {t.downloadAgain}
                </button>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 pointer-events-none group-hover:opacity-0 transition-opacity">
                <span className="text-[8px] font-bold text-white/80 truncate">
                  {item.platform} - @{item.author.unique_id} - {item.media.length} item
                </span>
              </div>
            </div>
            <div className="p-2 border-t border-white/5 bg-black/20">
              <p className="text-[9px] text-zinc-400 truncate font-medium">
                {item.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HistorySection;
