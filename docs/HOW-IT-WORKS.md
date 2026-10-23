# How it works

A plain-English tour of the code, for when you want to change something.

## The big picture

```
 Phone app (Expo)  ──────►  Supabase  ◄──────  Admin website (Next.js)
   players                 database,             moderators +
                           sign-in,              store owners
                           photos,
                           live chat
                              ▲
                              │ once, on demand
                       Google Places API
```

The phone app talks **directly** to the database. That's safe because every table has **Row Level Security** rules in `supabase/migrations/...init.sql`. The database itself decides who may see or change each row. For example, the `reviews` table lets you *add* a review but has no rule letting anyone *read* reviews, so only the admin site (which uses the secret service key) can see them.

## Where things live

| I want to change... | Look in |
| --- | --- |
| Who shows up in the swipe deck | `discover()` function in the migration |
| What happens on a mutual like | `handle_swipe()` trigger in the migration |
| The "easy out" | `handle_screening()` trigger + `showScreening` in `apps/mobile/src/app/chat/[id].tsx` |
| Pod suggestions | `suggest_pods()` + `create_group_chat()` in the migration |
| Profile fields | `profiles` table + `apps/mobile/src/components/ProfileEditor.tsx` + `ProfileCard.tsx` |
| Format / platform lists | `mtg_format` / `online_platform` enums in SQL **and** `apps/mobile/src/lib/constants.ts` |
| Tabs at the bottom of the app | `apps/mobile/src/app/(tabs)/_layout.tsx` |
| Colors | `apps/mobile/src/lib/theme.ts` and `apps/admin/src/app/globals.css` |

## Privacy decisions baked in

- **Birthdate** lives in `profile_private`, which only the owner can read. Everyone else sees an age range like `25-34`.
- **Location:** matching uses your LGS's location, not yours. Travel mode stores a location rounded to about 1 km, and other people only ever get a rounded distance in miles, never coordinates.
- **Online handles** (Discord name, Arena ID...) are only readable by someone you share an open chat with. Strangers can see *which* platforms you use, not your username.
- **No images in chat:** messages are a text column only, and the app strips image links.
- **Blocking** hides both people from each other everywhere and ends any shared chats.

## Adding a new format later

1. New migration: `alter type public.mtg_format add value 'premodern';`
2. Add it to `FORMATS` in `apps/mobile/src/lib/constants.ts` and in `apps/admin/src/app/store/page.tsx`.
