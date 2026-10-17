'use client';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { OfferSummary, type EmploymentOffer } from '@/components/company/employment-offers';
import { useHiringText } from '@/lib/i18n/hiring';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
export function CandidateEmploymentOffer({ id }: { id: string }) {
  const t=useHiringText(), qc=useQueryClient(); const [response,setResponse]=useState<'ACCEPTED'|'DECLINED'|null>(null),[reason,setReason]=useState('');
  const query=useQuery({queryKey:['recruitment-offer',id],queryFn:()=>api.get<EmploymentOffer>(`/recruitment-offers/${id}`)});
  useEffect(()=>{if(query.data?.status==='SENT') void api.post(`/recruitment-offers/${id}/viewed`,{}).then(()=>qc.invalidateQueries({queryKey:['recruitment-offer',id]})).catch(()=>{});},[query.data?.status,id,qc]);
  const mutate=useMutation({mutationFn:()=>api.post(`/recruitment-offers/${id}/respond`,{response,reason:reason||undefined}),onSuccess:()=>{setResponse(null); void qc.invalidateQueries({queryKey:['recruitment-offer',id]});void qc.invalidateQueries({queryKey:['candidate-applications']});}});
  if(query.isPending)return <EasyJobLoading label={t('loading')} />;if(query.isError)return <p role="alert">{t('saveError')}</p>;
  return <div className="space-y-5"><Badge variant="secondary">{t(query.data.status)}</Badge><OfferSummary offer={query.data}/>{['SENT','VIEWED'].includes(query.data.status)&&(!query.data.expiresAt||new Date(query.data.expiresAt)>new Date())&&<div className="flex flex-wrap gap-3"><Button onClick={()=>setResponse('ACCEPTED')}>{t('acceptOffer')}</Button><Button variant="outline" onClick={()=>setResponse('DECLINED')}>{t('declineOffer')}</Button></div>}<AlertDialog open={!!response} onOpenChange={v=>!v&&!mutate.isPending&&setResponse(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(response==='ACCEPTED'?'confirmAccept':'declineOffer')}</AlertDialogTitle><AlertDialogDescription>{t(response==='ACCEPTED'?'acceptHelp':'reason')}</AlertDialogDescription></AlertDialogHeader>{response==='DECLINED'&&<Textarea aria-label={t('reason')} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/>} {mutate.isError&&<p role="alert" className="text-destructive">{t('saveError')}</p>}<AlertDialogFooter><AlertDialogCancel disabled={mutate.isPending}>{t('cancel')}</AlertDialogCancel><Button disabled={mutate.isPending} onClick={()=>mutate.mutate()}>{t('confirm')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
export function CandidateOfferList({ applicationId }: { applicationId: string }) {
  const t=useHiringText();const result=useQuery({queryKey:['candidate-offers',applicationId],queryFn:()=>api.get<EmploymentOffer[]>(`/applications/${applicationId}/employment-offers`)});
  if(!result.data?.length)return null;
  return <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="font-semibold">{t('employmentOffer')}</h2>{result.data.map(o=><article key={o.id} className="space-y-4"><OfferSummary offer={o}/><Button asChild><Link href={`/recruitment-offers/${o.id}`}>{t('details')} · {t(o.status)}</Link></Button></article>)}</section>;
}
