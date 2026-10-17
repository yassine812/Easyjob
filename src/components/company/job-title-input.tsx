'use client';

import { useEffect, useId, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { jobsApi, type JobTitleSuggestion } from '@/lib/api/jobs';
import { useCompanyText } from '@/lib/i18n/company';
import styles from './job-suggestions.module.css';

export function JobTitleInput({ value, onChange, onSelect, onBlur, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onSelect'> & {
  value: string; onChange: (value: string) => void; onSelect: (role: JobTitleSuggestion) => void;
}) {
  const id = useId(), copy = useCompanyText();
  const [focused, setFocused] = useState(false), [dismissed, setDismissed] = useState(false);
  const [result, setResult] = useState<{ query: string; items: JobTitleSuggestion[] }>({ query: '', items: [] });
  const [active, setActive] = useState(0);
  const query = value.trim();
  useEffect(() => {
    if (!focused || dismissed || query.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      jobsApi.titleSuggestions(query).then(items => { if (current) setResult({ query, items: items.slice(0, 6) }); })
        .catch(() => { if (current) setResult({ query, items: [] }); });
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [query, focused, dismissed]);
  const items = result.query === query ? result.items : [];
  const open = focused && !dismissed && items.length > 0;
  const choose = (item: JobTitleSuggestion) => { setDismissed(true); onChange(item.label); onSelect(item); };
  return <div className={styles.combobox}>
    <Input {...props} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${Math.min(active, items.length - 1)}` : undefined}
      onFocus={() => { setFocused(true); setDismissed(false); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      onChange={event => { setActive(0); setDismissed(false); onChange(event.target.value); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setDismissed(true); }
        if (!open) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); }
        if (event.key === 'Enter') { event.preventDefault(); choose(items[Math.min(active, items.length - 1)]); }
      }} />
    {open && <div id={id} role="listbox" aria-label={copy('jobTitleSuggestions')} className={styles.results}>{items.map((item, index) =>
      <button id={`${id}-${index}`} key={item.id} type="button" tabIndex={-1} role="option" aria-selected={index === active}
        onPointerDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>{item.label}</button>)}</div>}
  </div>;
}
