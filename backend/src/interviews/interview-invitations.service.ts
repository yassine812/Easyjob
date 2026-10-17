import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { interviewCalendar } from './interview-calendar';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
@Injectable()
export class InterviewInvitationsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}
  async send(id: string, action: string) {
    const item = await this.prisma.interview.findUniqueOrThrow({ where: { id }, include: { application: { include: { job: { include: { company: true } }, candidate: true } }, participants: { include: { member: true } } } });
    if (action.startsWith('reminder') && !['SCHEDULED','CONFIRMED'].includes(item.status)) return;
    const href = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/meetings/${id}`;
    const recipients = new Set([item.application.candidate.userId, item.scheduledById, ...item.participants.filter(p => p.member.status === 'ACTIVE').map(p => p.member.userId)]);
    const title = action === 'cancelled' ? 'Entretien annulé' : action === 'updated' ? 'Entretien mis à jour' : action.startsWith('reminder') ? 'Rappel d’entretien' : 'Invitation à un entretien';
    const when = new Intl.DateTimeFormat('fr', { dateStyle: 'long', timeStyle: 'short', timeZone: item.timezone }).format(item.startAt);
    const content = interviewCalendar(item, `${item.application.job.title} — ${item.application.job.company.commercialName}`, href);
    for (const userId of recipients) await this.notifications.create({ userId, type: `interview.${action}`, title, message: `${item.application.job.title} · ${when} (${item.timezone})`, data: { interviewId: id, applicationId: item.applicationId, companyId: item.application.job.companyId, href: `/meetings/${id}` }, email: { subject: `${title} — ${item.application.job.title}`, html: `<p>${esc(item.application.job.company.commercialName)}</p><p>${esc(item.application.job.title)} · ${esc(when)} (${esc(item.timezone)})</p><p>${Math.round((item.endAt.getTime()-item.startAt.getTime())/60000)} min · ${esc(item.locationType)}</p><a href="${href}">Voir l’entretien</a>`, attachments: [{ filename: 'interview.ics', content, contentType: `text/calendar; charset=utf-8; method=${action === 'cancelled' ? 'CANCEL' : 'REQUEST'}` }] }, dedupeKey: `interview.invite:${id}:${item.calendarSequence}:${action}:${userId}` });
    if (!action.startsWith('reminder')) await this.prisma.interviewParticipant.updateMany({ where: { interviewId: id }, data: { invitedAt: new Date() } });
  }
}
