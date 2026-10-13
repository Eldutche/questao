-- Rode este script no Supabase: SQL Editor > New query > Run

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  enunciado text not null,
  alternativas jsonb not null,          -- array de textos: ["A...", "B...", ...]
  correta int not null check (correta >= 0 and correta <= 4),
  disciplina text,
  banca text,
  ano int,
  comentario text,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  escolhida int not null,
  acertou boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_question_idx on public.attempts(question_id);
create index if not exists questions_user_idx on public.questions(user_id);

-- Segurança: cada usuário só enxerga e altera os próprios dados
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;

drop policy if exists "questions_own" on public.questions;
create policy "questions_own" on public.questions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "attempts_own" on public.attempts;
create policy "attempts_own" on public.attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
