-- Tool Palestra: schema iniziale. Ogni riga appartiene a un utente; RLS su tutte le tabelle.

create table public.exercises (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day text not null check (day in ('push','pull','legs','upper','lower')),
  id text not null,
  name text not null,
  sets int not null,
  rep_min int not null,
  rep_max int not null,
  start_kg numeric,
  kind text not null check (kind in ('compound','isolation')),
  position int not null,
  active boolean not null default true,
  is_new boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, day, id)
);

create table public.set_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day text not null,
  exercise_id text not null,
  cycle int not null,
  week int not null,
  kg numeric,
  reps text not null default '',
  updated_at timestamptz not null,
  primary key (user_id, day, exercise_id, cycle, week)
);

create table public.body_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  updated_at timestamptz not null,
  primary key (user_id, date)
);

create table public.run_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  type text not null check (type in ('test','ripetute','ritmo','lungo')),
  distance_km numeric not null,
  duration_s int not null,
  source text not null check (source in ('manual','strava')),
  external_id text,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table public.profile (
  user_id uuid not null default auth.uid() references auth.users on delete cascade primary key,
  id text not null default 'me',
  current_cycle int not null default 1,
  current_week int not null default 1,
  baseline jsonb,
  updated_at timestamptz not null
);

do $$
declare t text;
begin
  foreach t in array array['exercises','set_logs','body_logs','run_logs','profile'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "solo i miei dati" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index %I on public.%I (updated_at)', t || '_updated_at_idx', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
