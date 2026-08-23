import { API_BASE } from './api';
import type { Message, Milestone, Photo, SiteConfig } from './types';

export type Resource = 'milestones' | 'messages' | 'photos';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(detail?.message)
      ? detail.message.join('. ')
      : (detail?.message ?? `${res.status} ${res.statusText}`);
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const listMilestones = () => request<Milestone[]>('/milestones');
export const listMessages = () => request<Message[]>('/messages');
export const listPhotos = () => request<Photo[]>('/photos');
export const readConfig = () => request<SiteConfig>('/site-config');

export const createItem = <T>(resource: Resource, body: unknown) =>
  request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(body) });

export const updateItem = <T>(resource: Resource, id: string, body: unknown) =>
  request<T>(`/${resource}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const deleteItem = (resource: Resource, id: string) =>
  request<{ id: string; deleted: boolean }>(`/${resource}/${id}`, {
    method: 'DELETE',
  });

export const reorderItems = (resource: Resource, ids: string[]) =>
  request<unknown>(`/${resource}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

export const saveConfig = (body: Partial<SiteConfig> & { gatePin?: string }) =>
  request<SiteConfig>('/site-config', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/**
 * Uploads a file and returns the path the API gave it, root-relative. Storing
 * it that way is what lets the site change domain without every record in the
 * database pointing at the old one; assetUrl puts the origin back at render.
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const result = await request<{ url: string }>('/uploads', {
    method: 'POST',
    body: form,
  });
  return result.url;
}

/** Uploads several files at once, keeping the order they were picked in. */
export async function uploadImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImage(file)));
}
