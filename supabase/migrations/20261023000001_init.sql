-- Adventure Foundry — initial schema
-- Postgres + PostGIS on Supabase. Every table has Row Level Security (RLS) on,
-- so the mobile app can talk to the database directly and only ever sees what
-- the policies below allow. The admin website uses the service role key, which
-- bypasses RLS, and must only ever run on the server.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.mtg_format as enum (
  'commander', 'standard', 'pauper', 'canadian_highlander', 'modern', 'pioneer',
  'legacy', 'vintage', 'cedh', 'draft_sealed', 'oathbreaker', 'brawl', 'cube', 'dandan'
);

create type public.online_platform as enum (
  'discord', 'spelltable', 'tabletop_simulator', 'mtg_arena', 'mtgo',
  'cockatrice', 'xmage', 'untap_gg'
);

create type public.play_mode as enum ('in_person', 'online', 'both');
create type public.power_level as enum ('casual', 'mid', 'high', 'cedh');
-- What someone is swiping for. 'play' covers 1v1 and pods; 'trade' is card trading.
create type public.match_intent as enum ('play', 'trade');
create type public.swipe_direction as enum ('like', 'pass');
create type public.store_status as enum ('unverified', 'pending', 'verified', 'hidden');
create type public.store_source as enum ('google_import', 'manual', 'self_signup');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.rsvp_status as enum ('interested', 'going');
create type public.conversation_kind as enum ('match', 'group');
-- The "easy out": after the first message each person decides to keep chatting or leave quietly.
create type public.screening_status as enum ('pending', 'keep', 'left');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.verification_status as enum ('none', 'pending', 'verified', 'rejected');

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  address text,
  city text,
  location extensions.geography(point, 4326) not null,
  phone text,
  website text,
  source public.store_source not null default 'google_import',
  status public.store_status not null default 'unverified',
  owner_id uuid references auth.users on delete set null,
  plays_magic boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_location_idx on public.stores using gist (location);
alter table public.stores enable row level security;

create policy "stores are public unless hidden" on public.stores
  for select using (status <> 'hidden' or public.is_admin());
create policy "owners update their store" on public.stores
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A store owner asking to manage a listing (or a brand-new store asking to be added).
create table public.store_claims (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- For new stores not yet in the table:
  proposed_name text,
  proposed_address text,
  contact_email text not null,
  contact_phone text,
  notes text,
  status public.claim_status not null default 'pending',
  reviewed_by uuid references auth.users,
  created_at timestamptz not null default now(),
  check (store_id is not null or proposed_name is not null)
);
alter table public.store_claims enable row level security;
create policy "users see their own claims" on public.store_claims
  for select using (user_id = auth.uid());
create policy "users file claims" on public.store_claims
  for insert with check (user_id = auth.uid() and status = 'pending');

-- Lat/lng helpers for the map (geography columns don't serialize nicely to JSON).
create function public.store_lat(s public.stores) returns double precision
language sql immutable as $$ select extensions.st_y(s.location::extensions.geometry) $$;
create function public.store_lng(s public.stores) returns double precision
language sql immutable as $$ select extensions.st_x(s.location::extensions.geometry) $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- Public profile: anything here can be seen by other signed-in users.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  -- Shown instead of display_name when true (e.g. go by your Discord name).
  use_handle_as_name boolean not null default false,
  handle text check (char_length(handle) <= 40),
  pronouns text check (char_length(pronouns) <= 30),
  bio text check (char_length(bio) <= 500),
  age_range text, -- '18-24', '25-34', ... filled in from profile_private.birthdate
  play_mode public.play_mode not null default 'both',
  -- Only meaningful for 'both': 0 = all online, 100 = all in person.
  in_person_weight smallint not null default 50 check (in_person_weight between 0 and 100),
  power_level public.power_level not null default 'casual',
  -- 1 = pure casual / social, 5 = tournament grinder
  competitiveness smallint not null default 2 check (competitiveness between 1 and 5),
  colors text[] not null default '{}' check (colors <@ array['W','U','B','R','G']),
  intents public.match_intent[] not null default '{play}',
  platforms public.online_platform[] not null default '{}',
  favorite_commander_name text,
  favorite_commander_scryfall_id uuid,
  favorite_commander_image text,
  -- Storage paths inside the 'profile-photos' bucket. Exactly three slots.
  photo_person text,
  photo_commander text,
  photo_playmat text,
  home_store_id uuid references public.stores on delete set null,
  timezone text not null default 'America/Chicago',
  search_radius_miles smallint not null default 25 check (search_radius_miles between 1 and 250),
  verification public.verification_status not null default 'none',
  is_banned boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Private profile fields: only the owner can read these.
create table public.profile_private (
  id uuid primary key references public.profiles on delete cascade,
  birthdate date not null,
  -- Set while traveling: matching uses this instead of the home store and
  -- others see "~3 mi away" instead of the store name.
  travel_location extensions.geography(point, 4326),
  travel_until timestamptz
);
alter table public.profile_private enable row level security;
create policy "owner reads private" on public.profile_private for select using (id = auth.uid());
create policy "owner inserts private" on public.profile_private for insert with check (id = auth.uid());
create policy "owner updates private" on public.profile_private for update using (id = auth.uid());

create function public.age_bracket(birthdate date) returns text
language sql immutable as $$
  select case
    when age < 25 then '18-24'
    when age < 35 then '25-34'
    when age < 45 then '35-44'
    when age < 55 then '45-54'
    else '55+'
  end
  from (select extract(year from age(birthdate))::int as age) a
$$;

-- Enforce 18+ and keep the public age range in sync.
create function public.handle_profile_private() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.birthdate > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to use Adventure Foundry';
  end if;
  update public.profiles set age_range = public.age_bracket(new.birthdate) where id = new.id;
  return new;
end $$;
create trigger profile_private_age before insert or update of birthdate on public.profile_private
  for each row execute function public.handle_profile_private();

create table public.profile_formats (
  profile_id uuid references public.profiles on delete cascade,
  format public.mtg_format not null,
  rank smallint not null default 1, -- 1 = favorite
  primary key (profile_id, format)
);
alter table public.profile_formats enable row level security;

create table public.profile_platforms (
  profile_id uuid references public.profiles on delete cascade,
  platform public.online_platform not null,
  -- Handles are only revealed to matches (see policy below).
  handle text check (char_length(handle) <= 60),
  primary key (profile_id, platform)
);
alter table public.profile_platforms enable row level security;

-- Weekly availability in the profile owner's own timezone.
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  check (end_minute > start_minute)
);
alter table public.availability enable row level security;

create table public.deck_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  label text check (char_length(label) <= 60),
  url text not null check (url ~* '^https://(www\.)?(moxfield\.com|archidekt\.com)/'),
  created_at timestamptz not null default now()
);
alter table public.deck_links enable row level security;

-- ---------------------------------------------------------------------------
-- Blocking (needed by most policies below)
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid references public.profiles on delete cascade,
  blocked_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "see own blocks" on public.blocks for select using (blocker_id = auth.uid());
create policy "block someone" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "unblock" on public.blocks for delete using (blocker_id = auth.uid());

-- True if either person has blocked the other.
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Profile visibility: you see yourself, and anyone not banned who you haven't
-- blocked (and who hasn't blocked you).
create policy "read visible profiles" on public.profiles for select using (
  id = auth.uid()
  or (auth.uid() is not null and not is_banned and onboarded and not public.is_blocked(auth.uid(), id))
);
create policy "create own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid());

-- Users can't promote themselves to verified or unban themselves.
create function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() and current_user = 'authenticated' then
    new.verification := case
      when tg_op = 'INSERT' then 'none'
      -- users may move none/rejected -> pending by submitting a selfie
      when new.verification = 'pending' and old.verification in ('none', 'rejected') then 'pending'
      else old.verification
    end;
    new.is_banned := case when tg_op = 'INSERT' then false else old.is_banned end;
    new.age_range := case when tg_op = 'INSERT' then null else old.age_range end;
  end if;
  -- Can't finish onboarding without a birthdate on file.
  if new.onboarded and new.age_range is null then
    raise exception 'Add your birthdate before finishing your profile';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

create policy "read formats" on public.profile_formats for select using (
  exists (select 1 from public.profiles p where p.id = profile_id)
);
create policy "manage own formats" on public.profile_formats for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "read availability" on public.availability for select using (
  exists (select 1 from public.profiles p where p.id = profile_id)
);
create policy "manage own availability" on public.availability for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "read deck links" on public.deck_links for select using (
  exists (select 1 from public.profiles p where p.id = profile_id)
);
create policy "manage own deck links" on public.deck_links for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Swipes, matches, conversations
-- ---------------------------------------------------------------------------

create table public.swipes (
  swiper_id uuid references public.profiles on delete cascade,
  swipee_id uuid references public.profiles on delete cascade,
  intent public.match_intent not null default 'play',
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, swipee_id, intent),
  check (swiper_id <> swipee_id)
);
alter table public.swipes enable row level security;
create policy "see own swipes" on public.swipes for select using (swiper_id = auth.uid());
create policy "swipe" on public.swipes for insert with check (swiper_id = auth.uid());

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  intent public.match_intent not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (user_a < user_b),
  unique (user_a, user_b, intent)
);
alter table public.matches enable row level security;
create policy "see own matches" on public.matches for select
  using (auth.uid() in (user_a, user_b));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  match_id uuid unique references public.matches on delete cascade,
  title text,
  created_by uuid references public.profiles on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create table public.conversation_members (
  conversation_id uuid references public.conversations on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  screening public.screening_status not null default 'pending',
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
alter table public.conversation_members enable row level security;

create function public.is_member(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and profile_id = auth.uid() and screening <> 'left'
  );
$$;

create policy "members see conversation" on public.conversations for select
  using (public.is_member(id));
create policy "members see members" on public.conversation_members for select
  using (public.is_member(conversation_id) or profile_id = auth.uid());
-- Only your own screening choice / read marker can be changed.
create policy "update own membership" on public.conversation_members for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Messages are text only — no image column on purpose (no pictures in chat).
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select
  using (public.is_member(conversation_id));
create policy "members send messages" on public.messages for insert with check (
  sender_id = auth.uid()
  and public.is_member(conversation_id)
  and not exists (select 1 from public.conversations c where c.id = conversation_id and c.closed_at is not null)
);

-- When someone takes the easy out, close a 1:1 chat for both sides.
create function public.handle_screening() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.screening = 'left' and old.screening <> 'left' then
    update public.conversations set closed_at = now()
      where id = new.conversation_id and kind = 'match';
    update public.matches m set ended_at = now()
      from public.conversations c
      where c.id = new.conversation_id and c.match_id = m.id;
  end if;
  return new;
end $$;
create trigger conversation_members_screening after update of screening on public.conversation_members
  for each row execute function public.handle_screening();

-- Platform handles are visible to yourself and to people you share an open chat with.
create function public.shares_conversation(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.conversation_members me
    join public.conversation_members them using (conversation_id)
    join public.conversations c on c.id = me.conversation_id
    where me.profile_id = auth.uid() and them.profile_id = other
      and me.screening <> 'left' and them.screening <> 'left' and c.closed_at is null
  );
$$;
-- Which platforms someone uses is public (profiles.platforms); the handle itself
-- is only visible to you and to people you share an open chat with.
create policy "read platform handles" on public.profile_platforms for select using (
  profile_id = auth.uid() or public.shares_conversation(profile_id)
);
create policy "manage own platforms" on public.profile_platforms for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Mutual like => match + 1:1 conversation.
create function public.handle_swipe() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := least(new.swiper_id, new.swipee_id);
  b uuid := greatest(new.swiper_id, new.swipee_id);
  new_match uuid;
  new_conv uuid;
begin
  if new.direction <> 'like' or public.is_blocked(new.swiper_id, new.swipee_id) then
    return new;
  end if;
  if exists (
    select 1 from public.swipes
    where swiper_id = new.swipee_id and swipee_id = new.swiper_id
      and intent = new.intent and direction = 'like'
  ) then
    insert into public.matches (user_a, user_b, intent) values (a, b, new.intent)
      on conflict do nothing returning id into new_match;
    if new_match is not null then
      insert into public.conversations (kind, match_id) values ('match', new_match)
        returning id into new_conv;
      insert into public.conversation_members (conversation_id, profile_id)
        values (new_conv, a), (new_conv, b);
    end if;
  end if;
  return new;
end $$;
create trigger swipes_match after insert on public.swipes
  for each row execute function public.handle_swipe();

-- Blocking ends any shared conversations.
create function public.handle_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversation_members cm set screening = 'left'
  where cm.profile_id = new.blocker_id
    and cm.conversation_id in (
      select conversation_id from public.conversation_members where profile_id = new.blocked_id
    );
  return new;
end $$;
create trigger blocks_end_chats after insert on public.blocks
  for each row execute function public.handle_block();

-- Group chats: create one with a list of people you've matched with.
create function public.create_group_chat(member_ids uuid[], chat_title text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  conv uuid;
  m uuid;
begin
  if array_length(member_ids, 1) is null or array_length(member_ids, 1) > 7 then
    raise exception 'Group chats hold 2 to 8 people';
  end if;
  foreach m in array member_ids loop
    if not exists (
      select 1 from public.matches
      where ended_at is null
        and ((user_a = auth.uid() and user_b = m) or (user_b = auth.uid() and user_a = m))
    ) then
      raise exception 'You can only add people you have matched with';
    end if;
  end loop;
  insert into public.conversations (kind, title, created_by)
    values ('group', chat_title, auth.uid()) returning id into conv;
  insert into public.conversation_members (conversation_id, profile_id, screening)
    select conv, x, 'keep' from unnest(array_append(member_ids, auth.uid())) as x;
  return conv;
end $$;

-- "You, Sam and Alex all matched each other — start a pod chat?"
-- Returns pairs of your matches who have also matched each other.
create function public.suggest_pods()
returns table (member_1 uuid, member_2 uuid)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when user_a = auth.uid() then user_b else user_a end as other
    from public.matches
    where ended_at is null and intent = 'play' and auth.uid() in (user_a, user_b)
  )
  select m.user_a, m.user_b
  from public.matches m
  where m.ended_at is null and m.intent = 'play'
    and m.user_a in (select other from mine)
    and m.user_b in (select other from mine)
  limit 10;
$$;

-- ---------------------------------------------------------------------------
-- Discovery feed
-- ---------------------------------------------------------------------------

-- Where a person "is" for matching: travel location if active, else home store.
create function public.anchor_point(pid uuid) returns extensions.geography
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select travel_location from public.profile_private
      where id = pid and travel_location is not null and (travel_until is null or travel_until > now())),
    (select s.location from public.profiles p join public.stores s on s.id = p.home_store_id where p.id = pid)
  );
$$;

create function public.is_traveling(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_private
    where id = pid and travel_location is not null and (travel_until is null or travel_until > now()));
$$;

-- Returns candidate profiles for the swipe deck. Never returns coordinates —
-- only a rounded distance, and only when the other person is traveling.
create function public.discover(p_intent public.match_intent default 'play', p_limit int default 20)
returns table (
  profile_id uuid,
  location_label text,     -- home store name, or '~3 mi away' when they are traveling
  distance_miles int,      -- rounded, null for online-only matches
  shared_formats public.mtg_format[]
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles;
  my_point extensions.geography;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or not me.onboarded then
    return;
  end if;
  my_point := public.anchor_point(me.id);

  return query
  with candidates as (
    select
      p.id,
      p.play_mode,
      s.name as store_name,
      public.is_traveling(p.id) as traveling,
      case when my_point is null then null
        else extensions.st_distance(my_point, public.anchor_point(p.id)) / 1609.34 end as miles,
      array(
        select f.format from public.profile_formats f
        where f.profile_id = p.id
          and f.format in (select f2.format from public.profile_formats f2 where f2.profile_id = me.id)
      ) as shared
    from public.profiles p
    left join public.stores s on s.id = p.home_store_id
    where p.id <> me.id
      and p.onboarded and not p.is_banned
      and p_intent = any (p.intents)
      and not public.is_blocked(me.id, p.id)
      and not exists (
        select 1 from public.swipes sw
        where sw.swiper_id = me.id and sw.swipee_id = p.id and sw.intent = p_intent
      )
  )
  select
    c.id,
    case
      when c.miles is not null and c.miles <= me.search_radius_miles and (me.play_mode <> 'online' and c.play_mode <> 'online')
        then case when c.traveling then '~' || greatest(1, round(c.miles))::int || ' mi away'
                  else coalesce(c.store_name, 'Nearby') end
      else 'Online'
    end,
    case when c.miles is not null and c.miles <= me.search_radius_miles then greatest(1, round(c.miles))::int end,
    c.shared
  from candidates c
  where
    -- In-person overlap within radius...
    (me.play_mode <> 'online' and c.play_mode <> 'online'
      and c.miles is not null and c.miles <= me.search_radius_miles)
    -- ...or both open to online play (distance doesn't matter).
    or (me.play_mode <> 'in_person' and c.play_mode <> 'in_person')
  order by cardinality(c.shared) desc, c.miles asc nulls last
  limit p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text check (char_length(description) <= 2000),
  format public.mtg_format,
  is_online boolean not null default false,
  online_link text,
  entry_fee_cents int check (entry_fee_cents >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (store_id is not null or is_online)
);
create index events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;
create policy "events are public" on public.events for select using (true);
create policy "store owners manage events" on public.events for all using (
  public.is_admin() or exists (
    select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid() and s.status = 'verified'
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid() and s.status = 'verified'
  )
);

create table public.event_rsvps (
  event_id uuid references public.events on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  status public.rsvp_status not null,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_rsvps enable row level security;
create policy "rsvps are visible to signed-in users" on public.event_rsvps for select
  using (auth.uid() is not null);
create policy "manage own rsvp" on public.event_rsvps for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create view public.event_counts with (security_invoker = true) as
  select event_id,
    count(*) filter (where status = 'interested') as interested,
    count(*) filter (where status = 'going') as going
  from public.event_rsvps group by event_id;

-- ---------------------------------------------------------------------------
-- Safety: reports, hidden reviews, photo verification
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  reported_id uuid not null references public.profiles on delete cascade,
  conversation_id uuid references public.conversations on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'fake_profile', 'underage', 'no_show', 'cheating', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  admin_notes text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "file report" on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'open');
-- No select policy: reporters can't read reports back. Admins use the service role.

-- "Would you play with them again?" — never shown to users, only to admins.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles on delete cascade,
  reviewee_id uuid not null references public.profiles on delete cascade,
  would_play_again boolean not null,
  tags text[] not null default '{}',
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);
alter table public.reviews enable row level security;
create policy "leave review for a match" on public.reviews for insert with check (
  reviewer_id = auth.uid() and exists (
    select 1 from public.matches m
    where (m.user_a = auth.uid() and m.user_b = reviewee_id)
       or (m.user_b = auth.uid() and m.user_a = reviewee_id)
  )
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  selfie_path text not null,   -- in the private 'verification' bucket
  gesture text not null,       -- the pose we asked for, e.g. 'peace sign'
  status public.verification_status not null default 'pending',
  reviewed_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;
create policy "submit verification" on public.verifications for insert
  with check (profile_id = auth.uid() and status = 'pending');
create policy "see own verification" on public.verifications for select
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('profile-photos', 'profile-photos', true),
  ('verification', 'verification', false)
on conflict (id) do nothing;

-- Files live under '<user id>/...'
create policy "upload own profile photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own profile photos" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own profile photos" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own verification selfie" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime: push new messages to open chats
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
