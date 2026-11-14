import { render, screen } from '@testing-library/react';
import { InstallHint } from './InstallHint';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

test('su iPhone non installata mostra come aggiungerla alla Home', () => {
  render(<InstallHint standalone={false} userAgent={IPHONE} />);
  expect(screen.getByText('Aggiungi alla schermata Home')).toBeInTheDocument();
  expect(screen.getByText(/Così i dati non rischiano di essere cancellati/)).toBeInTheDocument();
});

test('già installata non mostra niente', () => {
  const { container } = render(<InstallHint standalone userAgent={IPHONE} />);
  expect(container).toBeEmptyDOMElement();
});
