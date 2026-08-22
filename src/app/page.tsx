import { ConfessionFinale } from '@/components/ConfessionFinale';
import { CurtainGate } from '@/components/CurtainGate';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { MemoryMosaic } from '@/components/MemoryMosaic';
import { MemorySphere } from '@/components/MemorySphere';
import { PianoScene } from '@/components/PianoScene';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';
import { getMilestones, getPhotos, getSiteConfig } from '@/lib/api';

// Content is edited through /admin, so every visit reads the current data.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [config, milestones, photos] = await Promise.all([
    getSiteConfig(),
    getMilestones(),
    getPhotos(),
  ]);

  return (
    <CurtainGate question={config.gateQuestion} hint={config.gateHint}>
      <PianoScene musicUrl={config.musicUrl} />
      <SiteNav title={config.siteTitle} />
      <main className="relative bg-surface">
        <JourneyTimeline
          title={config.journeyTitle}
          intro={config.journeyIntro}
          milestones={milestones}
        />
        <MemoryMosaic photos={photos} />
        <MemorySphere
          title={config.messagesTitle}
          intro={config.messagesIntro}
          items={photos}
        />
        <ConfessionFinale
          confessEyebrow={config.confessEyebrow}
          confessHeadline={config.confessHeadline}
          confessImageUrl={config.confessImageUrl}
          confessVideoUrl={config.confessVideoUrl}
          confessCaption={config.confessCaption}
          confessPrimaryCta={config.confessPrimaryCta}
          confessDenyCta={config.confessDenyCta}
        />
      </main>
      <SiteFooter text={config.footerText} />
    </CurtainGate>
  );
}
