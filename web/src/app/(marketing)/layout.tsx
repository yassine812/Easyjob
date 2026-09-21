import { MarketingNav } from '@/components/layout/marketing-nav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="career-canvas flex min-h-screen flex-col bg-transparent">
      <MarketingNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
