import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CvDesignerDocument } from './cv-designer-document';
import { cvTemplates } from '@/lib/cv-designer';
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
afterEach(cleanup);
describe('CV layouts preserve source evidence', () => {
  const content = '# Source Name\nEngineer\nsource@example.test\n\n## Expérience\nBuilt an internal tool.\n\n## Compétences techniques\nPython, SQL\n\n## Rubrique personnalisée\nAn original custom section.\n\n## Langues\nFrançais';
  for (const template of cvTemplates) it(`${template.id} renders all actual sections without fake content`, () => {
    render(<CvDesignerDocument content={content} template={template.id} fontSize={14} />);
    const document = screen.getByRole('article');
    for (const evidence of ['Source Name', 'source@example.test', 'Built an internal tool.', 'Python, SQL', 'An original custom section.', 'Français']) expect(document).toHaveTextContent(evidence);
    expect(document.querySelectorAll('[data-cv-section]')).toHaveLength(5);
    expect(document.querySelector('[data-columns]')).toHaveAttribute('data-columns', ['technology', 'creative'].includes(template.id) ? 'two' : 'one');
  });
});
