'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { Info, Pencil } from 'lucide-react';
import { useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { AtsCriterion, AtsReport } from '@/lib/api/career';
import { isCvStrength, matchCvEvidence } from '@/lib/cv-highlights';
import { cvSections, cvTemplates, isCvSidebarSection } from '@/lib/cv-designer';
import { useReleaseText } from '@/lib/i18n/release';
import styles from './cv-designer.module.css';
const subscribe = () => () => {};

export type CvDocumentProps = { content: string; template: string; fontSize: number; report?: AtsReport; onFinding?: (finding: AtsCriterion) => void; onFindingEnd?: () => void; onImproveLine?: (sectionIndex: number, lineIndex: number) => void; onSelectSection?: (index: number) => void; selectedSection?: number; miniature?: boolean };

export function CvDesignerDocument({ content, template, fontSize, report, onFinding, onFindingEnd, onImproveLine, onSelectSection, selectedSection, miniature = false }: CvDocumentProps) {
  const tr = useReleaseText(), mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const sections = cvSections(content), layout = cvTemplates.find(t => t.id === template) ?? cvTemplates[0];
  const twoColumns = ['technology', 'creative'].includes(layout.id);
  const header = sections[0], body = sections.slice(1).map((s, i) => ({ ...s, index: i + 1 }));
  const side = twoColumns ? body.filter(s => isCvSidebarSection(s.heading)) : [];
  const main = twoColumns ? body.filter(s => !isCvSidebarSection(s.heading)) : body;
  const runs = sections.flatMap(s => [s.heading, ...s.body.split('\n')]);
  const matches = matchCvEvidence(runs, report?.criteria ?? []);
  const offsets = sections.map((_, index) => sections.slice(0, index).reduce((n, s) => n + 1 + s.body.split('\n').length, 0));
  function lineText(line: string, index: number) {
    const finding = matches.get(index);
    return <><span className={finding ? isCvStrength(finding) ? styles.good : styles.improve : undefined}>{line.replace(/^#{1,3}\s+/, '').replace(/^[-*]\s+/, '• ')}</span>{finding && onFinding && !miniature && <button type="button" className={styles.info} onPointerLeave={onFindingEnd} onBlur={onFindingEnd} onPointerEnter={() => onFinding(finding)} onFocus={() => onFinding(finding)} onClick={() => onFinding(finding)} aria-label={tr('Pourquoi ce passage est surligné', 'Why this passage is highlighted', 'لماذا تم تلوين هذا النص')}><Info size={13} /></button>}</>;
  }
  function improveLine(sectionIndex: number, lineIndex: number) {
    return onImproveLine && !miniature ? <button type="button" className={styles.improveLine} onClick={() => onImproveLine(sectionIndex, lineIndex)} aria-label={tr('Améliorer cette ligne', 'Improve this line', 'تحسين هذا السطر')} title={tr('Améliorer cette ligne', 'Improve this line', 'تحسين هذا السطر')}><EasyJobFeatureMark size="sm" /></button> : null;
  }
  function edit(index: number, name: string) {
    return onSelectSection && !miniature ? <button className={styles.editSection} type="button" onClick={() => onSelectSection(index)} aria-label={`${tr('Modifier', 'Edit', 'تعديل')} : ${name}`}><Pencil size={12} /></button> : null;
  }
  function block(s: typeof main[number]) {
    return <section key={s.index} className={styles.section} data-cv-section={s.index} data-selected={!miniature && selectedSection === s.index || undefined} tabIndex={-1}>
      <div className={styles.sectionHeading}><h2>{s.heading}</h2>{edit(s.index, s.heading)}</div>
      <div className={styles.sectionBody}>{s.body.split('\n').map((line, i) => line.trim() ? line.startsWith('### ') ? <h3 key={i}>{lineText(line, offsets[s.index] + 1 + i)}</h3> : <p key={i} className={`${styles.editableLine} ${/^[-•*]\s/.test(line) ? styles.bullet : ''}`}>{lineText(line, offsets[s.index] + 1 + i)}{improveLine(s.index, i)}</p> : <div key={i} className={styles.space} />)}</div>
    </section>;
  }
  const view = <article dir="auto" aria-label={miniature ? undefined : tr('Aperçu du CV', 'CV preview', 'معاينة السيرة')} className={styles.document} data-template={layout.id} data-miniature={miniature || undefined} style={{ '--cv-accent': layout.color, fontSize } as CSSProperties}>
    <header className={styles.identity} data-cv-section={0} data-selected={!miniature && selectedSection === 0 || undefined} tabIndex={-1}>
      {header.heading && <p>{header.heading}</p>}
      {header.body.split('\n').map((line, i) => !line.trim() ? null : i === 0 && line.length < 120 && !line.includes('@') ? <h1 key={i}>{lineText(line, i + 1)}</h1> : <p key={i} className={/@|https?:|linkedin|github|\+?\d[\d\s().-]{6}/i.test(line) ? styles.contact : styles.headline}>{lineText(line, i + 1)}</p>)}
      {edit(0, tr('Informations & présentation', 'Information & introduction', 'معلومات ومقدمة'))}
    </header>
    <div className={styles.documentBody} data-columns={side.length ? 'two' : 'one'}>
      <div className={styles.mainColumn}>{main.map(block)}</div>
      {!!side.length && <aside className={styles.sideColumn}>{side.map(block)}</aside>}
    </div>
  </article>;
  return <>{view}{!miniature && mounted && createPortal(<div className={styles.printRoot} style={{ display: 'none' }} aria-hidden="true">{view}</div>, document.body)}</>;
}
