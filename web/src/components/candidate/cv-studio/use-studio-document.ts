'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { studioApi, type CvDocument, type StudioDraft } from '@/lib/api/cv-studio';
export type StudioState = { document: CvDocument; title: string; template: string };
const stateOf = (draft: StudioDraft): StudioState => ({ document: draft.document, title: draft.title, template: draft.template });
export function useStudioDocument(initial: StudioDraft) {
  const qc = useQueryClient(), [draft, setDraft] = useState(initial), [value, setValue] = useState<StudioState>(() => stateOf(initial));
  const [saving, setSaving] = useState(false), [error, setError] = useState<Error | null>(null), [history, setHistory] = useState({ undo: false, redo: false });
  const current = useRef(value), saved = useRef(initial), flight = useRef<Promise<StudioDraft> | null>(null), past = useRef<StudioState[]>([]), future = useRef<StudioState[]>([]);
  const replace = useCallback((next: StudioState) => { current.current = next; setValue(next); }, []);
  const cacheDraft = useCallback((next: StudioDraft) => {
    qc.setQueriesData<StudioDraft>({ queryKey: ['cv-studio-open'], predicate: query => (query.state.data as StudioDraft | undefined)?.id === next.id }, next);
    void qc.invalidateQueries({ queryKey: ['cv-studio-list'] });
    void qc.invalidateQueries({ queryKey: ['cv-revisions', next.id] });
    void qc.invalidateQueries({ queryKey: ['resumes'] });
  }, [qc]);
  const change = useCallback((update: Partial<StudioState> | ((state: StudioState) => StudioState)) => {
    const next = typeof update === 'function' ? update(current.current) : { ...current.current, ...update };
    past.current = [...past.current.slice(-49), current.current]; future.current = []; replace(next); setHistory({ undo: !!past.current.length, redo: !!future.current.length });
  }, [replace]);
  const acceptServer = useCallback((next: StudioDraft) => { saved.current = next; setDraft(next); replace(stateOf(next)); cacheDraft(next); setError(null); past.current = []; future.current = []; setHistory({ undo: !!past.current.length, redo: !!future.current.length }); }, [replace, cacheDraft]);
  const saveNow = useCallback(async (approve = false): Promise<StudioDraft> => {
    while (flight.current) await flight.current;
    const snapshot = current.current;
    if ((!approve || saved.current.approvedAt) && JSON.stringify(snapshot) === JSON.stringify(stateOf(saved.current))) return saved.current;
    setSaving(true); setError(null);
    const request = studioApi.save(saved.current.id, { ...snapshot, expectedVersion: saved.current.version, approve });
    flight.current = request;
    try {
      const result = await request; saved.current = result; setDraft(result);
      // Typing during a save remains local until the next save; never replace newer input.
      cacheDraft(result);
      return result;
    } catch (e) { setError(e as Error); throw e; }
    finally { if (flight.current === request) flight.current = null; setSaving(false); }
  }, [cacheDraft]);
  const dirty = JSON.stringify(value) !== JSON.stringify(stateOf(draft));
  useEffect(() => {
    if (!dirty || error || saving || value.title.trim().length < 2) return;
    // Real debounced persistence, not a simulated processing state.
    const timer = setTimeout(() => { void saveNow().catch(() => undefined); }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, error, saving, value, saveNow]);
  useEffect(() => { if (!dirty) return; const handler = (e: BeforeUnloadEvent) => e.preventDefault(); window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const undo = () => { const previous = past.current.pop(); if (previous) { future.current.push(current.current); replace(previous); setHistory({ undo: !!past.current.length, redo: !!future.current.length }); } };
  const redo = () => { const next = future.current.pop(); if (next) { past.current.push(current.current); replace(next); setHistory({ undo: !!past.current.length, redo: !!future.current.length }); } };
  return { draft, value, dirty, saving, error, change, saveNow, acceptServer, undo, redo, canUndo: history.undo, canRedo: history.redo };
}
