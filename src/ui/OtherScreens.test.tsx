import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithEngine } from './testUtils';
import { ExercisesScreen } from './ExercisesScreen';
import { ImportScreen } from './ImportScreen';
import { BodyLogScreen } from './BodyLogScreen';
import { previousLoad } from '../domain/progression';
import type { BodyLog, Exercise, Profile, SetLog } from '../domain/types';

const lpLog: Omit<SetLog, 'updatedAt'> = { day: 'legs', exerciseId: 'lp', cycle: 1, week: 1, kg: 80, reps: '12,12' };

async function openLegs() {
  await userEvent.selectOptions(screen.getByLabelText('Giorno'), 'legs');
}

test('rinominare un esercizio e cambiarne lo schema mantiene lo storico', async () => {
  const { engine } = await renderWithEngine(<ExercisesScreen />, { rows: { set_logs: [lpLog] } });
  await openLegs();
  const row = screen.getByRole('group', { name: 'Leg press' });
  const name = within(row).getByLabelText('Nome');
  await userEvent.clear(name);
  await userEvent.type(name, 'Pressa 45°');
  const scheme = within(row).getByLabelText('Schema');
  await userEvent.clear(scheme);
  await userEvent.type(scheme, '3×8-10');
  await userEvent.click(within(row).getByRole('button', { name: 'Salva' }));
  await waitFor(() => {
    const lp = engine.rows<Exercise>('exercises').find((e) => e.day === 'legs' && e.id === 'lp')!;
    expect(lp).toMatchObject({ name: 'Pressa 45°', sets: 3, repMin: 8, repMax: 10 });
    expect(previousLoad(engine.rows<SetLog>('set_logs'), lp, 1, 2)).toEqual({ kg: 80, source: 'S1' });
  });
});

test('uno schema scritto male non si salva', async () => {
  const { engine } = await renderWithEngine(<ExercisesScreen />);
  await openLegs();
  const row = screen.getByRole('group', { name: 'Leg press' });
  const scheme = within(row).getByLabelText('Schema');
  await userEvent.clear(scheme);
  await userEvent.type(scheme, 'tre per otto');
  await userEvent.click(within(row).getByRole('button', { name: 'Salva' }));
  expect(within(row).getByText(/Scrivi lo schema come 3×8-10/)).toBeInTheDocument();
  expect(engine.rows<Exercise>('exercises').find((e) => e.day === 'legs' && e.id === 'lp')!.sets).toBe(2);
});

test('disattivare un esercizio lo nasconde ma tiene i dati', async () => {
  const { engine } = await renderWithEngine(<ExercisesScreen />, { rows: { set_logs: [lpLog] } });
  await openLegs();
  await userEvent.click(within(screen.getByRole('group', { name: 'Leg press' })).getByRole('button', { name: 'Disattiva' }));
  await waitFor(() => expect(engine.rows<Exercise>('exercises').find((e) => e.day === 'legs' && e.id === 'lp')!.active).toBe(false));
  expect(engine.rows<SetLog>('set_logs')).toHaveLength(1);
});

test('aggiungere un esercizio', async () => {
  const { engine } = await renderWithEngine(<ExercisesScreen />);
  await openLegs();
  await userEvent.type(screen.getByLabelText('Nuovo esercizio'), 'Hip abductor');
  await userEvent.type(screen.getByLabelText('Schema del nuovo esercizio'), '3×15');
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
  await waitFor(() => {
    const added = engine.rows<Exercise>('exercises').find((e) => e.name === 'Hip abductor')!;
    expect(added).toMatchObject({ day: 'legs', sets: 3, repMin: 15, repMax: 15, active: true });
    expect(added.position).toBeGreaterThan(5);
  });
});

test('importa i dati incollati dalla vecchia scheda', async () => {
  const { engine } = await renderWithEngine(<ImportScreen />);
  await userEvent.click(screen.getByLabelText('Dati copiati dalla scheda'));
  await userEvent.paste('{"log":{"push.inc.w3":{"kg":"52.5","reps":"8,8,7"}},"week":4}');
  expect(screen.getByText('Voci trovate: 1 · settimana 4')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Importa' }));
  await waitFor(() => {
    expect(engine.rows<Profile>('profile')[0].currentWeek).toBe(4);
    expect(engine.rows<SetLog>('set_logs')).toEqual([expect.objectContaining({ day: 'push', exerciseId: 'inc', week: 3, kg: 52.5 })]);
  });
});

test('testo sbagliato non importa nulla', async () => {
  const { engine } = await renderWithEngine(<ImportScreen />);
  await userEvent.click(screen.getByLabelText('Dati copiati dalla scheda'));
  await userEvent.paste('ciao');
  expect(screen.getByText('Questo non sembra il file della scheda')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Importa' })).toBeNull();
  expect(engine.rows('set_logs')).toHaveLength(0);
});

test('salva il peso di oggi con la virgola', async () => {
  const { engine } = await renderWithEngine(<BodyLogScreen />);
  await userEvent.type(screen.getByLabelText('Peso (kg)'), '79,4');
  await userEvent.click(screen.getByRole('button', { name: 'Salva misure' }));
  await waitFor(() => expect(engine.rows<BodyLog>('body_logs')[0]).toMatchObject({ weightKg: 79.4, waistCm: null }));
});
