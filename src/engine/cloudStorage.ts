import { auth } from '../firebase';
import { apiUrl } from './apiClient';

export interface StorageProviderStatus {
  provider: 'cloudflare-r2' | 'local-storage';
  r2Configured: boolean;
  bucketName?: string;
}

export interface UploadedFileResult {
  storagePath: string;
  downloadUrl: string;
  provider: 'cloudflare-r2' | 'local-storage';
  fileSizeBytes: number;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required for cloud storage operations.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode file for storage upload.'));
    reader.readAsDataURL(blob);
  });
}

export async function getStorageProviderStatus(): Promise<StorageProviderStatus> {
  try {
    const res = await fetch(apiUrl('/api/storage/status'));
    if (!res.ok) return { provider: 'local-storage', r2Configured: false };
    return (await res.json()) as StorageProviderStatus;
  } catch {
    return { provider: 'local-storage', r2Configured: false };
  }
}

export async function uploadUserFileToStorage(
  blob: Blob,
  storagePath: string,
  contentType = 'application/octet-stream'
): Promise<UploadedFileResult> {
  const headers = await getAuthHeader();
  const base64Data = await blobToBase64(blob);
  const res = await fetch(apiUrl('/api/storage/upload'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      storagePath,
      contentType: contentType || blob.type || 'application/octet-stream',
      base64Data,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as UploadedFileResult & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Storage upload failed (HTTP ${res.status})`);
  }
  return {
    ...json,
    downloadUrl: json.downloadUrl ? apiUrl(json.downloadUrl) : '',
  };
}

export async function deleteUserFileFromStorage(storagePath: string): Promise<void> {
  if (!storagePath || !auth.currentUser) return;
  const headers = await getAuthHeader();
  const res = await fetch(apiUrl(`/api/storage/file?key=${encodeURIComponent(storagePath)}`), {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Storage delete failed (HTTP ${res.status})`);
  }
}

export async function refreshSignedStorageUrl(storagePath: string): Promise<string> {
  const headers = await getAuthHeader();
  const res = await fetch(apiUrl(`/api/storage/sign?key=${encodeURIComponent(storagePath)}`), {
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as { downloadUrl?: string; error?: string };
  if (!res.ok || !json.downloadUrl) {
    throw new Error(json.error || 'Failed to get storage download link.');
  }
  return apiUrl(json.downloadUrl);
}
