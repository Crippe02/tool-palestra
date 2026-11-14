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
    sync: vi.fn(async () => ({ imported: 0, more: false, connected: false })),
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
  const strava = fakeStrava({ sync: vi.fn(async () => ({ imported: 0, more: false, connected: true })) });
  await renderWithEngine(<RunScreen today="2026-11-20" clientId="123" />, { strava });
  await waitFor(() => expect(strava.sync).toHaveBeenCalled());
  expect(await screen.findByText(/Strava collegato/)).toBeInTheDocument();
});

test('Strava non raggiungibile: avviso e suggerimento ancora visibile', async () => {
  const strava = fakeStrava({ sync: vi.fn(async () => { throw new Error('offline'); }) });
  await renderWithEngine(<RunScreen today="2026-11-20" clientId="123" />, { strava });
  expect(await screen.findByText(/Non riesco a sentire Strava/)).toBeInTheDocument();
  expect(screen.getByText(/5 km, passo tranquillo/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scollega' })).toBeInTheDocument();
});

test('com\'è andata: il tocco salva il feeling', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-14" clientId="123" />, { rows: { run_logs: [corsa('2026-11-10', 5.0, 1800)] } });
  expect(screen.getByText(/com'è andata/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'giusta' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0].feeling).toBe('giusta'));
  expect(screen.queryByText(/com'è andata/i)).toBeNull();
});

test("com'è andata chiede solo dell'ultima corsa", async () => {
  await renderWithEngine(<RunScreen today="2026-11-14" clientId="123" />, {
    rows: { run_logs: [corsa('2026-11-05', 5.0, 1800), corsa('2026-11-12', 5.5, 1990, { feeling: 'facile' })] },
  });
  expect(screen.queryByText(/com'è andata/i)).toBeNull();
});

test('nascondere una corsa la toglie dal suggerimento', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-14" clientId="123" />, { rows: { run_logs: [corsa('2026-11-10', 5.0, 1800, { feeling: 'giusta' })] } });
  expect(screen.getByText(/5,5 km, passo tranquillo/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Nascondi/ }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0].hidden).toBe(true));
  expect(screen.getByText(/^5 km, passo tranquillo/)).toBeInTheDocument();
});

async function rispondi(km: string | null, tempo: string, feeling: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Ho corso' }));
  if (km != null) {
    const campo = screen.getByLabelText('Quanti km hai fatto?');
    await userEvent.clear(campo);
    await userEvent.type(campo, km);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  await userEvent.type(screen.getByLabelText('In quanto tempo?'), tempo);
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  await userEvent.click(screen.getByRole('button', { name: feeling }));
}

test('ho corso: quattro domande e la corsa è salvata', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await rispondi('6', '36:10', 'giusta');
  await userEvent.type(screen.getByLabelText('Tempo ai primi 5 km?'), '29:40');
  await userEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0]).toMatchObject({
    type: 'corsa', source: 'manual', date: '2026-11-20', distanceKm: 6, durationS: 2170, feeling: 'giusta', best5kS: 1780,
  }));
  expect(screen.getByText(/Fatto! Prossima corsa: 5,5 km/)).toBeInTheDocument();
});

test('ho corso: il tempo ai 5 km si può saltare', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await rispondi('6', '36:10', 'facile');
  await userEvent.click(screen.getByRole('button', { name: 'Salta' }));
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0]).toMatchObject({ distanceKm: 6, best5kS: null, feeling: 'facile' }));
});

test('ho corso: sotto i 5 km niente domanda sui 5 km', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await rispondi('4', '25:00', 'dura');
  await waitFor(() => expect(engine.rows<RunLog>('run_logs')[0]).toMatchObject({ distanceKm: 4, durationS: 1500, feeling: 'dura' }));
  expect(screen.queryByLabelText('Tempo ai primi 5 km?')).toBeNull();
});

test('ho corso: un tempo scritto male non va avanti', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await userEvent.click(screen.getByRole('button', { name: 'Ho corso' }));
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  await userEvent.type(screen.getByLabelText('In quanto tempo?'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  expect(screen.getByText('Scrivi il tempo come 27:40')).toBeInTheDocument();
  expect(screen.getByLabelText('In quanto tempo?')).toBeInTheDocument();
  expect(engine.rows('run_logs')).toHaveLength(0);
});

test('ho corso: i 5 km non possono essere più lenti del totale', async () => {
  const { engine } = await renderWithEngine(<RunScreen today="2026-11-20" />);
  await rispondi('6', '36:10', 'giusta');
  await userEvent.type(screen.getByLabelText('Tempo ai primi 5 km?'), '40:00');
  await userEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(screen.getByText('Il tempo ai 5 km deve essere minore del tempo totale')).toBeInTheDocument();
  expect(engine.rows('run_logs')).toHaveLength(0);
});

test('senza Strava configurato il riquadro Strava non compare', async () => {
  const strava = fakeStrava();
  await renderWithEngine(<RunScreen today="2026-11-20" clientId={null} />, { strava });
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole('button', { name: 'Collega Strava' })).toBeNull();
  expect(strava.sync).not.toHaveBeenCalled();
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
