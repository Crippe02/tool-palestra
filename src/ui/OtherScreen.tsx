import { useState } from 'react';
import { BaselineScreen } from './BaselineScreen';
import { BodyLogScreen } from './BodyLogScreen';
import { ExercisesScreen } from './ExercisesScreen';
import { ImportScreen } from './ImportScreen';
import { BackupButton } from './BackupButton';

const SECTIONS = [
  ['misure', 'Misure'], ['partenza', 'Punto di partenza'], ['esercizi', 'Esercizi'], ['importa', 'Importa'], ['backup', 'Backup'],
] as const;
type Section = (typeof SECTIONS)[number][0];

export function OtherScreen({ initial = 'misure' }: { initial?: Section }) {
  const [section, setSection] = useState<Section>(initial);
  return (
    <section className="stack">
      <div className="chips" role="tablist">
        {SECTIONS.map(([id, label]) => (
          <button key={id} role="tab" className="chip" aria-selected={section === id} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>
      {section === 'misure' && <BodyLogScreen />}
      {section === 'partenza' && <BaselineScreen />}
      {section === 'esercizi' && <ExercisesScreen />}
      {section === 'importa' && <ImportScreen />}
      {section === 'backup' && <BackupButton />}
    </section>
  );
}
