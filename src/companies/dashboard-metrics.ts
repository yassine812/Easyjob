type ApplicationHistory = {
  appliedAt: Date;
  events: { newStatus: string; createdAt: Date }[];
};

const day = 86_400_000;
const mean = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;

/** Cohort metrics use only recorded transitions, never current stage counts as a funnel. */
export function dashboardMetrics(all: ApplicationHistory[], from: Date, to: Date) {
  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  const cohort = all.filter(app => app.appliedAt >= from && app.appliedAt <= to);
  const previous = all.filter(app => app.appliedAt >= previousFrom && app.appliedAt < from);
  const stages = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
  const counts = stages.map(() => 0);
  const durations: number[][] = [[], [], []];
  for (const app of cohort) {
    const events = app.events.filter(e => e.createdAt >= app.appliedAt && e.createdAt <= to).slice().sort((a, b) => +a.createdAt - +b.createdAt);
    const first = (stage: string) => events.find(e => e.newStatus === stage)?.createdAt;
    const interview = first('INTERVIEW'), offer = first('OFFER'), hired = first('HIRED');
    if (interview) durations[0].push((+interview - +app.appliedAt) / day);
    if (interview && offer && offer >= interview) durations[1].push((+offer - +interview) / day);
    if (offer && hired && hired >= offer) durations[2].push((+hired - +offer) / day);
    // A strict sequential funnel excludes skipped stages and counts each application once.
    counts[0]++;
    let cursor = app.appliedAt;
    for (let index = 1; index < stages.length; index++) {
      const reached = events.find(e => e.newStatus === stages[index] && e.createdAt >= cursor);
      if (!reached) break;
      counts[index]++;
      cursor = reached.createdAt;
    }
  }
  const dailyCounts = new Map<string, number>();
  for (const app of cohort) {
    const date = app.appliedAt.toISOString().slice(0, 10);
    dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
  }
  const daily: { date: string; count: number }[] = [];
  for (let time = Date.parse(from.toISOString().slice(0, 10)); time <= +to; time += day) {
    const date = new Date(time).toISOString().slice(0, 10);
    daily.push({ date, count: dailyCounts.get(date) ?? 0 });
  }
  return {
    comparison: { previousApplications: previous.length, applicationsPercent: previous.length ? Math.round((cohort.length - previous.length) / previous.length * 1000) / 10 : null },
    velocity: durations.map((values, i) => ({ key: ['applicationToInterview', 'interviewToOffer', 'offerToHire'][i], averageDays: mean(values), sampleSize: values.length })),
    funnel: counts[1] ? stages.map((stage, i) => ({ stage, count: counts[i], conversion: i && counts[i - 1] ? Math.round(counts[i] / counts[i - 1] * 100) : null })) : [],
    daily,
  };
}
