const apiBaseStorageKey = "augustdown_api_base_url";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getApiBaseUrl = (): string => {
  const stored = localStorage.getItem(apiBaseStorageKey) || "";
  const configured =
    stored ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    "";

  return trimTrailingSlash(configured.trim());
};

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};

export const readJsonResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API dang tra HTML thay vi JSON. Kiem tra backend/proxy /api tren domain deploy."
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("API tra ve JSON khong hop le.");
  }
};
