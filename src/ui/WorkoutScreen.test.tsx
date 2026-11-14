import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithEngine } from './testUtils';
import { WorkoutScreen } from './WorkoutScreen';
import type { Profile, SetLog } from '../domain/types';

const card = (name: string) => screen.getByRole('article', { name });

test('il giorno Legs mostra gli esercizi nell\'ordine giusto', async () => {
  await renderWithEngine(<WorkoutScreen onRun={() => {}} />);
  await userEvent.click(screen.getByRole('tab', { name: /Legs/ }));
  const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
  expect(names).toEqual(['Hack squat', 'Stacco rumeno', 'Leg press', 'Leg extension', 'Leg curl', 'Polpacci']);
});

test('il carico con la virgola si salva come numero', async () => {
  const { engine } = await renderWithEngine(<WorkoutScreen onRun={() => {}} />, { profile: { currentWeek: 2 } });
  await userEvent.type(within(card('Panca inclinata manubri')).getByLabelText('Carico (kg)'), '52,5');
  await waitFor(() => {
    const log = engine.rows<SetLog>('set_logs').find((l) => l.exerciseId === 'inc' && l.day === 'push');
    expect(log).toMatchObject({ kg: 52.5, week: 2, cycle: 1 });
  });
});

test('suggerisce +2,5 kg dopo aver chiuso tutte le serie', async () => {
  const s1: Omit<SetLog, 'updatedAt'> = { day: 'legs', exerciseId: 'hs', cycle: 1, week: 1, kg: 70, reps: '8,8,8,8' };
  await renderWithEngine(<WorkoutScreen onRun={() => {}} />, { profile: { currentWeek: 2 }, rows: { set_logs: [s1] } });
  await userEvent.click(screen.getByRole('tab', { name: /Legs/ }));
  expect(within(card('Hack squat')).getByText(/Oggi: 72,5 kg/)).toBeInTheDocument();
});

test('dopo la settimana 24 si inizia un nuovo ciclo', async () => {
  const { engine } = await renderWithEngine(<WorkoutScreen onRun={() => {}} />, { profile: { currentWeek: 24 } });
  await userEvent.click(screen.getByRole('button', { name: 'Settimana successiva' }));
  expect(screen.getByText(/Inizia un nuovo ciclo/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Inizia il ciclo 2/ }));
  await waitFor(() => expect(engine.rows<Profile>('profile')[0]).toMatchObject({ currentCycle: 2, currentWeek: 1 }));
});

test('un carico arrivato dopo l\'apertura non viene cancellato scrivendo le ripetizioni', async () => {
  const { engine } = await renderWithEngine(<WorkoutScreen onRun={() => {}} />);
  await act(() => engine.write('set_logs', { day: 'push', exerciseId: 'inc', cycle: 1, week: 1, kg: 50, reps: '' }));
  const c = card('Panca inclinata manubri');
  expect(within(c).getByLabelText('Carico (kg)')).toHaveValue('50');
  await userEvent.type(within(c).getByLabelText('Ripetizioni'), '8,8,8');
  await waitFor(() => {
    const log = engine.rows<SetLog>('set_logs').find((l) => l.exerciseId === 'inc' && l.day === 'push')!;
    expect(log).toMatchObject({ kg: 50, reps: '8,8,8' });
  });
});

test('il quinto giorno porta alla corsa', async () => {
  const onRun = vi.fn();
  await renderWithEngine(<WorkoutScreen onRun={onRun} />);
  await userEvent.click(screen.getByRole('tab', { name: /Corsa/ }));
  expect(onRun).toHaveBeenCalled();
});
