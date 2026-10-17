import { CurrencyConversionService, toProviderMinorUnits } from '../../src/payments/currency-conversion.service';

describe('CurrencyConversionService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps TND reference prices exact and converts provider units centrally', async () => {
    const service = new CurrencyConversionService({ billing: { fxRatesUrl: undefined } } as never);
    await expect(service.quote(4900, 'TND')).resolves.toMatchObject({ targetAmountCents: 4900, exchangeRate: 1 });
    expect(toProviderMinorUnits(4900, 'TND')).toBe(49000);
    expect(toProviderMinorUnits(4510, 'EUR')).toBe(4510);
  });

  it('uses the configured FX source instead of a hardcoded exchange rate', async () => {
    const service = new CurrencyConversionService({ billing: { fxRatesUrl: 'https://fx.example/latest' } } as never);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.92 } }) } as Response);
    await expect(service.quote(4900, 'EUR')).resolves.toMatchObject({ targetAmountCents: 4508, exchangeRate: 0.92, targetCurrency: 'EUR' });
    expect(fetch).toHaveBeenCalledWith('https://fx.example/latest?base=TND&symbols=EUR', expect.anything());
  });
});
