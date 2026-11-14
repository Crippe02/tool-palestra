import type { Tab } from './Shell';
import { WorkoutScreen } from './WorkoutScreen';
import { OtherScreen } from './OtherScreen';

export function Screens({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  if (tab === 'oggi') return <WorkoutScreen onRun={() => go('corsa')} />;
  if (tab === 'altro') return <OtherScreen />;
  return <p className="muted">Sezione “{tab}” in arrivo.</p>;
}
