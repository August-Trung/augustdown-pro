import React, { useEffect, useState } from "react";
import { apiUrl } from "../services/apiClient";
import { getFacebookCookie } from "../services/extractService";
import { getPreviewUrl } from "../services/downloadService";

interface PreviewImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  source?: string;
  fallback?: string;
}

const needsFacebookCookie = (url?: string) =>
  Boolean(url && /facebook|fbcdn|fbsbx/i.test(url));

const PreviewImage: React.FC<PreviewImageProps> = ({
  source,
  fallback = "/ver-bigger-logo.png",
  ...props
}) => {
  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    let active = true;
    let createdUrl = "";

    setBlobUrl("");
    if (!source || !needsFacebookCookie(source)) return;

    const cookie = getFacebookCookie();
    if (!cookie) return;

    fetch(apiUrl(`/api/preview?url=${encodeURIComponent(source)}`), {
      headers: {
        "x-augustdown-facebook-cookie": cookie,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Preview failed");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (active) setBlobUrl("");
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [source]);

  return (
    <img
      {...props}
      src={blobUrl || getPreviewUrl(source || fallback)}
      onError={(event) => {
        if (!event.currentTarget.dataset.fallbackApplied) {
          event.currentTarget.dataset.fallbackApplied = "1";
          event.currentTarget.src = fallback;
        }
        props.onError?.(event);
      }}
    />
  );
};

export default PreviewImage;
