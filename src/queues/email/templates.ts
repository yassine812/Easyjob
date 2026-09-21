export interface RenderedEmail {
  subject: string;
  html: string;
}

const shell = (title: string, body: string, cta?: { label: string; url: string }): string => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">Startup Starter</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h1>
          <div style="color:#334155;font-size:14px;line-height:1.6;">${body}</div>
          ${cta ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${cta.label}</a></div>` : ''}
          <p style="margin-top:32px;color:#94a3b8;font-size:12px;">If the button doesn't work, copy and paste this link into your browser: ${cta ? cta.url : ''}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

export const emailTemplates = {
  verifyEmail: (url: string): RenderedEmail => ({
    subject: 'Verify your email — Startup Starter',
    html: shell(
      'Verify your email address',
      'Welcome to Startup Starter! Please verify your email address to activate your account and start using the platform.',
      { label: 'Verify email', url },
    ),
  }),
  passwordReset: (url: string): RenderedEmail => ({
    subject: 'Reset your password — Startup Starter',
    html: shell(
      'Reset your password',
      'We received a request to reset your password. This link is valid for 60 minutes. If you did not request this, you can safely ignore this email.',
      { label: 'Reset password', url },
    ),
  }),
  companyInvitation: (url: string, companyName: string, role: string): RenderedEmail => ({
    subject: `You've been invited to ${companyName} — Startup Starter`,
    html: shell(
      `Invitation to join ${companyName}`,
      `You have been invited to join <strong>${companyName}</strong> as <strong>${role}</strong> on Startup Starter. Accept the invitation to activate your team membership.`,
      { label: 'Accept invitation', url },
    ),
  }),
  companyVerified: (companyName: string): RenderedEmail => ({
    subject: `${companyName} is now verified — Startup Starter`,
    html: shell(
      'Company verified 🎉',
      `Congratulations! <strong>${companyName}</strong> has been verified. You now have access to the full platform.`,
    ),
  }),
  companyRejected: (companyName: string, reason: string): RenderedEmail => ({
    subject: `Verification update for ${companyName} — Startup Starter`,
    html: shell(
      'Company verification update',
      `Unfortunately, <strong>${companyName}</strong> was not verified. Reason: ${reason}. You can resubmit your verification with updated documents.`,
    ),
  }),
  jobApproved: (jobTitle: string): RenderedEmail => ({
    subject: `Your job "${jobTitle}" was approved — Startup Starter`,
    html: shell('Job approved', `Your job <strong>${jobTitle}</strong> has been approved and published.`),
  }),
  jobRejected: (jobTitle: string, reason: string): RenderedEmail => ({
    subject: `Your job "${jobTitle}" was rejected — Startup Starter`,
    html: shell(
      'Job rejected',
      `Your job <strong>${jobTitle}</strong> was rejected. Reason: ${reason}.`,
    ),
  }),
  applicationReceived: (jobTitle: string): RenderedEmail => ({
    subject: `New application for ${jobTitle} — Startup Starter`,
    html: shell('New application', `A candidate applied to your job <strong>${jobTitle}</strong>.`),
  }),
  applicationStatusChanged: (jobTitle: string, status: string): RenderedEmail => ({
    subject: `Application update for ${jobTitle} — Startup Starter`,
    html: shell(
      'Application status updated',
      `The status of your application for <strong>${jobTitle}</strong> changed to <strong>${status}</strong>.`,
    ),
  }),
  interviewScheduled: (jobTitle: string, when: string): RenderedEmail => ({
    subject: `Interview scheduled for ${jobTitle} — Startup Starter`,
    html: shell(
      'Interview scheduled',
      `An interview for <strong>${jobTitle}</strong> has been scheduled on <strong>${when}</strong>.`,
    ),
  }),
};
