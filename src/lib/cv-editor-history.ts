import { useReducer } from 'react';
import type { CvSection } from './cv-designer';
export type CvEditorState = { content: string; title: string; template: string; fontSize: number; sections: CvSection[] };
type History = { past: CvEditorState[]; current: CvEditorState; future: CvEditorState[] };
type Action = { type: 'change'; patch: Partial<CvEditorState> } | { type: 'undo' | 'redo' };
export function cvHistoryReducer(state: History, action: Action): History {
  if (action.type === 'change') {
    return { past: [...state.past, state.current].slice(-50), current: { ...state.current, ...action.patch }, future: [] };
  }
  if (action.type === 'undo' && state.past.length) return { past: state.past.slice(0, -1), current: state.past[state.past.length - 1], future: [state.current, ...state.future] };
  if (action.type === 'redo' && state.future.length) return { past: [...state.past, state.current], current: state.future[0], future: state.future.slice(1) };
  return state;
}
export function useCvEditorHistory(initial: CvEditorState) {
  const [history, dispatch] = useReducer(cvHistoryReducer, { past: [], current: initial, future: [] });
  return { ...history, change: (patch: Partial<CvEditorState>) => dispatch({ type: 'change', patch }), undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }) };
}
