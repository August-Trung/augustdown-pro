import React, { useEffect, useRef, useState } from "react";
import DonateModal from "./components/DonateModal";
import HistorySection from "./components/HistorySection";
import Navbar from "./components/Navbar";
import VideoCard from "./components/VideoCard";
import { ExtractedMediaData, Platform } from "./types";
import { downloadMediaFile } from "./services/downloadService";
import {
  clearFacebookSession,
  fetchExtractedMedia,
  fetchFacebookSession,
  saveFacebookSession,
} from "./services/extractService";

const platforms: { id: Platform; label: string; status?: "soon" | "experimental" }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube", status: "soon" },
  { id: "twitter", label: "X/Twitter", status: "soon" },
];

const translations = {
  en: {
    title: "AugustDown Pro",
    subtitle: "Download public media from multiple platforms through one local backend.",
    placeholder: "Paste a public media link here...",
    btnDownload: "Fetch",
    btnPasteDown: "Paste & Fetch",
    loading: "Fetching...",
    error: "Check your link and selected platform, then try again.",
    saving: "Preparing download...",
    historyTitle: "Download History",
    processing: "Processing...",
    btnNoWm: "Download Media",
    btnDownloadAll: "Download All",
    btnWm: "Open Source",
    btnAudio: "Copy Link",
    f1Title: "Multi Platform",
    f1Desc: "Instagram, TikTok, and public Facebook links are ready behind the same API.",
    f2Title: "Server Download",
    f2Desc: "Files download through /api/download so CDN tabs are not opened automatically.",
    f3Title: "Unified Output",
    f3Desc: "Every extractor returns the same media list format for video, image, and audio.",
    navDonate: "Donate",
    footerCopy: "Personal tool. Download only content you have rights to use.",
    donateHeader: "Buy me a coffee?",
    donateJoke: "Coffee keeps the extractors warm while platforms change their markup.",
    donateClose: "Maybe later",
    pasteSuccess: "Link pasted!",
    clearHistory: "Clear All",
    viewNow: "View",
    downloadAgain: "Download",
    downloadAnother: "Download Another",
    platformLabel: "Platform",
    comingSoon: "Coming soon",
    experimental: "Experimental",
    unsupported: "This platform is not ready yet.",
    fbCookieTitle: "Facebook session",
    fbCookieReady: "Cookie saved",
    fbCookieMissing: "Cookie required for Story/highlight",
    fbCookiePlaceholder: "Paste raw cookie, JSON export, or c_user/xs lines here.",
    fbCookieSave: "Save cookie",
    fbCookieClear: "Clear",
  },
  vi: {
    title: "AugustDown Pro",
    subtitle: "Tải media công khai từ nhiều nền tảng qua một backend local.",
    placeholder: "Dán link media công khai vào đây...",
    btnDownload: "Lấy link",
    btnPasteDown: "Dán & lấy link",
    loading: "Đang lấy link...",
    error: "Kiểm tra link và nền tảng đã chọn rồi thử lại.",
    saving: "Đang chuẩn bị tải...",
    historyTitle: "Lịch sử tải xuống",
    processing: "Đang xử lý...",
    btnNoWm: "Tải media",
    btnDownloadAll: "Tải tất cả",
    btnWm: "Mở link gốc",
    btnAudio: "Copy link",
    f1Title: "Nhiều nền tảng",
    f1Desc: "Instagram, TikTok và link Facebook công khai đã sẵn sàng trong cùng một API.",
    f2Title: "Tải qua server",
    f2Desc: "File luôn tải qua /api/download, không tự mở tab CDN.",
    f3Title: "Dữ liệu thống nhất",
    f3Desc: "Mọi extractor trả về cùng định dạng media cho video, ảnh và audio.",
    navDonate: "Ủng hộ",
    footerCopy: "Công cụ cá nhân. Chỉ tải nội dung bạn có quyền sử dụng.",
    donateHeader: "Mời tôi ly cà phê?",
    donateJoke: "Cà phê giúp tôi còn sức sửa extractor mỗi khi nền tảng đổi cấu trúc.",
    donateClose: "Để sau",
    pasteSuccess: "Đã dán liên kết!",
    clearHistory: "Xóa tất cả",
    viewNow: "Xem",
    downloadAgain: "Tải lại",
    downloadAnother: "Tải link khác",
    platformLabel: "Nền tảng",
    comingSoon: "Sắp có",
    experimental: "Thử nghiệm",
    unsupported: "Nền tảng này chưa sẵn sàng.",
    fbCookieTitle: "Phiên Facebook",
    fbCookieReady: "Đã lưu cookie",
    fbCookieMissing: "Story/highlight cần cookie",
    fbCookiePlaceholder: "Dán raw cookie, JSON export hoặc dòng c_user/xs tại đây.",
    fbCookieSave: "Lưu cookie",
    fbCookieClear: "Xóa",
  },
};

const historyKey = "augustdown_history_v1";

const App: React.FC = () => {
  const [lang, setLang] = useState<"en" | "vi">("vi");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<ExtractedMediaData | null>(null);
  const [history, setHistory] = useState<ExtractedMediaData[]>([]);
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [showPasteToast, setShowPasteToast] = useState(false);
  const [facebookCookie, setFacebookCookie] = useState("");
  const [facebookCookieSaved, setFacebookCookieSaved] = useState(false);
  const [savingFacebookCookie, setSavingFacebookCookie] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    const savedHistory = localStorage.getItem(historyKey);
    if (!savedHistory) return;

    try {
      setHistory(JSON.parse(savedHistory));
    } catch {
      localStorage.removeItem(historyKey);
    }
  }, []);

  useEffect(() => {
    fetchFacebookSession()
      .then((session) => setFacebookCookieSaved(session.configured))
      .catch(() => setFacebookCookieSaved(false));
  }, []);

  const resetApp = () => {
    setUrl("");
    setVideoData(null);
    setError(null);
    inputRef.current?.focus();
  };

  const forceDownload = async (downloadUrl: string, filename: string) => {
    setDownloading(true);
    try {
      await downloadMediaFile(downloadUrl, filename);
    } catch (err: any) {
      setError(err?.message || t.error);
    } finally {
      setDownloading(false);
    }
  };

  const startFetch = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;

    const selectedPlatform = platforms.find((item) => item.id === platform);
    if (selectedPlatform?.status === "soon") {
      setError(t.unsupported);
      return;
    }

    setLoading(true);
    setError(null);
    setVideoData(null);

    try {
      const response = await fetchExtractedMedia(platform, targetUrl);
      setVideoData(response.data);

      const updatedHistory = [
        response.data,
        ...history.filter(
          (item) => `${item.platform}-${item.id}` !== `${response.data.platform}-${response.data.id}`
        ),
      ].slice(0, 12);
      setHistory(updatedHistory);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));

      if (response.data.media.length === 1) {
        await forceDownload(response.data.media[0].url, response.data.media[0].filename);
      }
    } catch (err: any) {
      setError(err?.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = (event: React.FormEvent) => {
    event.preventDefault();
    startFetch(url);
  };

  const handlePasteAndDownload = async () => {
    const fallbackUrl = url.trim();
    setUrl("");
    setVideoData(null);
    setError(null);

    try {
      const text = await navigator.clipboard.readText();
      const pastedUrl = text.trim();
      if (!pastedUrl) {
        if (fallbackUrl) {
          setUrl(fallbackUrl);
          startFetch(fallbackUrl);
        }
        return;
      }

      setUrl(pastedUrl);
      setShowPasteToast(true);
      setTimeout(() => setShowPasteToast(false), 2000);
      startFetch(pastedUrl);
    } catch {
      if (fallbackUrl) {
        setUrl(fallbackUrl);
        startFetch(fallbackUrl);
        return;
      }
      inputRef.current?.focus();
    }
  };

  const useHistoryItem = (item: ExtractedMediaData) => {
    setPlatform(item.platform);
    setVideoData(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearHistory = () => {
    const message =
      lang === "vi"
        ? "Bạn có chắc muốn xóa hết lịch sử?"
        : "Are you sure you want to clear history?";
    if (!window.confirm(message)) return;
    setHistory([]);
    localStorage.removeItem(historyKey);
  };

  const handleSaveFacebookCookie = async () => {
    setSavingFacebookCookie(true);
    setError(null);
    try {
      await saveFacebookSession(facebookCookie);
      setFacebookCookie("");
      setFacebookCookieSaved(true);
    } catch (err: any) {
      setError(err?.message || t.error);
    } finally {
      setSavingFacebookCookie(false);
    }
  };

  const handleClearFacebookCookie = async () => {
    setSavingFacebookCookie(true);
    setError(null);
    try {
      await clearFacebookSession();
      setFacebookCookie("");
      setFacebookCookieSaved(false);
    } catch (err: any) {
      setError(err?.message || t.error);
    } finally {
      setSavingFacebookCookie(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white selection:bg-rose-500/30 pb-20">
      <Navbar
        lang={lang}
        setLang={setLang}
        onDonateClick={() => setIsDonateOpen(true)}
        onHomeClick={resetApp}
        t={t}
      />

      <main className="relative z-10 pt-16 px-4 max-w-4xl mx-auto">
        <section className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-black mb-1.5 tracking-tight">
            {t.title}
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm font-medium">
            {t.subtitle}
          </p>
        </section>

        <section className="mb-8 relative">
          <div className="max-w-2xl mx-auto mb-3">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              {t.platformLabel}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {platforms.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlatform(item.id)}
                  className={`min-h-10 px-2 py-2 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-all ${
                    platform === item.id
                      ? "bg-white text-black border-white"
                      : "bg-zinc-950 text-zinc-400 border-white/10 hover:text-white"
                  }`}
                >
                  <span className="block">{item.label}</span>
                  {item.status && (
                    <span className="block mt-0.5 text-[8px] opacity-60">
                      {item.status === "soon" ? t.comingSoon : t.experimental}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {platform === "facebook" && (
            <div className="max-w-2xl mx-auto mb-3 p-3 rounded-xl bg-zinc-950/80 border border-white/10">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {t.fbCookieTitle}
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-bold ${
                      facebookCookieSaved ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    {facebookCookieSaved ? t.fbCookieReady : t.fbCookieMissing}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFacebookCookie}
                  disabled={savingFacebookCookie || !facebookCookieSaved}
                  className="px-3 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-white/10 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                  {t.fbCookieClear}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  value={facebookCookie}
                  onChange={(event) => setFacebookCookie(event.target.value)}
                  placeholder={t.fbCookiePlaceholder}
                  className="min-h-[72px] sm:min-h-10 flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 resize-y"
                />
                <button
                  type="button"
                  onClick={handleSaveFacebookCookie}
                  disabled={savingFacebookCookie || !facebookCookie.trim()}
                  className="px-5 py-2 rounded-lg bg-white text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {savingFacebookCookie ? t.processing : t.fbCookieSave}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleFetch} className="relative group max-w-2xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 via-amber-400 to-sky-500 rounded-xl blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
            <div className="relative flex gap-2 p-1 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={t.placeholder}
                  className="w-full bg-transparent px-4 py-2 text-sm text-white focus:outline-none placeholder:text-zinc-600 pr-10"
                  disabled={loading}
                />
                {url && !loading && (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    className="absolute right-2 text-zinc-500 hover:text-white p-1 transition-colors"
                    aria-label="Clear input"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handlePasteAndDownload}
                disabled={loading}
                className="px-6 py-2 min-w-[140px] bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? t.loading : t.btnPasteDown}
              </button>
            </div>
          </form>

          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-4 transition-all duration-300 ${
              showPasteToast
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
              {t.pasteSuccess}
            </div>
          </div>

          <div className="h-10 flex items-center justify-center mt-2">
            {downloading && (
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20">
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
                  {t.saving}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-1 p-2 bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-bold rounded-lg text-center uppercase tracking-wider">
              {error}
            </div>
          )}
        </section>

        {videoData && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <VideoCard data={videoData} t={t} />
            <div className="mt-6 flex justify-center">
              <button
                onClick={resetApp}
                className="flex items-center gap-2 px-6 py-2 bg-zinc-900/70 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all active:scale-95"
              >
                {t.downloadAnother}
              </button>
            </div>
          </div>
        )}

        <HistorySection
          history={history}
          onView={useHistoryItem}
          onDownload={forceDownload}
          onClear={clearHistory}
          t={t}
        />

        {!videoData && !loading && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 my-12">
            {[
              { title: t.f1Title, desc: t.f1Desc, color: "text-rose-400" },
              { title: t.f2Title, desc: t.f2Desc, color: "text-amber-300" },
              { title: t.f3Title, desc: t.f3Desc, color: "text-sky-300" },
            ].map((feature) => (
              <div key={feature.title} className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                <h4 className={`text-[11px] font-black uppercase mb-1 tracking-wider ${feature.color}`}>
                  {feature.title}
                </h4>
                <p className="text-zinc-500 text-[10px] leading-tight font-medium">
                  {feature.desc}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="mt-12 py-8 border-t border-white/5 bg-black/20 text-center">
        <p className="text-zinc-600 text-[9px] uppercase font-black tracking-[0.3em]">
          AugustDown Pro - {t.footerCopy}
        </p>
      </footer>

      <DonateModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
        t={t}
      />
    </div>
  );
};

export default App;
