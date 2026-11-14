export function SyncBadge({ pending, online }: { pending: number; online: boolean }) {
  let text = 'Salvato';
  let tone = 'ok';
  if (!online) { text = 'Offline: salvato sul telefono'; tone = 'warn'; }
  else if (pending > 0) { text = pending === 1 ? '1 modifica da salvare' : `${pending} modifiche da salvare`; tone = 'warn'; }
  return <div className={`sync-badge ${tone}`} role="status">{text}</div>;
}
