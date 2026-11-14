import type { Tab } from './Shell';
import { WorkoutScreen } from './WorkoutScreen';

export function Screens({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  if (tab === 'oggi') return <WorkoutScreen onRun={() => go('corsa')} />;
  return <p className="muted">Sezione “{tab}” in arrivo.</p>;
}
