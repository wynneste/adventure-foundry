-- Runs the main flows as real signed-in users (RLS enforced).
\set ON_ERROR_STOP on
\pset tuples_only on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d');
insert into public.stores (name, city, location) values
  ('Pawn & Pentacle', 'Kansas City', 'SRID=4326;POINT(-94.58 39.10)'),
  ('Far Away Games', 'Denver', 'SRID=4326;POINT(-104.99 39.74)');

create function pg_temp.expect(label text, actual bigint, expected bigint) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAILED %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end $$;

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false);
$$;

set role authenticated;

-- Each user builds a profile.
do $$
declare
  u text; n int := 0;
  kc uuid := (select id from public.stores where city = 'Kansas City');
  den uuid := (select id from public.stores where city = 'Denver');
begin
  foreach u in array array['a','b','c','d'] loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || u, false);
    insert into public.profiles (id, display_name, home_store_id, play_mode, verification, is_banned)
      values (auth.uid(), 'Player ' || u, case when u = 'd' then den else kc end,
              case when u = 'd' then 'in_person' else 'both' end::public.play_mode, 'verified', true);
    insert into public.profile_private (id, birthdate) values (auth.uid(), '1995-05-05');
    insert into public.profile_formats (profile_id, format) values (auth.uid(), 'commander');
    update public.profiles set onboarded = true where id = auth.uid();
  end loop;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('age range filled, verified/banned not self-settable', count(*), 1) from public.profiles
  where id = auth.uid() and age_range = '25-34' and verification = 'none' and not is_banned and onboarded;

-- Under 18 is rejected.
do $$ begin
  update public.profile_private set birthdate = current_date - interval '17 years' where id = auth.uid();
  raise exception 'underage birthdate was accepted';
exception when others then
  if sqlerrm like '%18 or older%' then raise notice 'ok: under-18 rejected'; else raise; end if;
end $$;

-- A can't see B's birthdate.
select pg_temp.expect('only own private row visible', count(*), 1) from public.profile_private;

-- Discovery: A (KC) sees B and C at the home store, D (Denver, in-person only) is out of range.
select pg_temp.expect('discover shows the 2 KC players', count(*), 2) from public.discover('play') d
  where d.location_label = 'Pawn & Pentacle';
select pg_temp.expect('discover hides out-of-range in-person player', count(*), 0) from public.discover('play') d
  where d.profile_id = '00000000-0000-0000-0000-00000000000d';

-- Mutual like => match + conversation.
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 'like');
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000c', 'like');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000a', 'like');
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000c', 'like');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000a', 'like');
insert into public.swipes (swiper_id, swipee_id, direction) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 'like');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('mutual likes create matches', count(*), 2) from public.matches;
select pg_temp.expect('pod suggested when all three matched', count(*), 1) from public.suggest_pods();

-- Chat, handles only visible once in a shared chat.
insert into public.profile_platforms values (auth.uid(), 'discord', 'player_a#1');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect('handles hidden from strangers', count(*), 0) from public.profile_platforms where profile_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('handles visible to matches', count(*), 1) from public.profile_platforms where profile_id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.messages (conversation_id, sender_id, body)
  select c.id, auth.uid(), 'Want to play Commander Friday?'
  from public.conversations c join public.matches m on m.id = c.match_id
  where '00000000-0000-0000-0000-00000000000b' in (m.user_a, m.user_b);

-- B takes the easy out: chat closes for both, A can no longer send.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.conversation_members set screening = 'left'
  where profile_id = auth.uid() and conversation_id in (
    select c.id from public.conversations c join public.matches m on m.id = c.match_id
    where '00000000-0000-0000-0000-00000000000a' in (m.user_a, m.user_b));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.messages (conversation_id, sender_id, body)
    select c.id, auth.uid(), 'hello?' from public.conversations c join public.matches m on m.id = c.match_id
    where '00000000-0000-0000-0000-00000000000b' in (m.user_a, m.user_b);
  raise exception 'message into closed chat was accepted';
exception when insufficient_privilege then raise notice 'ok: closed chat rejects messages';
end $$;

-- Group chat with C, then A blocks C and C disappears from A's world.
select pg_temp.expect('group chat created', count(*), 1) from (select public.create_group_chat(array['00000000-0000-0000-0000-00000000000c']::uuid[], 'Friday pod')) g;
insert into public.blocks values (auth.uid(), '00000000-0000-0000-0000-00000000000c');
select pg_temp.expect('blocked user disappears', count(*), 0) from public.profiles where id = '00000000-0000-0000-0000-00000000000c';

-- Hidden reviews: A can leave one for B (a past match) but can't read any back.
insert into public.reviews (reviewer_id, reviewee_id, would_play_again) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', true);
select pg_temp.expect('reviews are hidden from users', count(*), 0) from public.reviews;

-- Normal users can't create events for a store they don't own.
do $$ begin
  insert into public.events (store_id, title, starts_at) select id, 'Fake FNM', now() from public.stores limit 1;
  raise exception 'event insert by non-owner accepted';
exception when insufficient_privilege then raise notice 'ok: non-owner cannot post events';
end $$;
\echo ALL FLOWS PASSED
