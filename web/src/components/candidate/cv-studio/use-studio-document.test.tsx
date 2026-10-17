import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { blankDocument, type StudioDraft } from '@/lib/api/cv-studio';
import { useStudioDocument } from './use-studio-document';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/lib/api/cv-studio', async original => ({ ...await original<object>(), studioApi: { save: mocks.save } }));
const initial = (): StudioDraft => ({ id: 'draft', title: 'Mon CV', version: 1, template: 'modern', document: blankDocument(), updatedAt: '2026-09-25', approvedAt: null, beforeScore: null, nextQuestion: null, report: { score: null, criteria: [], strengths: [], suggestions: [], missingKeywords: [], missingSkills: [], formattingProblems: [], limitations: [] }, issues: [] });
function setup() { const client = new QueryClient(); return renderHook(() => useStudioDocument(initial()), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }); }
beforeEach(() => vi.clearAllMocks());
describe('CV autosave and local state', () => {
  it('preserves typing made while a previous request is saving', async () => {
    let resolve!: (value: StudioDraft) => void;
    mocks.save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { result, unmount } = setup();
    act(() => result.current.change({ title: 'First edit' }));
    let save!: Promise<StudioDraft>; act(() => { save = result.current.saveNow(); });
    act(() => result.current.change({ title: 'Newer edit' }));
    await act(async () => { resolve({ ...initial(), title: 'First edit', version: 2 }); await save; });
    expect(result.current.value.title).toBe('Newer edit'); expect(result.current.dirty).toBe(true); expect(result.current.draft.version).toBe(2); unmount();
  });
  it('retains local edits on conflict and does not claim they were saved', async () => {
    mocks.save.mockRejectedValue(new Error('Version conflict'));
    const { result, unmount } = setup(); act(() => result.current.change({ title: 'My unsaved work' }));
    await act(async () => { await result.current.saveNow().catch(() => undefined); });
    expect(result.current.value.title).toBe('My unsaved work'); expect(result.current.error?.message).toBe('Version conflict'); expect(result.current.draft.version).toBe(1); unmount();
  });
  it('undoes and redoes structured edits without losing IDs', async () => {
    const { result, unmount } = setup(); const doc = result.current.value.document;
    act(() => result.current.change({ document: { ...doc, personal: { ...doc.personal, name: 'Example' } } }));
    act(() => result.current.undo()); expect(result.current.value.document.personal.name).toBe('');
    act(() => result.current.redo()); await waitFor(() => expect(result.current.value.document.personal.name).toBe('Example')); unmount();
  });
});
