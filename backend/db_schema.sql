-- Esquema de persistencia dominikito (Supabase / Postgres).
-- Pega este archivo en el SQL Editor de Supabase y dale Run.
-- Implementa los Contratos B (decisiones) de esquema-datos.md.

create table if not exists children (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  age         numeric not null,
  sex         text default '',
  created_at  timestamptz not null default now()
);

create table if not exists stories (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references children(id) on delete cascade,
  theme       text default '',
  created_at  timestamptz not null default now()
);

-- Contrato B: una fila por decisión del niño (lookup del polo pre-registrado, sin LLM).
create table if not exists decisions (
  id                   uuid primary key default gen_random_uuid(),
  child_id             uuid references children(id) on delete cascade,
  story_id             uuid references stories(id) on delete set null,
  dilemma_id           text,
  page                 int,
  dimension            text not null,
  subaxis              text,
  pole                 text not null,
  chosen_option_id     text,
  age_at_decision      numeric,
  developmental_stage  text,
  response_latency_ms  int,
  created_at           timestamptz not null default now()
);

create index if not exists idx_decisions_child_dim on decisions (child_id, dimension);
create index if not exists idx_stories_child on stories (child_id);

-- Nota: el backend usa la service_role key (bypassa RLS). Para un demo dejamos RLS deshabilitado.
-- En producción habría que activar RLS + políticas por familia/usuario.
