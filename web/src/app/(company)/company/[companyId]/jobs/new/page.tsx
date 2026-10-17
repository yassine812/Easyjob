'use client';
import { useParams } from 'next/navigation';
import { JobForm } from '@/components/company/job-form';
import { RequireCompanyPermission } from '@/components/shared/guards';
export default function NewJobPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="job.create"><JobForm companyId={companyId} /></RequireCompanyPermission>;
}
