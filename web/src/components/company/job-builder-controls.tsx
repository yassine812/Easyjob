'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBuilderText } from '@/lib/i18n/job-builder';
import { mergeSkills, normalized, type BuilderSkill } from '@/lib/job-builder';
import styles from './job-builder.module.css';

export function BuilderSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: [string, string][]; label: string }) {
  // Keep existing custom/legacy values visible instead of silently replacing them.
  const matching = options.find(([key]) => normalized(key) === normalized(value));
  const available = value && !matching ? [[value, value], ...options] : options.map(([key, title]) => [normalized(key) === normalized(value) ? value : key, title]);
  return <Select value={value || '__empty'} onValueChange={next => onChange(next === '__empty' ? '' : next)}><SelectTrigger className={styles.select} aria-label={label}><SelectValue /></SelectTrigger><SelectContent position="popper">{available.map(([key, text]) => <SelectItem key={key || '__empty'} value={key || '__empty'}>{text}</SelectItem>)}</SelectContent></Select>;
}

export function TagEditor({ value, onChange, label, suggestions = [], max = 30, maxLength = 500 }: { value: string[]; onChange: (value: string[]) => void; label: string; suggestions?: string[]; max?: number; maxLength?: number }) {
  const text = useBuilderText();
  const [draft, setDraft] = useState('');
  function add(next: string) {
    if (next.trim() && value.length < max && !value.some(item => normalized(item) === normalized(next))) onChange([...value, next.trim()]);
    setDraft('');
  }
  return <div className={styles.tagsEditor}>
    <div className={styles.chips}>{value.map((item, index) => <span className={styles.tag} key={`${item}-${index}`}>{item}<button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`${text('remove')} ${item}`}><X size={13} /></button></span>)}</div>
    <div className={styles.tagAdd}><Input value={draft} maxLength={maxLength} aria-label={label} placeholder={label} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }} onBlur={() => { if (draft.trim()) add(draft); }} /><Button type="button" variant="ghost" size="icon" disabled={!draft.trim() || value.length >= max} aria-label={label} onClick={() => add(draft)}><Plus size={15} /></Button></div>
    {suggestions.length > 0 && <div className={styles.suggestions}>{suggestions.filter(item => !value.some(v => normalized(v) === normalized(item))).map(item => <button key={item} type="button" disabled={value.length >= max} onClick={() => add(item)}>+ {item}</button>)}</div>}
  </div>;
}

export function SkillEditor({ value, onChange }: { value: BuilderSkill[]; onChange: (value: BuilderSkill[]) => void }) {
  const text = useBuilderText();
  const [name, setName] = useState('');
  const update = (index: number, patch: Partial<BuilderSkill>) => onChange(value.map((skill, i) => i === index ? { ...skill, ...patch } : skill));
  const add = () => { if (name.trim()) { onChange(mergeSkills([...value, { name, level: 'INTERMEDIATE', required: true }])); setName(''); } };
  return <div className={styles.skillEditor}>
    {[true, false].map(required => <div key={String(required)}><h3 className={styles.groupLabel}>{text(required ? 'required' : 'preferred')}</h3><div className={styles.chips}>
      {value.map((skill, index) => skill.required === required && <Popover key={normalized(skill.name)}><PopoverTrigger asChild><button type="button" className={styles.skillChip} aria-label={`${text('edit')} ${skill.name}`}><span>{skill.name}</span><span className={styles.skillLevel}>{text(skill.level)}</span><Pencil size={12} /></button></PopoverTrigger><PopoverContent align="start" className="space-y-3 p-4"><p className="font-semibold">{skill.name}</p><label className="grid gap-1.5 text-xs">{text('level')}<BuilderSelect label={text('level')} value={skill.level} onChange={level => update(index, { level: level as BuilderSkill['level'] })} options={['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].map(key => [key, text(key)])} /></label><label className="grid gap-1.5 text-xs">{text('category')}<BuilderSelect label={text('category')} value={String(skill.required)} onChange={v => update(index, { required: v === 'true' })} options={[[ 'true', text('required')], ['false', text('preferred')]]} /></label><Button type="button" variant="destructive" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}><X size={14} />{text('remove')}</Button></PopoverContent></Popover>)}
      {!value.some(skill => skill.required === required) && <span className={styles.muted}>—</span>}
    </div></div>)}
    <div className={styles.tagAdd}><Input aria-label={text('addSkill')} placeholder={text('addSkill')} value={name} onBlur={add} maxLength={80} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><Button type="button" variant="ghost" size="icon" aria-label={text('addSkill')} disabled={!name.trim()} onClick={add}><Plus size={16} /></Button></div><p className={styles.helper}>{text('skillHint')}</p>
  </div>;
}

export function InlineList({ value, onChange, label, suggestions = [] }: { value: string[]; onChange: (value: string[]) => void; label: string; suggestions?: string[] }) {
  const text = useBuilderText();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  function commit(index: number) { const next = [...value]; next[index] = draft.trim(); onChange(next.filter(Boolean)); setEditing(null); }
  function move(index: number, offset: number) { const next = [...value]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); setEditing(null); }
  return <div className={styles.inlineList}>
    {value.map((item, index) => <div key={index} className={styles.inlineRow}><span className={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</span>{editing === index ? <Input autoFocus aria-label={`${label} ${index + 1}`} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => commit(index)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(index); } else if (e.key === 'Escape') setEditing(null); }} /> : <button type="button" className={styles.rowText} onClick={() => { setDraft(item); setEditing(index); }}>{item || label}</button>}<div className={styles.rowActions}>
      <button type="button" aria-label={`${text('up')} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} /></button><button type="button" aria-label={`${text('down')} ${index + 1}`} disabled={index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></button><button type="button" aria-label={`${text('remove')} ${index + 1}`} onClick={() => { onChange(value.filter((_, i) => i !== index)); setEditing(null); }}><X size={14} /></button></div></div>)}
    {editing === value.length ? <div className={styles.tagAdd}><Input autoFocus aria-label={label} value={draft} onBlur={() => commit(value.length)} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(value.length); } else if (e.key === 'Escape') setEditing(null); }} /><Button type="button" variant="ghost" size="icon" aria-label={text('done')} disabled={!draft.trim()} onClick={() => commit(value.length)}><Check size={16} /></Button></div> : <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(value.length); setDraft(''); }}><Plus size={14} />{label}</Button>}
    {suggestions.length > 0 && <div className={styles.suggestions}>{suggestions.filter(item => !value.includes(item)).map(item => <button key={item} type="button" onClick={() => onChange([...value, item])}>+ {item}</button>)}</div>}
  </div>;
}
