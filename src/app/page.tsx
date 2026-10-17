import { MarketingNav } from '@/components/layout/marketing-nav';
import { CareerLanding } from '@/components/landing/career-landing';

export default function HomePage() {
  return (
    <div className="career-canvas flex min-h-screen flex-col bg-transparent">
      <MarketingNav />
      <main className="flex-1">
        <CareerLanding />
      </main>
    </div>
  );
}
