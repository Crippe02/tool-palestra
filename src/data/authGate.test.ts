import { authView } from './authGate';

test('sessione valida: app', () => {
  expect(authView({ session: true, rememberedUser: null, signedOut: false })).toBe('app');
});

test('offline con token scaduto ma già entrato su questo telefono: app', () => {
  expect(authView({ session: false, rememberedUser: 'u1', signedOut: false })).toBe('app');
  expect(authView({ session: undefined, rememberedUser: 'u1', signedOut: false })).toBe('app');
});

test('mai entrato: login', () => {
  expect(authView({ session: false, rememberedUser: null, signedOut: false })).toBe('login');
});

test('in attesa della sessione senza ricordo: caricamento', () => {
  expect(authView({ session: undefined, rememberedUser: null, signedOut: false })).toBe('loading');
});

test('uscito esplicitamente: login', () => {
  expect(authView({ session: false, rememberedUser: 'u1', signedOut: true })).toBe('login');
});
