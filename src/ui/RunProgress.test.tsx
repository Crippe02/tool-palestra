import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithEngine } from './testUtils';
import { RunScreen } from './RunScreen';
import { ProgressScreen } from './ProgressScreen';
import type { RunLog } from '../domain/types';

test('senza corse propone 5 km', async () => {
  await renderWithEngine(<RunScreen today="2026-11-20" />);
  expect(screen.getByText(/5 km, passo tranquillo/)).toBeInTheDocument();
});

test('salva la corsa fatta', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await userEvent.click(screen.getByRole('button', { name: 'Ho fatto questa corsa' }));
  const dist = screen.getByLabelText('Distanza (km)');
  await userEvent.clear(dist);
  await userEvent.type(dist, '5');
  await userEvent.type(screen.getByLabelText('Tempo'), '27:40');
  await userEvent.click(screen.getByRole('button', { name: 'Salva corsa' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0]).toMatchObject({ type: 'corsa', distanceKm: 5, durationS: 1660, source: 'manual', date: '2026-11-20' }));
});

test('un tempo scritto male non si salva', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await userEvent.click(screen.getByRole('button', { name: 'Ho fatto questa corsa' }));
  await userEvent.type(screen.getByLabelText('Tempo'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'Salva corsa' }));
  expect(screen.getByText('Scrivi il tempo come 27:40')).toBeInTheDocument();
  expect(engine.rows('run_logs')).toHaveLength(0);
});

test('i progressi mostrano il corpo rispetto al punto di partenza', async () => {
  await renderWithEngine(<ProgressScreen onSetup={() => {}} />, {
    profile: { currentWeek: 6, baseline: { date: '2026-11-01', weightKg: 82, waistCm: null, chestCm: null, armCm: null, thighCm: null } },
    rows: { body_logs: [{ date: '2026-11-12', weightKg: 79.4, waistCm: null, chestCm: null, armCm: null, thighCm: null }] },
  });
  expect(screen.getByRole('heading', { name: 'Corpo' })).toBeInTheDocument();
  expect(screen.getByText('−3,2%')).toBeInTheDocument();
  expect(screen.getByText(/settimana 6\/24/i)).toBeInTheDocument();
});

test('toccando una riga si apre il grafico', async () => {
  await renderWithEngine(<ProgressScreen onSetup={() => {}} />, {
    profile: { baseline: { date: '2026-11-01', weightKg: 82, waistCm: null, chestCm: null, armCm: null, thighCm: null } },
    rows: { body_logs: [{ date: '2026-11-05', weightKg: 80.5, waistCm: null, chestCm: null, armCm: null, thighCm: null }, { date: '2026-11-12', weightKg: 79.4, waistCm: null, chestCm: null, armCm: null, thighCm: null }] },
  });
  await userEvent.click(screen.getByRole('button', { name: /Peso/ }));
  expect(screen.getByRole('img', { name: /Peso nel tempo/ })).toBeInTheDocument();
});

test('senza punto di partenza invita a impostarlo', async () => {
  await renderWithEngine(<ProgressScreen onSetup={() => {}} />);
  expect(screen.getByRole('button', { name: 'Imposta il punto di partenza' })).toBeInTheDocument();
});
