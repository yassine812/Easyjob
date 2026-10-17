export interface SpeechMetrics {
  durationSeconds: number | null;
  wordCount: number;
  wordsPerMinute: number | null;
  fillerCount: number;
  fillerRate: number;
  longPauseCount: number | null;
  source: 'browser_transcript' | 'text_only';
}

const FILLERS = [
  /\beuh\b/gi, /\bhum\b/gi, /\bmmm+\b/gi, /\bbah\b/gi, /\bvoilà\b/gi,
  /\ben fait\b/gi, /\bdu coup\b/gi, /\buh\b/gi, /\bum\b/gi,
  /\blike\b/gi, /\byou know\b/gi, /\bbasically\b/gi, /\bactually\b/gi,
];

export function speechMetrics(answer: string, durationSeconds?: number, fillerCount?: number, longPauseCount?: number): SpeechMetrics {
  const text = answer.trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const detectedFillers = FILLERS.reduce((total, pattern) => total + (text.match(pattern)?.length || 0), 0);
  const count = fillerCount ?? detectedFillers;
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : null;
  return {
    durationSeconds: duration,
    wordCount,
    wordsPerMinute: duration ? Math.round((wordCount * 60) / duration) : null,
    fillerCount: count,
    fillerRate: wordCount ? Number((count / wordCount).toFixed(3)) : 0,
    longPauseCount: longPauseCount ?? null,
    source: duration ? 'browser_transcript' : 'text_only',
  };
}
