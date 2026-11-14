import { render, screen } from '@testing-library/react';
import { SyncBadge } from './SyncBadge';

test('mostra le modifiche da salvare', () => {
  render(<SyncBadge pending={3} online />);
  expect(screen.getByText('3 modifiche da salvare')).toBeInTheDocument();
});

test('offline dice che i dati sono sul telefono', () => {
  render(<SyncBadge pending={0} online={false} />);
  expect(screen.getByText('Offline: salvato sul telefono')).toBeInTheDocument();
});

test('tutto salvato', () => {
  render(<SyncBadge pending={0} online />);
  expect(screen.getByText('Salvato')).toBeInTheDocument();
});
