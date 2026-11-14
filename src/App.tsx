import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './data/supabaseClient';
import { LocalStore } from './data/localStore';
import { SyncEngine } from './data/sync';
import { createSupabaseRemote } from './data/supabaseRemote';
import { seedIfEmpty } from './data/seed';
import { SyncContext } from './data/store';
import { authView, forgetUser, getRememberedUser, rememberUser } from './data/authGate';
import { Login } from './ui/Login';
import { Shell } from './ui/Shell';
import { Screens } from './ui/Screens';

function useAuth(client: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null | undefined>(client ? undefined : null);
  const [remembered, setRemembered] = useState<string | null>(() => getRememberedUser());
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    if (!client) return;
    const apply = (s: Session | null) => {
      setSession(s);
      if (s) { rememberUser(s.user.id); setRemembered(s.user.id); setSignedOut(false); }
    };
    client.auth.getSession().then(({ data }) => apply(data.session)).catch(() => setSession(null));
    const { data } = client.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') { forgetUser(); setRemembered(null); setSignedOut(true); }
      apply(s);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  return authView({ session: session === undefined ? undefined : session != null, rememberedUser: remembered, signedOut });
}

function useEngine(client: SupabaseClient) {
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const e = new SyncEngine(await LocalStore.open(), createSupabaseRemote(client));
      await e.init();
      if (cancelled) return;
      setEngine(e);
      const syncAndSeed = async () => {
        const { pulled } = await e.sync();
        await seedIfEmpty(e, pulled);
      };
      const sync = () => { void syncAndSeed(); };
      const onVisibility = () => {
        if (document.visibilityState === 'visible') sync();
        else void e.flush(); // uscendo dall'app si prova a inviare subito
      };
      const onHide = () => { void e.flush(); };
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      window.addEventListener('pagehide', onHide);
      document.addEventListener('visibilitychange', onVisibility);
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') sync();
      });
      cleanup = () => {
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onVisibility);
        data.subscription.unsubscribe();
      };
      await syncAndSeed();
    })();
    return () => { cancelled = true; cleanup(); };
  }, [client]);
  return engine;
}

function Header() {
  return <h1>Tool Palestra</h1>;
}

function Authenticated({ client }: { client: SupabaseClient }) {
  const engine = useEngine(client);
  if (!engine) return <div className="wrap"><Header /><p className="muted">Carico i dati…</p></div>;
  return (
    <SyncContext.Provider value={engine}>
      <Shell screens={(tab, go) => <Screens tab={tab} go={go} />} />
    </SyncContext.Provider>
  );
}

export default function App() {
  const view = useAuth(supabase);
  if (!supabase) {
    return (
      <div className="wrap">
        <Header />
        <p className="card">Manca la configurazione di Supabase: segui <code>docs/setup-supabase.md</code>.</p>
      </div>
    );
  }
  if (view === 'loading') return <div className="wrap"><Header /></div>;
  if (view === 'login') return <div className="wrap"><Header /><Login client={supabase} /></div>;
  return <Authenticated client={supabase} />;
}
