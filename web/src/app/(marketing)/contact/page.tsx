import { Mail, MessageSquare } from 'lucide-react';
import { site } from '@/config/site';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about {site.name}? We usually reply within one business day.
      </p>

      <div className="mt-10 space-y-4">
        <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
          <Mail className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-medium">Email</p>
            <p className="text-sm text-muted-foreground">support@easyjob.app</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
          <MessageSquare className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-medium">Product feedback</p>
            <p className="text-sm text-muted-foreground">
              Found a bug or have a feature request? Tell us about it at feedback@easyjob.app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
