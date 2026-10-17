'use client';
/** Render a restrained, printable CV. Source text is escaped by React; HTML is never evaluated. */
export function CvPreview({ content, template = 'classic' }: { content: string; template?: string }) {
  return <article className={`career-print-cv mx-auto max-w-3xl rounded-xl border bg-white text-slate-900 shadow-sm ${template === 'compact' ? 'p-6 text-sm [&_h2]:mt-4 [&_p]:leading-5' : 'p-8 sm:p-12'} ${template === 'modern' ? 'border-t-8 border-t-indigo-600 [&_h2]:text-indigo-800 [&_h1]:text-indigo-950' : ''}`} dir="auto">
    {content.split(/\r?\n/).map((line, index) => {
      if (line.startsWith('# ')) return <h1 key={index} className="mb-5 text-3xl font-bold tracking-tight">{line.slice(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={index} className="mb-3 mt-7 border-b border-slate-300 pb-2 text-base font-bold uppercase tracking-wide">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={index} className="mb-1 mt-4 font-semibold">{line.slice(4)}</h3>;
      if (/^[-•*] /.test(line)) return <p key={index} className="ms-4 py-0.5 text-sm leading-6">• {line.slice(2)}</p>;
      return line.trim() ? <p key={index} className="break-words text-sm leading-6">{line}</p> : <div key={index} className="h-2" />;
    })}
    <style>{`@media print { body * { visibility: hidden; } .career-print-cv, .career-print-cv * { visibility: visible; } .career-print-cv { position: absolute; inset: 0 auto auto 0; width: 100%; max-width: none; border: 0; box-shadow: none; padding: 12mm; } .career-print-cv h2,.career-print-cv h3 { break-after: avoid; } @page { margin: 12mm; } }`}</style>
  </article>;
}
