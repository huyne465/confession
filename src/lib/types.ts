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
  imageUrl: string;
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
  confessCaption: string;
  confessPrimaryCta: string;
  confessDenyCta: string;
  footerText: string;
};
