# Jogo do Concurseiro

by: Eldes Renato Cardoso da Silva Alvarenga

## Rodar local
```bash
npm install
npm run dev
```
Abra `http://localhost:5173`.

## Duelo online (Supabase)
### Variaveis de ambiente
Crie `.env` (na raiz) com:
```
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua anon key>
```
Para debug do duelo, use:
```
VITE_DEBUG_DUEL=1
```

### Schema necessario
Crie a tabela `duel_rooms` no Supabase (SQL Editor):
```sql
create table if not exists public.duel_rooms (
  code text primary key,
  host_id text not null,
  guest_id text,
  status text not null check (status in ('waiting','ready','started','ended')),
  config jsonb not null,
  state jsonb,
  version int not null default 0,
  winner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger duel_rooms_updated_at
before update on public.duel_rooms
for each row execute function public.touch_updated_at();
```

### Perfis e ranking diario
```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null,
  dob date,
  xp int not null default 0,
  crowns jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create table if not exists public.daily_xp (
  user_id uuid references public.profiles (id) on delete cascade,
  day date not null,
  xp int not null default 0,
  primary key (user_id, day)
);
```

### Overrides de questões (Admin)
Tabela usada para editar questões globalmente (propaga para todos).
```sql
create table if not exists public.question_overrides (
  id text primary key,
  patch jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create trigger question_overrides_updated_at
before update on public.question_overrides
for each row execute function public.touch_updated_at();
```

### Habilitar Realtime
No Supabase, em **Database > Replication** (ou Realtime), adicione `duel_rooms`, `question_overrides` e `question_customs` na publication (ex.: `supabase_realtime`).

### Quest?es customizadas (Admin)
```sql
create table if not exists public.question_customs (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create trigger question_customs_updated_at
before update on public.question_customs
for each row execute function public.touch_updated_at();
```

### RLS (politicas minimas)
Se RLS estiver ativo, use estas politicas basicas:
```sql
alter table public.duel_rooms enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_xp enable row level security;
alter table public.question_overrides enable row level security;
alter table public.question_customs enable row level security;

create policy "duel_select"
  on public.duel_rooms for select
  using (true);

create policy "duel_insert"
  on public.duel_rooms for insert
  with check (true);

create policy "duel_update"
  on public.duel_rooms for update
  using (true);

create policy "profiles_select"
  on public.profiles for select
  using (true);

create policy "profiles_insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "daily_xp_select"
  on public.daily_xp for select
  using (true);

create policy "daily_xp_upsert"
  on public.daily_xp for insert
  with check (auth.uid() = user_id);

create policy "daily_xp_update"
  on public.daily_xp for update
  using (auth.uid() = user_id);

create policy "question_overrides_select"
  on public.question_overrides for select
  using (true);

create policy "question_overrides_insert"
  on public.question_overrides for insert
  with check (auth.email() = 'eudesrenato2015@gmail.com');

create policy "question_overrides_update"
  on public.question_overrides for update
  using (auth.email() = 'eudesrenato2015@gmail.com');

create policy "question_overrides_delete"
  on public.question_overrides for delete
  using (auth.email() = 'eudesrenato2015@gmail.com');
```

## Vercel (SPA rewrite)
O arquivo `vercel.json` garante que rotas como `/duelo` nao deem 404 no refresh.

## Teste manual (Host/Guest)
1. Host abre `/duelo`, cria sala.
2. Guest abre `/duelo`, cola o codigo e entra.
3. Host clica em **Iniciar duelo**.
4. Ambos entram no jogo e a roleta passa a cada turno.

Dica: no navegador, abra DevTools > Network > WS e confira que `realtime/v1` retorna status 101.

## Deploy trigger

Deploy trigger: updated on 2026-01-31.

