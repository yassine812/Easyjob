import { PrismaService } from '../../src/prisma/prisma.service';

describe('test database cleanup boundary', () => {
  const priorEnvironment = process.env.NODE_ENV, priorDatabase = process.env.DATABASE_URL;
  afterEach(() => {
    if (priorEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorEnvironment;
    if (priorDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = priorDatabase;
  });
  function client() {
    return { $queryRawUnsafe: jest.fn().mockResolvedValue([{ tablename: 'Job' }, { tablename: 'Odd"Name' }]), $executeRawUnsafe: jest.fn().mockResolvedValue(0) };
  }
  it.each([
    ['production', 'postgresql://test:test@localhost/isolated_test'],
    ['test', 'postgresql://test:test@localhost/easyjob'],
  ])('refuses cleanup for environment %s and database %s', async (environment, database) => {
    process.env.NODE_ENV = environment; process.env.DATABASE_URL = database;
    const fake = client();
    await expect(PrismaService.prototype.cleanDatabase.call(fake as never)).rejects.toThrow('explicitly named test database');
    expect(fake.$queryRawUnsafe).not.toHaveBeenCalled(); expect(fake.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it('clears the explicitly isolated test database in one statement and quotes table identifiers', async () => {
    process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/isolated_test';
    const fake = client(); await PrismaService.prototype.cleanDatabase.call(fake as never);
    expect(fake.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(fake.$executeRawUnsafe).toHaveBeenCalledWith('TRUNCATE TABLE "public"."Job", "public"."Odd""Name" CASCADE');
  });
});
