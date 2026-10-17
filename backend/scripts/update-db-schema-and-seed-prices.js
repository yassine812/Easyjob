const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating database DDL via Prisma raw query...');
  
  await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceTndCents" INTEGER;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "pricesJson" JSONB;`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_provider_providerPaymentId_idx" ON "Payment"("provider", "providerPaymentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");`);

  console.log('Database DDL updated successfully.');

  // Update Plan regional pricing
  const plans = await prisma.plan.findMany();
  for (const p of plans) {
    let priceTndCents = 0;
    if (p.name === 'BUSINESS') priceTndCents = 8900; // 89 TND
    if (p.name === 'PRO') priceTndCents = 18900; // 189 TND
    if (p.name === 'ENTERPRISE') priceTndCents = 49000; // 490 TND

    const pricesJson = {
      TND: priceTndCents,
      EUR: p.priceCents,
      USD: p.priceCents,
    };

    await prisma.plan.update({
      where: { id: p.id },
      data: {
        priceTndCents: priceTndCents || p.priceCents,
        pricesJson,
      },
    });
  }

  console.log('Updated Plan regional prices in DB.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
