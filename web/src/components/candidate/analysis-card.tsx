'use client';

import { AnalysisProcessing } from '@/components/shared/analysis-processing';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { AiAnalysis } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AI_TYPE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

function ScoreList({ scores }: { scores: Record<string, unknown> | null }) {
  if (!scores) return null;
  const entries = Object.entries(scores).filter(
    ([, v]) => typeof v === 'number',
  ) as [string, number][];
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
            <span>{value}</span>
          </div>
          <Progress value={Math.min(100, value)} className="mt-1" />
        </div>
      ))}
    </div>
  );
}

function OutputBody({ analysis }: { analysis: AiAnalysis }) {
  const output = analysis.output ?? {};
  const s = (k: string) => String(output[k] ?? '');
  const arr = (k: string) => (Array.isArray(output[k]) ? (output[k] as unknown[]) : []);

  if (analysis.type === 'CV_ANALYZE') {
    return (
      <div className="space-y-4">
        {typeof output.overall_score === 'number' ? (
          <div>
            <p className="text-sm font-medium">Overall score</p>
            <Progress value={output.overall_score as number} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">{output.overall_score}/100</p>
          </div>
        ) : null}
        <ScoreList scores={analysis.scores} />
        {arr('strengths').length > 0 ? (
          <div>
            <p className="text-sm font-medium">Strengths</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {arr('strengths').map((x, i) => <li key={i}>{String(x)}</li>)}
            </ul>
          </div>
        ) : null}
        {arr('weaknesses').length > 0 ? (
          <div>
            <p className="text-sm font-medium">Areas to improve</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {arr('weaknesses').map((x, i) => <li key={i}>{String(x)}</li>)}
            </ul>
          </div>
        ) : null}
        {arr('missing_skills').length > 0 ? (
          <div>
            <p className="text-sm font-medium">Missing skills</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {arr('missing_skills').map((x, i) => (
                <Badge key={i} variant="outline">{String(x)}</Badge>
              ))}
            </div>
          </div>
        ) : null}
        {arr('improvement_suggestions').length > 0 ? (
          <div>
            <p className="text-sm font-medium">Suggestions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {arr('improvement_suggestions').map((x, i) => <li key={i}>{String(x)}</li>)}
            </ul>
          </div>
        ) : null}
        {s('ats_compatibility') ? (
          <p className="text-sm">
            ATS compatibility: <strong>{s('ats_compatibility')}</strong>
          </p>
        ) : null}
      </div>
    );
  }

  if (analysis.type === 'MATCH') {
    return (
      <div className="space-y-4">
        {typeof output.overall_match === 'number' ? (
          <div>
            <p className="text-sm font-medium">Overall match</p>
            <Progress value={output.overall_match as number} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">{output.overall_match}%</p>
          </div>
        ) : null}
        <ScoreList scores={analysis.scores} />
        {s('reasoning') ? <p className="text-sm text-muted-foreground">{s('reasoning')}</p> : null}
      </div>
    );
  }

  if (analysis.type === 'CV_GENERATE') {
    return (
      <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap">
        {s('cv_markdown')}
      </pre>
    );
  }

  if (analysis.type === 'COVER_LETTER') {
    return (
      <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap">
        {s('cover_letter')}
      </pre>
    );
  }

  if (analysis.type === 'INTERVIEW') {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {arr('questions').map((q, i) => <li key={i}>{String(q)}</li>)}
      </ol>
    );
  }

  return <pre className="text-xs">{JSON.stringify(output, null, 2)}</pre>;
}

export function AnalysisCard({ analysis }: { analysis: AiAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{AI_TYPE_LABELS[analysis.type] ?? analysis.type}</CardTitle>
          {analysis.status === 'COMPLETED' ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 size-3" /> Completed
            </Badge>
          ) : analysis.status === 'FAILED' ? (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 size-3" /> Failed
            </Badge>
          ) : (
            <Badge variant="warning">
              <Loader2 className="mr-1 size-3 animate-spin" /> {analysis.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {analysis.status === 'COMPLETED' ? (
          <OutputBody analysis={analysis} />
        ) : analysis.status === 'FAILED' ? (
          <p className="text-sm text-destructive">
            {analysis.error ?? 'Analysis failed. Try again.'}
          </p>
        ) : (
          <AnalysisProcessing />
        )}
        {analysis.completedAt ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Completed {formatDateTime(analysis.completedAt)}
          </p>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Started {formatDateTime(analysis.createdAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
