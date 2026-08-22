import { ConfessionFinale } from '@/components/ConfessionFinale';
import { CurtainGate } from '@/components/CurtainGate';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { MemoryMosaic } from '@/components/MemoryMosaic';
import { MessageCarousel } from '@/components/MessageCarousel';
import { PianoScene } from '@/components/PianoScene';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';
import { getMessages, getMilestones, getPhotos, getSiteConfig } from '@/lib/api';

// Content is edited through /admin, so every visit reads the current data.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [config, milestones, photos, messages] = await Promise.all([
    getSiteConfig(),
    getMilestones(),
    getPhotos(),
    getMessages(),
  ]);

  return (
    <CurtainGate question={config.gateQuestion} hint={config.gateHint}>
      <PianoScene />
      <SiteNav title={config.siteTitle} />
      <main className="relative bg-surface">
        <JourneyTimeline
          title={config.journeyTitle}
          intro={config.journeyIntro}
          milestones={milestones}
        />
        <MemoryMosaic photos={photos} />
        <MessageCarousel
          title={config.messagesTitle}
          intro={config.messagesIntro}
          messages={messages}
        />
        <ConfessionFinale
          confessEyebrow={config.confessEyebrow}
          confessHeadline={config.confessHeadline}
          confessImageUrl={config.confessImageUrl}
          confessCaption={config.confessCaption}
          confessPrimaryCta={config.confessPrimaryCta}
          confessDenyCta={config.confessDenyCta}
        />
      </main>
      <SiteFooter text={config.footerText} />
    </CurtainGate>
  );
}
