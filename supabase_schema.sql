-- Run this SQL in your Supabase project's SQL editor to set up minimal DM schema + RLS.

-- =========================
-- Profiles (public view of auth.users)
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone authenticated can read profiles (id + email) to resolve recipients.
do $$ begin
  create policy "Profiles are viewable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);
exception when duplicate_object then null; end $$;

-- Users can create their own profile.
do $$ begin
  create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
exception when duplicate_object then null; end $$;

-- Users can update their own profile.
do $$ begin
  create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid());
exception when duplicate_object then null; end $$;

-- =========================
-- Messages
-- =========================
create table if not exists public.messages (
  id bigserial primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

-- Index to speed up fetching a thread between two users ordered by time
create index if not exists idx_messages_participants_time
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

alter table public.messages enable row level security;

-- Only participants can read their own messages
do $$ begin
  create policy "Participants can read their messages"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
exception when duplicate_object then null; end $$;

-- Allow sending messages as yourself only
do $$ begin
  create policy "Authenticated users can send as themselves"
  on public.messages
  for insert
  to authenticated
  with check (sender_id = auth.uid());
exception when duplicate_object then null; end $$;
