-- Run once in a fresh Supabase project. No privileged key is used by the app.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 240),
  platform text not null check (platform in ('PC','PlayStation','Xbox','Nintendo Switch','Mobile')),
  created_at timestamptz not null default now()
);
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  game text not null check (char_length(btrim(game)) between 1 and 60),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint owned_clip_path check (
    storage_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.(mp4|webm|mov)$')
  )
);
create index clips_feed_idx on public.clips (created_at desc, id desc);
alter table public.profiles enable row level security;
alter table public.clips enable row level security;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.clips to authenticated;
revoke all on public.profiles, public.clips from anon;

create policy "Members can view profiles" on public.profiles for select to authenticated using (true);
create policy "Members create own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "Members update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Members can view clips" on public.clips for select to authenticated using (true);
create policy "Members publish owned uploads" on public.clips for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from storage.objects where bucket_id = 'gameplay-clips' and name = storage_path
  ));
create policy "Members delete own clips" on public.clips for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('gameplay-clips','gameplay-clips',false,52428800,
        array['video/mp4','video/webm','video/quicktime']);
create policy "Members read published or owned video" on storage.objects for select to authenticated
  using (bucket_id = 'gameplay-clips' and (
    split_part(name,'/',1) = (select auth.uid())::text or exists (
      select 1 from public.clips where storage_path = name
    )
  ));
create policy "Members upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'gameplay-clips' and split_part(name,'/',1) = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid())));
create policy "Members remove own uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'gameplay-clips' and split_part(name,'/',1) = (select auth.uid())::text);
commit;
