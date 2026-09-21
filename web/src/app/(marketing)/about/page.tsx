import Link from 'next/link';
import { ArrowRight, Bot, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">About {site.name}</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {site.name} is a recruitment platform built for startups: fast job posting, AI-powered CV
        analysis and matching, and a collaborative hiring pipeline — all in one place.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <Users className="size-6 text-primary" />
          <h2 className="mt-3 font-semibold">Built for both sides</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Candidates get free profiles, CV tools and applications. Companies get a full
            recruitment workspace with team roles and permissions.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <Bot className="size-6 text-primary" />
          <h2 className="mt-3 font-semibold">AI that actually helps</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            CV analysis, generation, job matching, cover letters and interview questions — driven by
            a dedicated AI service, never by hand-waving.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <Building2 className="size-6 text-primary" />
          <h2 className="mt-3 font-semibold">Verified companies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every company is verified before it can publish jobs, so candidates see real employers.
          </p>
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <Button asChild size="lg">
          <Link href="/role-select">
            Get started <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
