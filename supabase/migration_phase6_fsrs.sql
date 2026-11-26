-- ==============================================================================
-- CADERNIN — MIGRAÇÃO FASE 6: REVISÕES ESPAÇADAS (FSRS / MODELO DSR)
-- ==============================================================================
-- SEGURA E NÃO-DESTRUTIVA:
--   - Não apaga tabelas nem sobrescreve dados já salvos.
--   - Pode ser executada quantas vezes quiser (idempotente).
--
-- Como executar:
--   1. Abra seu projeto no Supabase (https://supabase.com/dashboard).
--   2. Clique em "SQL Editor" -> "New query".
--   3. Cole todo este arquivo e clique em "Run".
-- ==============================================================================

-- 1. Campos de estado de memória (FSRS) na tabela `topics`
alter table public.topics
  add column if not exists fsrs_stability double precision not null default 0,
  add column if not exists fsrs_difficulty double precision not null default 0,
  add column if not exists fsrs_elapsed_days integer not null default 0,
  add column if not exists fsrs_scheduled_days integer not null default 0,
  add column if not exists fsrs_reps integer not null default 0,
  add column if not exists fsrs_lapses integer not null default 0,
  add column if not exists fsrs_state smallint not null default 0,
  add column if not exists fsrs_due timestamptz null,
  add column if not exists fsrs_last_review timestamptz null;

create index if not exists idx_topics_fsrs_due on public.topics (fsrs_due);

-- 2. Preferências de calibragem de revisões na tabela `user_profile`
alter table public.user_profile
  add column if not exists fsrs_target_retention numeric(4, 3) not null default 0.86,
  add column if not exists auto_mode_urgency_weight numeric(4, 3) not null default 0.65;

-- 3. Tabela de histórico de revisões (`fsrs_review_logs`)
create table if not exists public.fsrs_review_logs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  reviewed_at timestamptz not null default timezone('utc', now()),
  rating smallint not null
    constraint fsrs_review_logs_rating_check check (rating between 1 and 4),
  source text not null default 'exercise'
    constraint fsrs_review_logs_source_check check (source in ('exercise', 'mock', 'manual')),
  real_accuracy numeric(5, 4) null
    constraint fsrs_review_logs_accuracy_check check (real_accuracy is null or (real_accuracy >= 0 and real_accuracy <= 1)),
  stability_after double precision not null default 0,
  difficulty_after double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fsrs_review_logs_topic_date
  on public.fsrs_review_logs (topic_id, reviewed_at desc);

-- 4. Row Level Security (mesmo padrão permissivo do modo single-user atual)
-- FUTURO AUTH: troque `to anon, authenticated using (true) with check (true)`
-- por políticas vinculadas a `auth.uid()`.
alter table public.fsrs_review_logs enable row level security;

drop policy if exists "personal_full_access_fsrs_review_logs" on public.fsrs_review_logs;
create policy "personal_full_access_fsrs_review_logs"
  on public.fsrs_review_logs
  for all
  to anon, authenticated
  using (true)
  with check (true);
