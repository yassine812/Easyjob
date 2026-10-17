/** Legacy template sentences duplicate JobSkill. Keep all unrelated qualifications. */
export function removeSkillRequirements(requirements: string[], skills: Array<{ name: string }>) {
  const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const names = new Set(skills.map(skill => normalize(skill.name)));
  return requirements.filter(value => !names.has(normalize(value).replace(/^(maitrise de |proficiency in |knowledge of )/, '').replace(/[.!]$/, '')));
}

/** Public projections must never expose a recruiter's hidden compensation. */
export function publicJobSalary<T extends { salaryVisible?: boolean; salaryMin: number | null; salaryMax: number | null }>(job: T): T {
  return job.salaryVisible === false ? { ...job, salaryMin: null, salaryMax: null } : job;
}
