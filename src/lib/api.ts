import type { Message, Milestone, Photo, SiteConfig } from './types';

/** URL the browser uses. Baked into the client bundle at build time. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * URL the Next server uses. Inside Docker the API answers on its service name,
 * which the browser cannot resolve, so the two differ.
 */
const SERVER_API_BASE = process.env.API_INTERNAL_URL ?? API_BASE;

/**
 * Server-side fetch. Never cached: the page must not be able to bake in an
 * empty snapshot taken while the API happened to be down at build time.
 */
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${SERVER_API_BASE}${path}`, {
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // The page must still render if the API is down. Sections with no data
    // fall back to their empty state rather than crashing the route.
    return fallback;
  }
}

/**
 * Uploaded media is stored as a root-relative path so the database survives a
 * change of domain. next/image cannot fetch one of those: a relative src is
 * resolved against the Next server itself, and /assets belongs to nginx. So the
 * public origin gets put back on here, at the edge of the app rather than in
 * the data.
 */
export function assetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return `${API_BASE.replace(/\/api$/, '')}${url}`;
}

export const DEFAULT_CONFIG: SiteConfig = {
  id: 'singleton',
  siteTitle: 'Kỷ Niệm Của Chúng Mình',
  gateQuestion: 'Ngày sinh của em là gì?',
  gateHint: 'Một ngày đặc biệt bắt đầu mọi thứ...',
  journeyTitle: 'Hành trình Ký ức',
  journeyIntro:
    'Từng thước phim, từng trang giấy, đều ghi lại những khoảnh khắc trân quý nhất của chúng ta.',
  messagesTitle: 'Những Lời Nhắn Gửi',
  messagesIntro:
    'Mỗi khoảnh khắc là một câu chuyện, mỗi ánh nhìn là một lời yêu chưa ngỏ.',
  confessEyebrow: 'Hành trình của chúng mình chỉ mới bắt đầu...',
  confessHeadline: 'Làm người yêu anh nhé?',
  confessImageUrl: '',
  confessVideoUrl: '',
  confessCaption: 'Forever Yours',
  confessPrimaryCta: 'Đồng ý',
  confessDenyCta: 'Để anh nghĩ thêm',
  musicUrl: '',
  footerText: 'Mãi mãi bên nhau',
};

export const getSiteConfig = () => get<SiteConfig>('/site-config', DEFAULT_CONFIG);
export const getMilestones = () => get<Milestone[]>('/milestones', []);
export const getMessages = () => get<Message[]>('/messages', []);
export const getPhotos = () => get<Photo[]>('/photos', []);

export async function verifyPin(pin: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/site-config/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { ok: boolean };
  return data.ok;
}

export async function sendAnswer(accepted: boolean, note?: string) {
  await fetch(`${API_BASE}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted, note }),
  });
}
