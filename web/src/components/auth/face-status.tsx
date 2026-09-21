'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScanFace } from 'lucide-react';
import { biometricApi, type BiometricStatus } from '@/lib/api/biometric';
import { useI18n } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FaceEnrollment } from './face-enrollment';
import { candidatesApi } from '@/lib/api/candidates';

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-TN' : locale === 'fr' ? 'fr-FR' : 'en-GB');
  } catch {
    return iso;
  }
}

export function FaceStatusCard() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const statusQuery = useQuery<BiometricStatus>({
    queryKey: ['biometric', 'status'],
    queryFn: () => biometricApi.status(),
  });

  const status = statusQuery.data;

  const handleDisabled = useCallback(async () => {
    setDisabling(true);
    try {
      await biometricApi.disable();
      queryClient.setQueryData<BiometricStatus>(['biometric', 'status'], {
        enabled: true,
        enrolled: false,
        consentAt: null,
        lastUsedAt: null,
      });
      setEnrollOpen(false);
      toast.success(t.face.disabled);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.face.errorGeneric);
    } finally {
      setDisabling(false);
    }
  }, [queryClient, t]);

  const onEnrollDone = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['biometric', 'status'] });
    setEnrollOpen(false);
  }, [queryClient]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            <CardTitle>{t.face.faceAuth}</CardTitle>
          </div>
          {statusQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant={status?.enrolled ? 'default' : 'secondary'}>
              {status?.enrolled ? t.face.enabled : t.face.disabled}
            </Badge>
          )}
        </div>
        <CardDescription>{t.face.faceAuthDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusQuery.isError ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-destructive">
              {statusQuery.error instanceof ApiError ? statusQuery.error.message : t.face.errorGeneric}
            </p>
            <Button variant="ghost" size="sm" onClick={() => void statusQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        {status?.enrolled ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {t.face.enrolledOn}: {formatDate(status.consentAt, locale)}
            </p>
            <p>
              {t.face.lastUsed}: {formatDate(status.lastUsedAt, locale)}
            </p>
          </div>
        ) : null}

        {!status?.enrolled ? (
          <Button onClick={() => setEnrollOpen(true)}>{t.face.enableFaceLogin}</Button>
        ) : (
          <Button variant="destructive" onClick={handleDisabled} disabled={disabling}>
            {disabling ? t.face.processing : t.face.disableFaceLogin}
          </Button>
        )}

        <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.face.enrollTitle}</DialogTitle>
              <DialogDescription>{t.face.faceAuthDescription}</DialogDescription>
            </DialogHeader>
            <FaceEnrollment onDone={onEnrollDone} onReferenceFrame={(frame) => candidatesApi.uploadPhoto(frame)} onCancel={() => setEnrollOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
