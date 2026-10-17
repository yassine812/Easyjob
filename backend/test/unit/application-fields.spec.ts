import { validateApplicationAnswers } from '../../src/applications/application-fields';

describe('candidate-reviewed application fields', () => {
  const schema = [{ id: 'eligibility', label: 'Eligibility', type: 'boolean', required: true }, { id: 'portfolio', label: 'Portfolio', type: 'file', required: true }];
  it('accepts false as a real answer and only owned attachment IDs', () => {
    expect(() => validateApplicationAnswers(schema, { eligibility: false, portfolio: 'owned' }, ['owned'])).not.toThrow();
    expect(() => validateApplicationAnswers(schema, { eligibility: true, portfolio: 'someone-elses' }, ['owned'])).toThrow();
  });
  it('rejects missing required answers, arbitrary questions and unsupported date values', () => {
    expect(() => validateApplicationAnswers(schema)).toThrow();
    expect(() => validateApplicationAnswers([], { invented: 'yes' })).toThrow();
    expect(() => validateApplicationAnswers([{ id: 'day', type: 'date', required: true }], { day: '2026-99-99' })).toThrow();
  });
});
