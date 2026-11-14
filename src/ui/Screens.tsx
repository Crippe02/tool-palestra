import type { Tab } from './Shell';
import { WorkoutScreen } from './WorkoutScreen';
import { OtherScreen } from './OtherScreen';
import { RunScreen } from './RunScreen';
import { ProgressScreen } from './ProgressScreen';

export function Screens({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  switch (tab) {
    case 'oggi': return <WorkoutScreen onRun={() => go('corsa')} />;
    case 'corsa': return <RunScreen />;
    case 'progressi': return <ProgressScreen onSetup={() => go('altro')} />;
    case 'altro': return <OtherScreen />;
  }
}
