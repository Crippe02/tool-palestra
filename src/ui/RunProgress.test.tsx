import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithEngine } from './testUtils';
import { RunScreen } from './RunScreen';
import { ProgressScreen } from './ProgressScreen';
import type { RunLog } from '../domain/types';
import type { StravaApi } from '../data/strava';

function fakeStrava(over: Partial<StravaApi> = {}): StravaApi & { sync: ReturnType<typeof vi.fn> } {
  return {
    status: vi.fn(async () => ({ connected: false })),
    connect: vi.fn(async () => {}),
    sync: vi.fn(async () => ({ imported: 0, more: false })),
    disconnect: vi.fn(async () => {}),
    ...over,
  } as StravaApi & { sync: ReturnType<typeof vi.fn> };
}

const corsa = (date: string, km: number, timeS: number, extra: Partial<RunLog> = {}): Omit<RunLog, 'updatedAt'> => ({
  id: `strava-${date}`, date, type: 'corsa', distanceKm: km, durationS: timeS, source: 'strava', externalId: date,
  startTime: `${date}T07:00:00.000Z`, feeling: null, ...extra,
});

test('senza corse e senza Strava: 5 km e pulsante per collegare', async () => {
  await renderWithEngine(<RunScreen today="2026-11-20" clientId="123" />, { strava: fakeStrava() });
  expect(screen.getByText(/5 km, passo tranquillo/)).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Collega Strava' })).toBeInTheDocument();
});

test('collegato: aggiorna da Strava all\'apertura', async () => {
  const strava = fakeStrava({ status: vi.fn(async () => ({ connected: true })) });
  await renderWithEngine(<RunScreen today="2026-11-20" clientId="123" />, { strava });
  await waitFor(() => expect(strava.sync).toHaveBeenCalled());
  expect(await screen.findByText(/Strava collegato/)).toBeInTheDocument();
});

test('Strava non raggiungibile: avviso e suggerimento ancora visibile', async () => {
  const strava = fakeStrava({ status: vi.fn(async () => ({ connected: true })), sync: vi.fn(async () => { throw new Error('offline'); }) });
  await renderWithEngine(<RunScreen today="2026-11-20" clientId="123" />, { strava });
  expect(await screen.findByText(/Non riesco a sentire Strava/)).toBeInTheDocument();
  expect(screen.getByText(/5 km, passo tranquillo/)).toBeInTheDocument();
});

test('com\'è andata: il tocco salva il feeling', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-14" clientId="123" />, { rows: { run_logs: [corsa('2026-11-10', 5.0, 1800)] } });
  expect(screen.getByText(/com'è andata/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'giusta' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0].feeling).toBe('giusta'));
  expect(screen.queryByText(/com'è andata/i)).toBeNull();
});

test('nascondere una corsa la toglie dal suggerimento', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-14" clientId="123" />, { rows: { run_logs: [corsa('2026-11-10', 5.0, 1800, { feeling: 'giusta' })] } });
  expect(screen.getByText(/5,5 km, passo tranquillo/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Nascondi/ }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0].hidden).toBe(true));
  expect(screen.getByText(/^5 km, passo tranquillo/)).toBeInTheDocument();
});

test('salva la corsa fatta', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi una corsa a mano' }));
  const dist = screen.getByLabelText('Distanza (km)');
  await userEvent.clear(dist);
  await userEvent.type(dist, '5');
  await userEvent.type(screen.getByLabelText('Tempo'), '27:40');
  await userEvent.click(screen.getByRole('button', { name: 'Salva corsa' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0]).toMatchObject({ type: 'corsa', distanceKm: 5, durationS: 1660, source: 'manual', date: '2026-11-20' }));
});

test('un tempo scritto male non si salva', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi una corsa a mano' }));
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
