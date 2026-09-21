'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { useCompanyText } from '@/lib/i18n/company';
import { Input } from '@/components/ui/input';

export function CompanyLogo({ companyId, editable = false }: { companyId: string; editable?: boolean }) {
  const t = useCompanyText(); const qc = useQueryClient();
  const logo = useQuery({ queryKey: ['company-logo', companyId], queryFn: () => api.get<{ url: string }>(`/companies/${companyId}/logo`, { auth: false }), retry: false });
  const upload = useMutation({ mutationFn: (file: File) => { const form = new FormData(); form.append('file', file); return api.post(`/companies/${companyId}/logo`, undefined, { body: form }); }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['company-logo', companyId] }); toast.success(t('saved')); }, onError: () => toast.error(t('logoHelp')) });
  return <div className="flex items-center gap-4">{logo.data && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo.data.url} alt={t('companyLogo')} className="size-14 rounded-lg border bg-white object-contain p-1" />}{editable && <label className="grid gap-2 text-sm">{t('companyLogo')}<Input type="file" accept="image/png,image/jpeg,image/webp" disabled={upload.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 2 * 1024 * 1024) toast.error(t('logoHelp')); else upload.mutate(file); } }} /><small className="text-muted-foreground">{t('logoHelp')}</small></label>}</div>;
}
