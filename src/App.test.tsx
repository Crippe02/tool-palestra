import { render, screen } from '@testing-library/react';
import App from './App';

test('mostra il titolo dell\'app', () => {
  render(<App />);
  expect(screen.getByText('Tool Palestra')).toBeInTheDocument();
});
