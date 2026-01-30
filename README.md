# Rota 190 PWA

Aplicativo PWA offline-first com modo de duelo online opcional via Supabase Realtime.

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

### Habilitar Realtime
No Supabase, em **Database > Replication** (ou Realtime), adicione `duel_rooms` na publication (ex.: `supabase_realtime`).

### RLS (politicas minimas)
Se RLS estiver ativo, use estas politicas basicas:
```sql
alter table public.duel_rooms enable row level security;

create policy "duel_select"
  on public.duel_rooms for select
  using (true);

create policy "duel_insert"
  on public.duel_rooms for insert
  with check (true);

create policy "duel_update"
  on public.duel_rooms for update
  using (true);
```

## Vercel (SPA rewrite)
O arquivo `vercel.json` garante que rotas como `/duelo` nao deem 404 no refresh.

## Teste manual (Host/Guest)
1. Host abre `/duelo`, gira a roleta e cria sala.
2. Guest abre `/duelo`, cola o codigo e entra.
3. Quando `status` virar `started`, ambos iniciam a partida.

Dica: no navegador, abra DevTools > Network > WS e confira que `realtime/v1` retorna status 101.
