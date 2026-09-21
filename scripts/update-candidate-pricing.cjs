require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const freeFeatures = {
  'cv.uploads': 3, 'ai.cv_analyze': true, 'career.builder': false,
  'career.match': false, 'career.alerts': false, 'career.auto_apply': false,
  'career.coach': false, 'career.vision': false, 'ats.basic': true,
  'ai.cv_generate': false, 'ai.match': false, 'ai.cover_letter': false,
  'ai.interview': false, applications: 10000,
};
const proFeatures = {
  'cv.uploads': 20, 'ai.cv_analyze': true, 'ai.cv_generate': true,
  'ai.match': true, 'ai.cover_letter': true, 'ai.interview': false,
  'career.builder': true, 'career.match': true, 'career.alerts': true,
  'career.auto_apply': false, 'career.coach': false, 'career.vision': false,
  'ats.basic': true, 'ai.cv_tailor': true, applications: 100000,
};
const premiumFeatures = {
  'cv.uploads': 50, 'ai.cv_analyze': true, 'ai.cv_generate': true,
  'ai.cv_tailor': true, 'ats.basic': true, 'ai.match': true,
  'ai.cover_letter': true, 'ai.interview': true, 'career.builder': true,
  'career.match': true, 'career.alerts': true, 'career.auto_apply': true,
  'career.coach': true, 'career.vision': true, applications: 100000,
};

async function main() {
  await prisma.$transaction(async tx => {
    const common = { type: 'CANDIDATE', currency: 'TND', billingInterval: 'MONTHLY', active: true };
    await tx.plan.upsert({
      where: { name_type: { name: 'FREE', type: 'CANDIDATE' } },
      create: { ...common, name: 'FREE', priceCents: 0, priceTndCents: 0, pricesJson: { TND: 0 }, sortOrder: 1, features: freeFeatures },
      update: { ...common, priceCents: 0, priceTndCents: 0, pricesJson: { TND: 0 }, sortOrder: 1, features: freeFeatures },
    });
    await tx.plan.upsert({
      where: { name_type: { name: 'PRO', type: 'CANDIDATE' } },
      create: { ...common, name: 'PRO', priceCents: 2499, priceTndCents: 2499, pricesJson: { TND: 2499 }, sortOrder: 2, features: proFeatures },
      update: { ...common, priceCents: 2499, priceTndCents: 2499, pricesJson: { TND: 2499 }, sortOrder: 2, features: proFeatures },
    });

    const existingPremium = await tx.plan.findUnique({ where: { name_type: { name: 'PREMIUM', type: 'CANDIDATE' } } });
    const legacy = await tx.plan.findUnique({ where: { name_type: { name: 'CAREER_AI', type: 'CANDIDATE' } } });
    if (!existingPremium && legacy) {
      await tx.plan.update({ where: { id: legacy.id }, data: { name: 'PREMIUM', priceCents: 4999, priceTndCents: 4999, pricesJson: { TND: 4999 }, currency: 'TND', billingInterval: 'MONTHLY', sortOrder: 3, active: true, features: premiumFeatures } });
    } else {
      await tx.plan.upsert({
        where: { name_type: { name: 'PREMIUM', type: 'CANDIDATE' } },
        create: { ...common, name: 'PREMIUM', priceCents: 4999, priceTndCents: 4999, pricesJson: { TND: 4999 }, sortOrder: 3, features: premiumFeatures },
        update: { ...common, priceCents: 4999, priceTndCents: 4999, pricesJson: { TND: 4999 }, sortOrder: 3, features: premiumFeatures },
      });
      if (legacy) await tx.plan.update({ where: { id: legacy.id }, data: { active: false, sortOrder: 99 } });
    }
  });
  const plans = await prisma.plan.findMany({ where: { type: 'CANDIDATE', active: true }, orderBy: { sortOrder: 'asc' }, select: { name: true, priceCents: true, currency: true } });
  console.log(JSON.stringify(plans));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
