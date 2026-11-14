import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './data/supabaseClient';
import { LocalStore } from './data/localStore';
import { SyncEngine } from './data/sync';
import { createSupabaseRemote } from './data/supabaseRemote';
import { seedIfEmpty } from './data/seed';
import { SyncContext } from './data/store';
import { Login } from './ui/Login';
import { Shell } from './ui/Shell';
import { Screens } from './ui/Screens';

function useSession(client: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null | undefined>(client ? undefined : null);
  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [client]);
  return session;
}

function useEngine(client: SupabaseClient, enabled: boolean) {
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const e = new SyncEngine(await LocalStore.open(), createSupabaseRemote(client));
      await e.init();
      if (cancelled) return;
      setEngine(e);
      const sync = () => { void e.sync(); };
      const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      document.addEventListener('visibilitychange', onVisible);
      cleanup = () => {
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
        document.removeEventListener('visibilitychange', onVisible);
      };
      await e.sync();
      if (navigator.onLine) await seedIfEmpty(e);
    })();
    return () => { cancelled = true; cleanup(); };
  }, [client, enabled]);
  return engine;
}

function Header() {
  return <h1>Tool Palestra</h1>;
}

function Authenticated({ client }: { client: SupabaseClient }) {
  const engine = useEngine(client, true);
  if (!engine) return <div className="wrap"><Header /><p className="muted">Carico i dati…</p></div>;
  return (
    <SyncContext.Provider value={engine}>
      <Shell screens={(tab, go) => <Screens tab={tab} go={go} />} />
    </SyncContext.Provider>
  );
}

export default function App() {
  const session = useSession(supabase);
  if (!supabase) {
    return (
      <div className="wrap">
        <Header />
        <p className="card">Manca la configurazione di Supabase: segui <code>docs/setup-supabase.md</code>.</p>
      </div>
    );
  }
  if (session === undefined) return <div className="wrap"><Header /></div>;
  if (!session) return <div className="wrap"><Header /><Login client={supabase} /></div>;
  return <Authenticated client={supabase} />;
}
