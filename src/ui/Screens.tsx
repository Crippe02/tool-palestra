import type { Tab } from './Shell';

export function Screens({ tab }: { tab: Tab; go: (t: Tab) => void }) {
  return <p className="muted">Sezione “{tab}” in arrivo.</p>;
}
