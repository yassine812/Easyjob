import { Injectable, Logger } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { EmailService } from '../queues/email/email.service';

type InvoiceTx = Prisma.TransactionClient;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService, private readonly email: EmailService) {}

  async createForPayment(tx: InvoiceTx, paymentId: string, periodStart: Date, periodEnd: Date): Promise<Invoice | null> {
    const existing = await tx.invoice.findUnique({ where: { paymentId } });
    if (existing) return existing;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { subscription: { include: { plan: true, candidate: { include: { user: true } }, company: true } } } });
    if (!payment || payment.status !== 'SUCCEEDED' || payment.subscription.plan.priceCents <= 0) return null;
    const subscription = payment.subscription;
    const year = new Date().getUTCFullYear();
    const sequence = await tx.invoiceSequence.upsert({ where: { id: 1 }, create: { id: 1, year, nextNumber: 2 }, update: { nextNumber: { increment: 1 } } });
    const number = `INV-${year}-${String(sequence.year === year ? sequence.nextNumber - 1 : 1).padStart(6, '0')}`;
    if (sequence.year !== year) await tx.invoiceSequence.update({ where: { id: 1 }, data: { year, nextNumber: 2 } });
    const customerName = subscription.candidate?.user.name ?? subscription.company?.commercialName ?? 'Client EasyJob';
    const customerEmail = subscription.candidate?.user.email ?? subscription.company?.professionalEmail ?? null;
    const customerAddress = subscription.company ? [subscription.company.address, subscription.company.city, subscription.company.country].filter(Boolean).join(', ') || null : null;
    return tx.invoice.create({ data: {
      number, paymentId, subscriptionId: subscription.id, ownerType: subscription.ownerType,
      companyId: subscription.companyId, candidateId: subscription.candidateId,
      customerName, customerEmail, customerAddress, planName: subscription.plan.name,
      planPriceCents: payment.amountCents, currency: payment.currency,
      billingInterval: subscription.plan.billingInterval, periodStart, periodEnd,
      subtotalCents: payment.amountCents, taxCents: 0, totalCents: payment.amountCents,
      providerReference: payment.providerPaymentId,
    } });
  }

  async finalize(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payment: true } });
    if (!invoice) return;
    try {
      const pdfKey = invoice.pdfKey ?? `invoices/${invoice.number}.pdf`;
      const docxKey = invoice.docxKey ?? `invoices/${invoice.number}.docx`;
      await this.storage.put(pdfKey, invoicePdf(invoice), 'application/pdf');
      await this.storage.put(docxKey, invoiceDocx(invoice), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      await this.prisma.invoice.update({ where: { id: invoice.id }, data: { pdfKey, docxKey } });
      if (invoice.customerEmail) {
        const [pdfUrl, docxUrl] = await Promise.all([this.storage.presignedGet(pdfKey), this.storage.presignedGet(docxKey)]);
        await this.email.enqueue({ dedupeKey: `invoice:${invoice.id}`, to: invoice.customerEmail, subject: `Paiement EasyJob confirmé — Facture ${invoice.number}`, text: `Votre paiement EasyJob a été confirmé. Facture ${invoice.number}.`, html: `<p>Bonjour,</p><p>Votre paiement de ${invoice.totalCents / 100} ${invoice.currency} pour EasyJob ${invoice.planName} a été confirmé.</p><p>Facture : <strong>${invoice.number}</strong></p><p><a href="${pdfUrl}">Télécharger la facture PDF</a><br><a href="${docxUrl}">Télécharger la facture Word</a></p>` });
      }
    } catch (error) {
      this.logger.error(`Invoice ${invoice.number} document generation failed`, error instanceof Error ? error.stack : String(error));
    }
  }
}

function invoicePdf(invoice: Invoice): Buffer {
  const lines = [
    'EasyJob', `FACTURE ${invoice.number}`, `Date : ${invoice.createdAt.toISOString().slice(0, 10)}`,
    `Client : ${invoice.customerName}`, `Plan : ${invoice.planName}`, `Période : ${invoice.periodStart?.toISOString().slice(0, 10) ?? '—'} -> ${invoice.periodEnd?.toISOString().slice(0, 10) ?? '—'}`,
    `Total : ${(invoice.totalCents / 100).toFixed(2)} ${invoice.currency}`, 'Statut : PAYÉ', `Référence : ${invoice.providerReference ?? '—'}`,
  ];
  const text = lines.map((line, index) => `BT /F1 12 Tf 50 ${760 - index * 24} Td (${pdfEscape(line)}) Tj ET`).join('\n');
  const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`, `<< /Length ${Buffer.byteLength(text) + 1} >>\nstream\n${text}\nendstream`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

function pdfEscape(value: string): string { return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

function invoiceDocx(invoice: Invoice): Buffer {
  const lines = ['EasyJob', `Facture ${invoice.number}`, `Client : ${invoice.customerName}`, `Plan : ${invoice.planName}`, `Total : ${(invoice.totalCents / 100).toFixed(2)} ${invoice.currency}`, 'Statut : PAYÉ'];
  const paragraphs = lines.map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`).join('');
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`,
  };
  return zip(files);
}

function xmlEscape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function zip(files: Record<string, string>): Buffer {
  const chunks: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const nameBuf = Buffer.from(name); const raw = Buffer.from(value); const data = require('zlib').deflateRawSync(raw); const crc = crc32(raw);
    const local = Buffer.alloc(30 + nameBuf.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26); nameBuf.copy(local, 30); chunks.push(local, data);
    const entry = Buffer.alloc(46 + nameBuf.length); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(raw.length, 24); entry.writeUInt16LE(nameBuf.length, 28); entry.writeUInt32LE(offset, 42); nameBuf.copy(entry, 46); central.push(entry); offset += local.length + data.length;
  }
  const directory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0);
  // Central-directory count is the number of entries, not its byte length.
  const count = Object.keys(files).length; end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}

function crc32(buffer: Buffer): number { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
