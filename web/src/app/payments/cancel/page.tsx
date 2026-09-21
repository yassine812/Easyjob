'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { RequireAuth } from '@/components/shared/guards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentCancelPage() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <XCircle className="size-12 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Checkout canceled</h1>
            <p className="text-sm text-muted-foreground">
              No charges were made. You can retry the checkout whenever you&apos;re ready.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  );
}
