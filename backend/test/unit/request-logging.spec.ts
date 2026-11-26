import { BadRequestException, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

describe('Sensitive request query logging', () => {
  afterEach(() => jest.restoreAllMocks());
  const request = () => ({ method: 'GET', headers: {}, originalUrl: '/api/v1/auth/activation-preview?token=private-activation-token&email=private-address' });
  it.each([false, true])('omits credentials from HTTP logs, failure=%s', async failed => {
    const log = jest.spyOn(Logger.prototype, failed ? 'warn' : 'log').mockImplementation(() => undefined);
    const context = { switchToHttp: () => ({ getRequest: request, getResponse: () => ({ statusCode: 200 }) }) };
    const handler = { handle: () => failed ? throwError(() => new BadRequestException('Expired activation')) : of({ ok: true }) };
    const result = firstValueFrom(new LoggingInterceptor().intercept(context as never, handler));
    if (failed) await expect(result).rejects.toThrow('Expired activation');
    else await expect(result).resolves.toEqual({ ok: true });
    const entry = JSON.parse(log.mock.calls[0][0]);
    expect(entry.url).toBe('/api/v1/auth/activation-preview');
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-activation-token|private-address/);
  });
  it('omits credentials from exception logs and error response paths', () => {
    const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const response = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = { switchToHttp: () => ({ getRequest: request, getResponse: () => response }) };
    new AllExceptionsFilter().catch(new BadRequestException('Expired activation'), host as never);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/v1/auth/activation-preview' }));
    expect(JSON.stringify([log.mock.calls, response.json.mock.calls])).not.toMatch(/private-activation-token|private-address/);
  });
});
