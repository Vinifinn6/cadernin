-- ==============================================================================
-- CADERNO EDITORIAL — SCHEMA COMPLETO DO BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- Como executar:
--   1. Abra o painel do seu projeto no Supabase.
--   2. No menu lateral, clique em "SQL Editor".
--   3. Clique em "New query", cole todo este arquivo e clique em "Run".
--
-- Arquitetura Single-User preparada para Supabase Auth:
--   - O app opera inicialmente sem tela de login, utilizando um único registro
--     fixo na tabela `user_profile` (UUID fixo abaixo).
--   - Todas as tabelas já têm Row Level Security (RLS) ativado com políticas
--     permissivas para uso pessoal.
--   - Ao acoplar Supabase Auth no futuro, basta adicionar a coluna `user_id`
--     referenciando `auth.users(id)` nas tabelas de domínio, remover a constraint
--     de UUID fixo em `user_profile` e substituir `using (true)` por
--     `using (auth.uid() = user_id)` nas políticas RLS marcadas abaixo.
-- ==============================================================================

create extension if not exists "pgcrypto";

-- ==============================================================================
-- FUNÇÃO AUXILIAR PARA ATUALIZAR `updated_at` AUTOMATICAMENTE
-- ==============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ==============================================================================
-- 1. USER_PROFILE (Registro único do estudante)
-- ==============================================================================
create table if not exists public.user_profile (
  -- ID fixo para modo single-user.
  -- FUTURO AUTH: remova o CHECK abaixo e referencie auth.users(id) on delete cascade.
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid
    constraint user_profile_singleton_id check (id = '00000000-0000-0000-0000-000000000001'::uuid),

  app_name text not null default 'Cadernin',
  display_name text not null default 'Estudante',
  subtitle text not null default 'Rumo à aprovação',
  avatar_url text,
  header_url text,
  theme_preference text not null default 'light'
    constraint user_profile_theme_check check (theme_preference in ('light', 'dark', 'system')),

  -- Pesos usados pelo motor de Prioridade Algorítmica
  priority_weights jsonb not null default '{
    "real_correct": 0,
    "error_attention": 0,
    "guess_1": 1.5,
    "guess_2": 2.5,
    "guess_3": 3.5,
    "error_gap": 4.0,
    "error_other": 1.0
  }'::jsonb,

  -- Meia-vida do decaimento temporal (em dias) e constante de suavização Bayesiana
  decay_half_life_days integer not null default 30
    constraint user_profile_decay_check check (decay_half_life_days > 0),
  smoothing_c numeric(6, 2) not null default 3
    constraint user_profile_smoothing_check check (smoothing_c >= 0),

  daily_goal_minutes integer not null default 240
    constraint user_profile_daily_goal_check check (daily_goal_minutes > 0),

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_user_profile_updated_at on public.user_profile;
create trigger trg_user_profile_updated_at
  before update on public.user_profile
  for each row execute function public.set_updated_at();

-- Insere o perfil único padrão se ainda não existir
insert into public.user_profile (id, app_name, display_name, subtitle, theme_preference)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Cadernin',
  'Estudante',
  'Caderno de Estudos',
  'light'
)
on conflict (id) do nothing;

-- ==============================================================================
-- 2. SUBJECTS (Matérias / Disciplinas)
-- ==============================================================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#5F7A61',
  icon_name text not null default 'BookOpen',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_subjects_sort_order on public.subjects (sort_order, name);

drop trigger if exists trg_subjects_updated_at on public.subjects;
create trigger trg_subjects_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 3. TOPICS (Assuntos dentro de cada matéria)
-- ==============================================================================
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  status text not null default 'not_started'
    constraint topics_status_check check (status in ('not_started', 'studying', 'mastered')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_topics_subject_sort on public.topics (subject_id, sort_order, name);
create index if not exists idx_topics_status on public.topics (status);

drop trigger if exists trg_topics_updated_at on public.topics;
create trigger trg_topics_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 4. SUBTOPICS (Subassuntos / Checklist granular do assunto)
-- ==============================================================================
create table if not exists public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_subtopics_topic_sort on public.subtopics (topic_id, sort_order, name);

drop trigger if exists trg_subtopics_updated_at on public.subtopics;
create trigger trg_subtopics_updated_at
  before update on public.subtopics
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 5. ENEM_SKILLS (Matriz de Referência do ENEM: Competências e Habilidades)
-- ==============================================================================
create table if not exists public.enem_skills (
  id uuid primary key default gen_random_uuid(),
  area text not null
    constraint enem_skills_area_check check (area in ('linguagens', 'humanas', 'natureza', 'matematica')),
  code text not null,         -- Ex: 'H1', 'H2' ... 'H30'
  competency text not null,   -- Ex: 'C1' ou descrição da competência de área
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint enem_skills_area_code_unique unique (area, code)
);

create index if not exists idx_enem_skills_area on public.enem_skills (area, code);

-- ==============================================================================
-- 6. EXERCISE_LOGS (Baterias e listas de exercícios)
-- ==============================================================================
create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete set null,

  total_questions integer not null
    constraint exercise_logs_total_check check (total_questions > 0),
  raw_correct integer not null default 0
    constraint exercise_logs_raw_correct_check check (raw_correct >= 0 and raw_correct <= total_questions),
  guesses_count integer not null default 0
    constraint exercise_logs_guesses_check check (guesses_count >= 0 and guesses_count <= raw_correct),

  error_gap_count integer not null default 0
    constraint exercise_logs_error_gap_check check (error_gap_count >= 0),
  error_attention_count integer not null default 0
    constraint exercise_logs_error_attention_check check (error_attention_count >= 0),
  error_other_count integer not null default 0
    constraint exercise_logs_error_other_check check (error_other_count >= 0),

  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint exercise_logs_errors_balance_check
    check (error_gap_count + error_attention_count + error_other_count <= total_questions - raw_correct)
);

create index if not exists idx_exercise_logs_date on public.exercise_logs (date desc);
create index if not exists idx_exercise_logs_subject_topic on public.exercise_logs (subject_id, topic_id);
create index if not exists idx_exercise_logs_topic_date on public.exercise_logs (topic_id, date desc);

drop trigger if exists trg_exercise_logs_updated_at on public.exercise_logs;
create trigger trg_exercise_logs_updated_at
  before update on public.exercise_logs
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 7. MOCK_EXAMS (Simulados completos ou parciais — Modo Expresso ou Raio-X)
-- ==============================================================================
create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null default current_date,
  mode text not null default 'express'
    constraint mock_exams_mode_check check (mode in ('express', 'xray')),
  tagging_mode text not null default 'topic'
    constraint mock_exams_tagging_mode_check check (tagging_mode in ('topic', 'enem_skill', 'both')),

  -- Acertos brutos por área (ex: 0 a 45 no ENEM)
  score_lc integer constraint mock_exams_score_lc_check check (score_lc is null or score_lc >= 0),
  score_ch integer constraint mock_exams_score_ch_check check (score_ch is null or score_ch >= 0),
  score_cn integer constraint mock_exams_score_cn_check check (score_cn is null or score_cn >= 0),
  score_mt integer constraint mock_exams_score_mt_check check (score_mt is null or score_mt >= 0),

  -- Notas TRI por área
  tri_lc numeric(6, 2) constraint mock_exams_tri_lc_check check (tri_lc is null or tri_lc >= 0),
  tri_ch numeric(6, 2) constraint mock_exams_tri_ch_check check (tri_ch is null or tri_ch >= 0),
  tri_cn numeric(6, 2) constraint mock_exams_tri_cn_check check (tri_cn is null or tri_cn >= 0),
  tri_mt numeric(6, 2) constraint mock_exams_tri_mt_check check (tri_mt is null or tri_mt >= 0),

  -- Redação (Total e Competências C1 a C5)
  essay_total integer constraint mock_exams_essay_total_check check (essay_total is null or (essay_total >= 0 and essay_total <= 1000)),
  essay_c1 integer constraint mock_exams_essay_c1_check check (essay_c1 is null or (essay_c1 >= 0 and essay_c1 <= 200)),
  essay_c2 integer constraint mock_exams_essay_c2_check check (essay_c2 is null or (essay_c2 >= 0 and essay_c2 <= 200)),
  essay_c3 integer constraint mock_exams_essay_c3_check check (essay_c3 is null or (essay_c3 >= 0 and essay_c3 <= 200)),
  essay_c4 integer constraint mock_exams_essay_c4_check check (essay_c4 is null or (essay_c4 >= 0 and essay_c4 <= 200)),
  essay_c5 integer constraint mock_exams_essay_c5_check check (essay_c5 is null or (essay_c5 >= 0 and essay_c5 <= 200)),

  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mock_exams_date on public.mock_exams (date desc);

drop trigger if exists trg_mock_exams_updated_at on public.mock_exams;
create trigger trg_mock_exams_updated_at
  before update on public.mock_exams
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 8. MOCK_QUESTIONS (Gabarito detalhado questão a questão — Modo Raio-X)
-- ==============================================================================
create table if not exists public.mock_questions (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references public.mock_exams(id) on delete cascade,
  question_number integer not null
    constraint mock_questions_number_check check (question_number > 0),
  area text not null
    constraint mock_questions_area_check check (area in ('linguagens', 'humanas', 'natureza', 'matematica')),

  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  enem_skill_id uuid references public.enem_skills(id) on delete set null,

  -- Classificação honesta do desempenho na questão
  outcome text not null
    constraint mock_questions_outcome_check check (
      outcome in (
        'real_correct',
        'guess_1',
        'guess_2',
        'guess_3',
        'error_gap',
        'error_attention',
        'error_other'
      )
    ),
  error_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint mock_questions_exam_number_unique unique (mock_exam_id, question_number)
);

create index if not exists idx_mock_questions_exam on public.mock_questions (mock_exam_id, question_number);
create index if not exists idx_mock_questions_topic on public.mock_questions (topic_id);
create index if not exists idx_mock_questions_skill on public.mock_questions (enem_skill_id);
create index if not exists idx_mock_questions_outcome on public.mock_questions (outcome);

drop trigger if exists trg_mock_questions_updated_at on public.mock_questions;
create trigger trg_mock_questions_updated_at
  before update on public.mock_questions
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 9. STUDY_SESSIONS (Sessões de estudo — Cronômetro/Pomodoro ou Manual)
-- ==============================================================================
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  duration_minutes integer not null
    constraint study_sessions_duration_check check (duration_minutes > 0),
  source text not null default 'timer'
    constraint study_sessions_source_check check (source in ('timer', 'manual')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_study_sessions_date on public.study_sessions (date desc);
create index if not exists idx_study_sessions_subject on public.study_sessions (subject_id, date desc);

-- ==============================================================================
-- 10. WEEKLY_PLAN_ITEMS (Itens do Planejador Semanal)
-- ==============================================================================
create table if not exists public.weekly_plan_items (
  id uuid primary key default gen_random_uuid(),
  planned_date date not null default current_date,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_weekly_plan_items_date on public.weekly_plan_items (planned_date, is_completed);

drop trigger if exists trg_weekly_plan_items_updated_at on public.weekly_plan_items;
create trigger trg_weekly_plan_items_updated_at
  before update on public.weekly_plan_items
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) — MODO PESSOAL (SINGLE-USER)
-- ==============================================================================
-- IMPORTANTE (FUTURO SUPABASE AUTH):
--   Hoje todas as políticas abaixo permitem acesso amplo à chave `anon` para
--   que o app funcione sem login em uso pessoal.
--   Quando ativar autenticação:
--     1. Adicione `user_id uuid references auth.users(id) default auth.uid()`
--        nas tabelas de domínio (exceto `enem_skills`, que é catálogo global).
--     2. Troque `to anon, authenticated using (true) with check (true)` por
--        `to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
-- ==============================================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'user_profile',
    'subjects',
    'topics',
    'subtopics',
    'enem_skills',
    'exercise_logs',
    'mock_exams',
    'mock_questions',
    'study_sessions',
    'weekly_plan_items'
  ]
  loop
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop policy if exists "personal_full_access_%s" on public.%I;', tbl, tbl);
    execute format(
      'create policy "personal_full_access_%s" on public.%I for all to anon, authenticated using (true) with check (true);',
      tbl,
      tbl
    );
  end loop;
end;
$$;

-- ==============================================================================
-- SUPABASE STORAGE — BUCKET `profile-assets` (ECONOMIA EXTREMA: APENAS 2 ARQUIVOS)
-- ==============================================================================
-- Apenas `avatar.webp` e `header.webp` podem ser armazenados neste bucket,
-- sempre com upsert: true para sobrescrever e nunca acumular lixo no Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-assets',
  'profile-assets',
  true,
  524288, -- Trava de 512 KB no servidor (o cliente já comprime para < 200 KB)
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública das 2 imagens de perfil
drop policy if exists "profile_assets_public_read" on storage.objects;
create policy "profile_assets_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile-assets');

-- Upload (INSERT) restrito estritamente a `avatar.webp` e `header.webp`
-- FUTURO AUTH: troque `to anon, authenticated` por `to authenticated` e restrinja por pasta `auth.uid()::text`.
drop policy if exists "profile_assets_personal_insert" on storage.objects;
create policy "profile_assets_personal_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'profile-assets'
    and name in ('avatar.webp', 'header.webp')
  );

-- Sobrescrita (UPDATE com upsert: true) restrita a `avatar.webp` e `header.webp`
drop policy if exists "profile_assets_personal_update" on storage.objects;
create policy "profile_assets_personal_update"
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'profile-assets'
    and name in ('avatar.webp', 'header.webp')
  )
  with check (
    bucket_id = 'profile-assets'
    and name in ('avatar.webp', 'header.webp')
  );

-- Remoção (DELETE) restrita a `avatar.webp` e `header.webp`
drop policy if exists "profile_assets_personal_delete" on storage.objects;
create policy "profile_assets_personal_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'profile-assets'
    and name in ('avatar.webp', 'header.webp')
  );
