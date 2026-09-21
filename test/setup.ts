import { ConsoleEmailProvider } from '../src/queues/email/email.provider';
import { setTestEnv } from './helpers';

// Set worker flags before test modules import configuration-dependent services.
setTestEnv();

beforeEach(() => {
  ConsoleEmailProvider.sentEmails = [];
});
