const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDataForCompany(companyId) {
  try {
    console.log(`Seeding jobs and applications for company: ${companyId}`);

    // Create active jobs for company
    const jobsToCreate = [
      {
        slug: `full-stack-developer-${companyId.slice(-6)}`,
        title: 'Full Stack Developer',
        location: 'Remote · Full-time',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        status: 'PUBLISHED',
        description: 'We are looking for a Full Stack Developer to build modern web applications.',
      },
      {
        slug: `frontend-engineer-${companyId.slice(-6)}`,
        title: 'Frontend Engineer',
        location: 'Tunis · Full-time',
        experienceLevel: 'MID',
        employmentType: 'FULL_TIME',
        status: 'PUBLISHED',
        description: 'Looking for a skilled React/TypeScript developer.',
      },
      {
        slug: `backend-developer-${companyId.slice(-6)}`,
        title: 'Backend Developer',
        location: 'Hybrid · Full-time',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        status: 'PUBLISHED',
        description: 'Node.js, NestJS, and PostgreSQL expert wanted.',
      },
      {
        slug: `ui-ux-designer-${companyId.slice(-6)}`,
        title: 'UI/UX Designer',
        location: 'Tunis · Full-time',
        experienceLevel: 'MID',
        employmentType: 'FULL_TIME',
        status: 'PUBLISHED',
        description: 'Design beautiful SaaS user interfaces.',
      },
    ];

    // Find any user to set createdBy for job creation
    const adminUser = await prisma.user.findFirst();

    const createdJobs = [];
    for (const jobData of jobsToCreate) {
      let job = await prisma.job.findFirst({
        where: { companyId, title: jobData.title },
      });
      if (!job) {
        job = await prisma.job.create({
          data: {
            company: { connect: { id: companyId } },
            createdBy: { connect: { id: adminUser.id } },
            ...jobData,
          },
        });
      }
      createdJobs.push(job);
    }

    // Create sample applications for each job with varied status
    const statuses = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
    let totalAppsSeeded = 0;

    for (let jIdx = 0; jIdx < createdJobs.length; jIdx++) {
      const job = createdJobs[jIdx];
      const existingApps = await prisma.application.count({ where: { jobId: job.id } });
      if (existingApps >= 4) {
        totalAppsSeeded += existingApps;
        continue;
      }

      for (let i = 0; i < 6; i++) {
        const uniqueEmail = `candidate.${companyId.slice(-6)}.${jIdx}.${i}@example.com`;
        
        let user = await prisma.user.findUnique({ where: { email: uniqueEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: uniqueEmail,
              name: `Candidate ${jIdx + 1}-${i + 1}`,
              passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
              emailVerifiedAt: new Date(),
            },
          });
        }

        let profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
        if (!profile) {
          profile = await prisma.candidateProfile.create({
            data: {
              userId: user.id,
              headline: 'Software Engineer',
              bio: 'Experienced developer specializing in modern web apps',
              location: 'Tunis, Tunisia',
            },
          });
        }

        const existingApp = await prisma.application.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: profile.id } },
        });

        if (!existingApp) {
          const status = statuses[(totalAppsSeeded + i) % statuses.length];
          const matchScore = 80 + ((i * 3) % 18);
          const atsScore = 75 + ((i * 4) % 20);

          const app = await prisma.application.create({
            data: {
              jobId: job.id,
              candidateId: profile.id,
              status,
              appliedAt: new Date(Date.now() - (i + 1) * 86_400_000 * 2),
              aiMatchScore: matchScore,
              atsScore: atsScore,
              aiQualification: matchScore >= 85 ? 'QUALIFIED' : 'REVIEW',
              aiRecommendation: matchScore >= 85 ? 'Strong Match' : 'Review Required',
              aiSummary: 'Qualified candidate matching job requirements.',
              aiScreeningStatus: 'COMPLETED',
              aiScreenedAt: new Date(),
              stageChangedAt: new Date(),
              stageChangeSource: 'AI',
            },
          });

          if (status === 'HIRED') {
            await prisma.applicationEvent.create({
              data: {
                applicationId: app.id,
                previousStatus: 'OFFER',
                newStatus: 'HIRED',
                createdAt: new Date(),
              },
            });
          }

          if (status === 'INTERVIEW') {
            await prisma.interview.create({
              data: {
                applicationId: app.id,
                jobId: job.id,
                scheduledById: user.id,
                startAt: new Date(Date.now() + 86_400_000 * 2),
                endAt: new Date(Date.now() + 86_400_000 * 2 + 3600000),
                type: 'VIDEO',
                status: 'SCHEDULED',
              },
            });
          }

          totalAppsSeeded++;
        }
      }
    }

    console.log(`Successfully seeded ${createdJobs.length} jobs and applications for company ${companyId}`);
  } catch (err) {
    console.error(`Error seeding company ${companyId}:`, err);
  }
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const c of companies) {
    await seedDataForCompany(c.id);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
