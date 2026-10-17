export interface RenderedEmail {
  subject: string;
  html: string;
  text?: string;
}

const shell = (title: string, body: string, cta?: { label: string; url: string }): string => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">EasyJob</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h1>
          <div style="color:#334155;font-size:14px;line-height:1.6;">${body}</div>
          ${cta ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${cta.label}</a></div>` : ''}
          ${cta ? `<p style="margin-top:32px;color:#94a3b8;font-size:12px;">If the button doesn't work, copy and paste this link into your browser: ${cta.url}</p>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

export const emailTemplates = {
  verifyEmail: (code: string): RenderedEmail => ({
    subject: 'Votre code de vérification — EasyJob',
    html: shell(
      'Confirmez votre adresse e-mail',
      `<p>Saisissez ce code dans EasyJob pour confirmer votre adresse e-mail et vous connecter.</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;">${code}</p><p>Ce code est valable 10 minutes et ne peut être utilisé qu’une fois. Ne le partagez avec personne.</p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>`,
    ),
    text: `Votre code EasyJob : ${code}. Saisissez-le dans EasyJob pour confirmer votre adresse e-mail et vous connecter. Valable 10 minutes, à usage unique. Ne le partagez avec personne.`,
  }),
  passwordReset: (url: string): RenderedEmail => ({
    subject: 'Reset your password — EasyJob',
    html: shell(
      'Reset your password',
      'We received a request to reset your EasyJob password. This link is valid for 60 minutes. If you did not request this, you can safely ignore this email.',
      { label: 'Reset password', url },
    ),
    text: `We received a request to reset your EasyJob password. This link is valid for 60 minutes. Open this link to continue: ${url}`,
  }),
  companyOwnerInvitation: (url: string, companyName: string, ownerName: string): RenderedEmail => ({
    subject: `Votre compte entreprise ${companyName} a été créé — EasyJob`,
    html: shell('Votre espace entreprise EasyJob est prêt', `Bonjour ${escapeHtml(ownerName)},<p>Votre compte administrateur pour <strong>${escapeHtml(companyName)}</strong> a été créé. Choisissez votre mot de passe pour activer votre accès. Ce lien expire dans 24 heures.</p>`, { label: 'Activer mon compte', url }),
    text: `Bonjour ${ownerName}. Votre compte administrateur pour ${companyName} a été créé. Activez votre compte et choisissez votre mot de passe : ${url}. Le lien expire dans 24 heures.`,
  }),
  companyInvitation: (url: string, companyName: string, role: string): RenderedEmail => ({
    subject: `You've been invited to ${companyName} — EasyJob`,
    html: shell(
      `Invitation to join ${companyName}`,
      `You have been invited to join <strong>${companyName}</strong> as <strong>${role}</strong> on EasyJob. Accept the invitation to activate your team membership.`,
      { label: 'Accept invitation', url },
    ),
  }),
  companyVerified: (companyName: string): RenderedEmail => ({
    subject: `${companyName} is now verified — EasyJob`,
    html: shell(
      'Company verified 🎉',
      `Congratulations! <strong>${companyName}</strong> has been verified. You now have access to the full platform.`,
    ),
  }),
  companyRejected: (companyName: string, reason: string): RenderedEmail => ({
    subject: `Verification update for ${companyName} — EasyJob`,
    html: shell(
      'Company verification update',
      `Unfortunately, <strong>${companyName}</strong> was not verified. Reason: ${reason}. You can resubmit your verification with updated documents.`,
    ),
  }),
  jobApproved: (jobTitle: string): RenderedEmail => ({
    subject: `Your job "${jobTitle}" was approved — EasyJob`,
    html: shell('Job approved', `Your job <strong>${jobTitle}</strong> has been approved and published.`),
  }),
  jobRejected: (jobTitle: string, reason: string): RenderedEmail => ({
    subject: `Your job "${jobTitle}" was rejected — EasyJob`,
    html: shell(
      'Job rejected',
      `Your job <strong>${jobTitle}</strong> was rejected. Reason: ${reason}.`,
    ),
  }),
  applicationReceived: (jobTitle: string): RenderedEmail => ({
    subject: `New application for ${jobTitle} — EasyJob`,
    html: shell('New application', `A candidate applied to your job <strong>${jobTitle}</strong>.`),
  }),
  applicationStatusChanged: (jobTitle: string, status: string): RenderedEmail => ({
    subject: `Application update for ${jobTitle} — EasyJob`,
    html: shell(
      'Application status updated',
      `The status of your application for <strong>${jobTitle}</strong> changed to <strong>${status}</strong>.`,
    ),
  }),
  interviewScheduled: (jobTitle: string, when: string): RenderedEmail => ({
    subject: `Interview scheduled for ${jobTitle} — EasyJob`,
    html: shell(
      'Interview scheduled',
      `An interview for <strong>${jobTitle}</strong> has been scheduled on <strong>${when}</strong>.`,
    ),
  }),
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}
