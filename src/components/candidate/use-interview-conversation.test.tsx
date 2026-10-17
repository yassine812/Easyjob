import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterviewConversation, shouldFinishAnswer } from './use-interview-conversation';
import { careerApi, type CoachSession } from '@/lib/api/career';
vi.mock('@/lib/api/career', () => ({ careerApi: { saveTurn: vi.fn().mockResolvedValue({ saved: true }), answer: vi.fn() } }));
const session: CoachSession = { id: 'session', jobTitle: 'Mobile developer', company: 'Example', locale: 'fr', interviewType: 'TECHNICAL', questions: ['Explique ton choix technique.', 'Quel test as-tu utilisé ?'], answers: [], visionConsent: false };
const feedback = { good: ['Choix expliqué'], improve: [], betterAnswer: '', keywords: [], clarity: '', relevance: '', method: 'ai_coaching' };
class Utterance { text: string; onend?: () => void; onstart?: () => void; onboundary?: (e: {charIndex: number; charLength: number}) => void; constructor(text: string) { this.text = text; } }
let utterances: Utterance[], engines: Engine[];
class Engine {
  onresult?: (e: unknown) => void; onend?: () => void; onerror?: (e: unknown) => void;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { engines.push(this); }
  result(text: string, final = true) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] }); }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); utterances = []; engines = [];
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', { speak: vi.fn((u: Utterance) => { utterances.push(u); u.onstart?.(); }), cancel: vi.fn() });
  vi.stubGlobal('SpeechRecognition', Engine);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('conversational interview lifecycle', () => {
  it('speaks the question then listens automatically, with progressive captions', async () => {
    const { result, unmount } = renderHook(() => useInterviewConversation(session, null));
    expect(result.current.state).toBe('INTERVIEWER_SPEAKING'); expect(engines).toHaveLength(0);
    act(() => utterances[0].onboundary?.({charIndex: 0, charLength: 8}));
    expect(result.current.caption).toBe('Explique');
    await act(async () => utterances[0].onend?.());
    expect(result.current.state).toBe('LISTENING'); expect(engines[0].start).toHaveBeenCalledOnce();
    unmount(); expect(engines[0].abort).toHaveBeenCalledOnce();
  });
  it('analyzes the transcript, shows brief feedback and speaks the next turn without navigation', async () => {
    vi.mocked(careerApi.answer).mockResolvedValue({ ...session, answers: [{ answer: 'Mon choix reposait sur un test réel.', feedback }] });
    const { result } = renderHook(() => useInterviewConversation(session, null));
    await act(async () => utterances[0].onend?.());
    act(() => engines[0].result('Mon choix reposait sur un test réel.'));
    expect(result.current.state).toBe('ANSWERING');
    await act(async () => result.current.finish());
    expect(careerApi.answer).toHaveBeenCalledWith('session', expect.objectContaining({ questionIndex: 0, answer: 'Mon choix reposait sur un test réel.' }));
    expect(result.current.state).toBe('INTERVIEWER_FEEDBACK');
    await act(async () => vi.advanceTimersByTimeAsync(2500));
    expect(utterances.at(-1)?.text).toBe(session.questions[1]);
    expect(result.current.transcript).toBe('');
  });
  it('preserves a failed answer and permits an explicit retry', async () => {
    vi.mocked(careerApi.answer).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...session, answers: [{ answer: 'Une réponse conservée.', feedback }] });
    const { result } = renderHook(() => useInterviewConversation(session, null));
    await act(async () => utterances[0].onend?.()); act(() => engines[0].result('Une réponse conservée.'));
    await act(async () => result.current.finish());
    expect(result.current.error).toContain('conservée'); expect(result.current.transcript).toBe('Une réponse conservée.');
    await act(async () => result.current.finish()); expect(result.current.state).toBe('INTERVIEWER_FEEDBACK');
  });
  it('resumes an interrupted server analysis without losing or changing its submitted answer', async () => {
    vi.mocked(careerApi.answer).mockResolvedValue({ ...session, answers: [{ answer: 'Réponse sauvegardée.', feedback }] });
    await act(async () => { renderHook(() => useInterviewConversation({ ...session, conversation: { state: 'ANALYZING', questionIndex: 0, transcript: 'Réponse sauvegardée.', code: '', pendingAnswer: {questionIndex: 0, answer: 'Réponse sauvegardée.'} } }, null)); });
    expect(careerApi.answer).toHaveBeenCalledWith('session', {questionIndex: 0, answer: 'Réponse sauvegardée.'});
    expect(utterances).toHaveLength(0);
  });
  it('keeps coding submissions explicit and never treats a short pause as the end', () => {
    expect(shouldFinishAnswer(1500, 'Une réponse complète', false, false)).toBe(false);
    expect(shouldFinishAnswer(7000, '', false, false)).toBe(false);
    expect(shouldFinishAnswer(7000, 'Une réponse complète', true, false)).toBe(false);
    expect(shouldFinishAnswer(7000, 'Une réponse complète', false, true)).toBe(false);
    expect(shouldFinishAnswer(7000, 'Une réponse complète', false, false)).toBe(true);
  });
  it('unmutes without repeating the question, but an explicit replay preserves the draft', async () => {
    const { result } = renderHook(() => useInterviewConversation(session, null));
    await act(async () => utterances[0].onend?.());
    act(() => engines[0].result('Mon exemple conservé.'));
    act(() => result.current.toggleMic());
    await act(async () => result.current.toggleMic());
    expect(utterances).toHaveLength(1);
    expect(engines).toHaveLength(2);
    act(() => result.current.replay());
    expect(utterances).toHaveLength(2);
    expect(result.current.transcript).toBe('Mon exemple conservé.');
  });
});
