'use client';

import { useParams } from 'next/navigation';
import { JobForm } from '@/components/company/job-form';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { PageHeader } from '@/components/shared';

export default function NewJobPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  return (
    <RequireCompanyPermission companyId={companyId} permission="job.create">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="New job"
          description="Jobs start as drafts and go through approval before publishing."
        />
        <div className="mt-8">
          <JobForm companyId={companyId} />
        </div>
      </div>
    </RequireCompanyPermission>
  );
}
