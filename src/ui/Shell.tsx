import { useState, type ReactNode } from 'react';
import { useSyncStatus } from '../data/store';
import { SyncBadge } from './SyncBadge';
import { InstallHint } from './InstallHint';

export type Tab = 'oggi' | 'corsa' | 'progressi' | 'altro';

const TABS: { id: Tab; label: string }[] = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'corsa', label: 'Corsa' },
  { id: 'progressi', label: 'Progressi' },
  { id: 'altro', label: 'Altro' },
];

export function Shell({ screens }: { screens: (tab: Tab, go: (t: Tab) => void) => ReactNode }) {
  const [tab, setTab] = useState<Tab>('oggi');
  const status = useSyncStatus();
  return (
    <>
      <div className="wrap">
        <SyncBadge pending={status.pending} online={status.online} />
        <InstallHint />
        {screens(tab, setTab)}
      </div>
      <nav className="tabbar" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
    </>
  );
}
