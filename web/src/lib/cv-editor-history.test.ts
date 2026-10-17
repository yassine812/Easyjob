import { describe, expect, it } from 'vitest';
import { cvHistoryReducer, type CvEditorState } from './cv-editor-history';
import { cvSections } from './cv-designer';

describe('CV edit history', () => {
  const original: CvEditorState = { title: 'CV', content: '# Name\n\n## Skills\nPython', template: 'classic', fontSize: 14, sections: cvSections('# Name\n\n## Skills\nPython') };
  it('restores content and section fields together, and clears redo after a new edit', () => {
    const changed = '# Name\n\n## Skills\nPython, SQL';
    const history = cvHistoryReducer({ past: [], current: original, future: [] }, { type: 'change', patch: { content: changed, sections: cvSections(changed) } });
    const undo = cvHistoryReducer(history, { type: 'undo' });
    expect(undo.current).toEqual(original);
    expect(cvHistoryReducer(undo, { type: 'redo' }).current.sections[1].body).toBe('Python, SQL');
    const fork = cvHistoryReducer(undo, { type: 'change', patch: { template: 'technology' } });
    expect(fork.future).toEqual([]);
    expect(fork.current.content).toBe(original.content);
  });
});
