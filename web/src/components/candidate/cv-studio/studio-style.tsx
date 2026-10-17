'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { cvTemplateCatalog, type CvDocument, type CvStyle, renderDocument } from '@/lib/api/cv-studio';

export function TemplateMiniature({ document, template }: { document: CvDocument; template: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!host.current) return; const root = host.current.shadowRoot || host.current.attachShadow({ mode: 'open' }); const view = renderDocument(document, template); root.innerHTML = `<style>${view.css}:host{display:block;height:175px;overflow:hidden;background:white;color:#263342}.mini{width:595pt;min-height:842pt;padding:${view.margin}pt;transform:scale(.19);transform-origin:top left;box-sizing:border-box}</style><div class="mini">${view.html || '<h1>Votre nom</h1><p class="cv-title">Votre titre professionnel</p><h2>Profil professionnel</h2><p>Votre contenu apparaîtra ici.</p>'}</div>`; }, [document, template]);
  return <div ref={host} aria-hidden className="overflow-hidden rounded border bg-white" />;
}

const filters = ['Tous', 'ATS', 'Canada', 'France', 'International', 'Tech', 'Corporate', 'Junior', 'Senior'];

export function StudioTemplates({ document, selected, onSelect }: { document: CvDocument; selected: string; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState('Tous'), [market, setMarket] = useState('Tous');
  const visible = useMemo(() => cvTemplateCatalog.filter(template => {
    const marketMatch = market === 'Tous' || template.market === market;
    const filterMatch = filter === 'Tous' || filter === 'ATS' && template.atsFriendly || filter === 'Canada' && template.market === 'CA' || filter === 'France' && template.market === 'FR' || filter === 'International' && template.market === 'INTL' || template.category === filter;
    return marketMatch && filterMatch;
  }), [filter, market]);
  return <div className="space-y-4">
    <label className="block space-y-2 text-xs font-medium">Marché cible<select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={market} onChange={event => setMarket(event.target.value)}><option value="Tous">Tous les marchés</option><option value="CA">Canada</option><option value="FR">France</option><option value="US">États-Unis</option><option value="UK">Royaume-Uni</option><option value="INTL">International</option></select></label>
    <div className="flex gap-1 overflow-x-auto pb-1">{filters.map(item => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${filter === item ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>{item}</button>)}</div>
    <p className="text-xs leading-5 text-muted-foreground">Chaque modèle applique de vraies conventions de marché tout en conservant les mêmes données et un texte sélectionnable.</p>
    <div className="grid grid-cols-2 gap-3">{visible.map(template => <button key={template.id} aria-pressed={selected === template.id} onClick={() => onSelect(template.id)} className={`relative min-w-0 rounded-lg p-2 text-start outline-offset-2 ${selected === template.id ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted'}`}><TemplateMiniature document={document} template={template.id} />{selected === template.id && <span className="absolute end-3 top-3 rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-3" /></span>}<strong className="mt-2 block text-xs">{template.name}</strong><span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{template.market === 'INTL' ? 'International' : template.market} · {template.category}{template.atsFriendly && <><ShieldCheck className="ms-1 size-3 text-emerald-500" />ATS</>}</span></button>)}</div>
    {!visible.length && <p className="rounded-lg border p-4 text-xs text-muted-foreground">Aucun modèle ne correspond à ces filtres.</p>}
  </div>;
}

export function StudioStyle({ value, onChange, layout = false }: { value: CvStyle; onChange: (value: CvStyle) => void; layout?: boolean }) {
  const controls: { key: keyof CvStyle; title: string; options: [string, string][] }[] = layout ? [
    { key: 'margins', title: 'Marges A4', options: [['compact', 'Compactes'], ['standard', 'Standard'], ['wide', 'Larges']] },
    { key: 'spacing', title: 'Espacement', options: [['compact', 'Compact'], ['balanced', 'Équilibré'], ['spacious', 'Aéré']] },
    { key: 'alignment', title: 'Alignement de l’en-tête', options: [['left', 'À gauche'], ['center', 'Centré']] },
  ] : [
    { key: 'headingFont', title: 'Police des titres', options: [['sans', 'Sans empattement'], ['serif', 'Avec empattement']] },
    { key: 'bodyFont', title: 'Police du texte', options: [['sans', 'Sans empattement'], ['serif', 'Avec empattement']] },
    { key: 'size', title: 'Taille du texte', options: [['12', 'Compacte — 9 pt'], ['14', 'Standard — 10,5 pt'], ['16', 'Confort — 12 pt']] },
    { key: 'accent', title: 'Couleur d’accent', options: [['navy', 'Bleu professionnel'], ['teal', 'Vert profond'], ['slate', 'Ardoise'], ['plum', 'Prune'], ['brown', 'Brun']] },
    { key: 'headings', title: 'Titres des rubriques', options: [['line', 'Séparateur fin'], ['plain', 'Typographique'], ['band', 'Fond discret']] },
  ];
  return <div className="space-y-5">{controls.map(control => <label className="block space-y-2 text-xs font-medium" key={control.key}>{control.title}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value[control.key]} onChange={event => onChange({ ...value, [control.key]: control.key === 'size' ? Number(event.target.value) : event.target.value })}>{control.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>)}<p className="text-xs leading-5 text-muted-foreground">Préréglages adaptés au format A4. Le contenu est conservé quand tu changes de présentation.</p></div>;
}
