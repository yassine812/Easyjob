import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';

export type PaymentCurrency = 'TND' | 'EUR' | 'USD';

export interface CurrencyQuote {
  baseCurrency: 'TND';
  targetCurrency: PaymentCurrency;
  baseAmountTndCents: number;
  targetAmountCents: number;
  exchangeRate: number;
}

/** Converts the commercial TND reference price without embedding an FX rate. */
@Injectable()
export class CurrencyConversionService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async quote(amountTndCents: number, targetCurrency: PaymentCurrency): Promise<CurrencyQuote> {
    if (!Number.isSafeInteger(amountTndCents) || amountTndCents < 0) {
      throw new ServiceUnavailableException('Invalid billing reference amount');
    }
    if (targetCurrency === 'TND') {
      return { baseCurrency: 'TND', targetCurrency, baseAmountTndCents: amountTndCents, targetAmountCents: amountTndCents, exchangeRate: 1 };
    }
    const url = this.config.billing?.fxRatesUrl;
    if (!url) throw new ServiceUnavailableException('Foreign-currency quotes are not configured');
    let response: Response;
    try {
      const separator = url.includes('?') ? '&' : '?';
      response = await fetch(`${url}${separator}base=TND&symbols=${targetCurrency}`, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new ServiceUnavailableException('Foreign-currency quote is temporarily unavailable');
    }
    if (!response.ok) throw new ServiceUnavailableException('Foreign-currency quote is temporarily unavailable');
    const payload = await response.json() as Record<string, unknown>;
    const rates = (payload.rates ?? (payload.data as Record<string, unknown> | undefined)?.rates ?? payload.conversion_rates) as Record<string, unknown> | undefined;
    const rawRate = rates?.[targetCurrency];
    const rate = typeof rawRate === 'number' ? rawRate : Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new ServiceUnavailableException('Foreign-currency quote is invalid');
    const targetAmountCents = Math.max(1, Math.round((amountTndCents / 100) * rate * 100));
    return { baseCurrency: 'TND', targetCurrency, baseAmountTndCents: amountTndCents, targetAmountCents, exchangeRate: rate };
  }
}

export function toProviderMinorUnits(amountCents: number, currency: PaymentCurrency): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('Invalid payment amount');
  return currency === 'TND' ? amountCents * 10 : amountCents;
}
