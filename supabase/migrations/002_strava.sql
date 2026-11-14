-- Tool Palestra: corsa continua e collegamento a Strava.

-- Le corse diventano tutte di tipo 'corsa' (i vecchi tipi restano ammessi per lo storico).
alter table public.run_logs drop constraint if exists run_logs_type_check;
alter table public.run_logs add constraint run_logs_type_check
  check (type in ('test','ripetute','ritmo','lungo','corsa'));

alter table public.run_logs
  add column start_time timestamptz,
  add column feeling text check (feeling in ('facile','giusta','dura')),
  add column best_5k_s int,
  add column best_10k_s int,
  add column hidden boolean not null default false;

-- Token di Strava: li legge e scrive SOLO la Edge Function con la chiave di servizio.
-- RLS attiva e nessuna policy: gli utenti dell'app non possono né leggerli né scriverli.
create table public.strava_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  athlete_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.strava_tokens enable row level security;
revoke all on public.strava_tokens from anon, authenticated;
