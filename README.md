# Adventure Foundry

Find your Magic: The Gathering playgroup. Swipe on players near your local game store (LGS) or online, match, chat, and schedule games. It's for friendship, playing and trading, not dating.

Launching first in **Kansas City**.

## What's in this repo

| Folder | What it is | Built with |
| --- | --- | --- |
| `apps/mobile` | The iPhone + Android app players use | Expo (React Native), Expo Router |
| `apps/admin` | Website for moderators and store owners | Next.js |
| `supabase/migrations` | The database: tables, privacy rules, matching logic | Postgres + PostGIS on Supabase |
| `supabase/functions/import-stores` | Pulls game stores from Google Maps | Supabase Edge Function |
| `supabase/tests` | Runs the main flows against a real Postgres | SQL |
| `docs/` | Setup guide, how it works, roadmap | |

## Features in v1

**Players (mobile app)**
- Sign in with Google, Apple or Discord. 18+ only, enforced by the database.
- Profile with name or handle, age range (never exact age), pronouns, bio, three photos (you, commander, playmat), favorite commander (searched from Scryfall), formats (ranked), WUBRG colors, power level, casual↔competitive, in-person / online / both with a "mostly online ↔ mostly in person" slider, online platforms + handles, weekly availability, Moxfield/Archidekt deck links.
- **Discover:** swipe in **Play** or **Trade** mode. In-person matching is centered on your favorite LGS with a 25-mile default radius. Online players match regardless of distance.
- **Travel mode:** match near where you are for 7 days. Others see "~3 mi away" instead of your store name. Your location is rounded to about 1 km before it leaves the phone.
- **Time zones:** every profile and chat shows their local time and "2 hrs ahead of you". Availability is converted to your time zone.
- **Matches:** mutual like = chat. Text only, no pictures. After the first message each person gets a **First impression check**: *Keep chatting* or *Easy out*, which quietly ends the chat.
- **Pods:** when you and two matches all matched each other, the app suggests a group chat.
- **Chat extras:** Discord handle copy, "Join our Discord" link, schedule a game, which opens Apple or Google Calendar.
- **Events tab:** store events with ★ Interested / ✓ Going counts. Going adds the event to your calendar.
- **Stores tab:** map of KC game stores. Set your LGS, get directions.
- **Safety:** block, report, selfie photo verification, hidden "would play again?" reviews that only admins see, and a "meet at your LGS" nudge.

**Store owners and admins (website)**
- Store portal: claim a Google-listed store or request a new one, then post events once verified.
- Admin: import stores from Google, add stores manually, verify or hide stores, approve claims, handle reports, ban users, review selfies, see hidden reviews.

## Getting started

See **[docs/SETUP.md](docs/SETUP.md)**. It walks through every account and key you need, all on free tiers.

## Legal

Adventure Foundry is unofficial Fan Content permitted under the [Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. Card data and images are provided by [Scryfall](https://scryfall.com).
