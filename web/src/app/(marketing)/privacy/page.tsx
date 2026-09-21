export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <div className="prose prose-sm mt-8 max-w-none text-muted-foreground">
        <p>
          This is a development product. Your data is stored in our database, and your CVs and
          documents are stored privately in object storage. We never sell your personal data.
        </p>
        <p>
          Candidates control their profile visibility (public, recruiters-only, or private).
          Companies only see candidate contact details after an application is submitted.
        </p>
        <p>For any privacy questions, contact privacy@easyjob.app.</p>
      </div>
    </div>
  );
}
