import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Login } from './Login';

function fakeClient(error: { message: string } | null) {
  const signInWithPassword = vi.fn(async () => ({ data: {}, error }));
  return { client: { auth: { signInWithPassword } } as unknown as SupabaseClient, signInWithPassword };
}

test('entra con email e password', async () => {
  const { client, signInWithPassword } = fakeClient(null);
  render(<Login client={client} />);
  await userEvent.type(screen.getByLabelText('Email'), ' io@example.com ');
  await userEvent.type(screen.getByLabelText('Password'), 'segreta123');
  await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
  expect(signInWithPassword).toHaveBeenCalledWith({ email: 'io@example.com', password: 'segreta123' });
});

test('credenziali sbagliate mostrano un messaggio', async () => {
  const { client } = fakeClient({ message: 'Invalid login credentials' });
  render(<Login client={client} />);
  await userEvent.type(screen.getByLabelText('Email'), 'io@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'sbagliata');
  await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
  await waitFor(() => expect(screen.getByText('Email o password sbagliate.')).toBeInTheDocument());
});
