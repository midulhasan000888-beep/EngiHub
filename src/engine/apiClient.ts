const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';

export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL || '/';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
