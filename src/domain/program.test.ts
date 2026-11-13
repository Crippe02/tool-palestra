import { parseScheme, DEFAULT_PROGRAM } from './program';

test('parseScheme legge serie e range di ripetizioni', () => {
  expect(parseScheme('3×6-8')).toEqual({ sets: 3, repMin: 6, repMax: 8 });
  expect(parseScheme('3x15')).toEqual({ sets: 3, repMin: 15, repMax: 15 });
  expect(parseScheme('4×10-15')).toEqual({ sets: 4, repMin: 10, repMax: 15 });
});

test('il giorno Legs attivo ha lo stacco rumeno dopo l\'hack squat', () => {
  const legs = DEFAULT_PROGRAM.filter((e) => e.day === 'legs' && e.active).sort((a, b) => a.position - b.position);
  expect(legs.map((e) => e.id)).toEqual(['hs', 'rdl', 'lp', 'le', 'lc', 'cal']);
});

test('nessun esercizio con hip thrust è attivo', () => {
  expect(DEFAULT_PROGRAM.some((e) => e.active && /hip thrust/i.test(e.name))).toBe(false);
});

test('leg press e leg extension scendono a 2 serie', () => {
  const lp = DEFAULT_PROGRAM.find((e) => e.day === 'legs' && e.id === 'lp')!;
  const le = DEFAULT_PROGRAM.find((e) => e.day === 'legs' && e.id === 'le')!;
  expect([lp.sets, le.sets]).toEqual([2, 2]);
});
