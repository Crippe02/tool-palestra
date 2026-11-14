import { useState } from 'react';

const isStandalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

/** Su iPhone l'app va aggiunta alla Home, altrimenti Safari può cancellare i dati salvati. */
export function InstallHint({ standalone = isStandalone(), userAgent = navigator.userAgent }: { standalone?: boolean; userAgent?: string }) {
  const [closed, setClosed] = useState(false);
  if (standalone || closed || !/iPhone|iPad|iPod/.test(userAgent)) return null;
  return (
    <div className="card install-hint">
      <p>
        <b>Aggiungi alla schermata Home</b>: tocca Condividi → Aggiungi alla schermata Home.
        Così i dati non rischiano di essere cancellati.
      </p>
      <button className="btn secondary" onClick={() => setClosed(true)}>Ok</button>
    </div>
  );
}
