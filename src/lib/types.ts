export type Milestone = {
  id: string;
  dateLabel: string;
  title: string;
  body: string;
  imageUrl: string;
  caption: string | null;
  aspect: string;
  tilt: number;
  order: number;
};

export type Message = {
  id: string;
  title: string;
  body: string;
  signature: string | null;
  imageUrl: string;
  photoCaption: string | null;
  order: number;
};

export type Photo = {
  id: string;
  /** Thumbnail, or a video's poster frame. */
  imageUrl: string;
  /** Full-resolution source, loaded only once a tile is focused. */
  fullUrl: string | null;
  mediaType: 'image' | 'video';
  videoUrl: string | null;
  title: string | null;
  subtitle: string | null;
  span: 'wide' | 'tall' | 'square';
  order: number;
};

export type SiteConfig = {
  id: string;
  siteTitle: string;
  gateQuestion: string;
  gateHint: string;
  journeyTitle: string;
  journeyIntro: string;
  messagesTitle: string;
  messagesIntro: string;
  confessEyebrow: string;
  confessHeadline: string;
  confessImageUrl: string;
  confessVideoUrl: string;
  confessCaption: string;
  confessPrimaryCta: string;
  confessDenyCta: string;
  musicUrl: string;
  footerText: string;
};
