-- ============================================================================
-- Arevias — full Supabase schema. Idempotent: safe to run (and re-run) whole in
-- the Supabase SQL editor (Dashboard → SQL).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles (one row per auth user; holds personalization in `preferences`)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  handle        text unique,
  bio           text,
  avatar_url    text,
  preferences   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep `updated_at` fresh on every profile update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Avatars storage bucket (public read; users write only within their own folder)
-- ─────────────────────────────────────────────────────────────────────────
-- Images only, max 2 MB — stops the public bucket being used to host arbitrary
-- (or malicious) files under your domain.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true, 2097152,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert_own" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- Rate limiting for the AI endpoints
-- ─────────────────────────────────────────────────────────────────────────
-- Daily message counters, keyed by "<identifier>:<YYYY-MM-DD>" where identifier
-- is "user:<uuid>" (signed in) or "ip:<hash>" (anonymous). The day is embedded
-- in the key, so each day starts fresh and old rows simply go stale. Touched
-- only server-side via the service-role key — RLS on with no policies keeps
-- clients out entirely.
create table if not exists public.usage_limits (
  key         text primary key,
  count       integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.usage_limits enable row level security;

-- Atomic "add one for today, return the new total" — race-safe under concurrency.
create or replace function public.increment_usage(p_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.usage_limits (key, count, updated_at)
  values (p_key, 1, now())
  on conflict (key)
  do update set count = public.usage_limits.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end; $$;
