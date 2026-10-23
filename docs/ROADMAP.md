# Roadmap

## v1 (this repo)
Profiles, swiping (Play / Trade), matching, text chat with easy out, pod suggestions + group chats, store map, events with Interested/Going, online/in-person/both, travel mode, calendar add, block/report, selfie verification, hidden reviews, admin + store portal.

## Next up (v1.1, needed before App Store submission)
- **In-app account deletion** (Apple requirement): an edge function that deletes the auth user + storage files.
- **Push notifications** for new matches and messages (Expo Notifications + a database webhook).
- **Unread badges** using `conversation_members.last_read_at`.
- Privacy policy and terms pages on the admin site.

## v2
- **Pods as a first-class tab:** "Looking for 2 more for Commander Friday at 7", others join.
- **Trading:** have/want lists (Scryfall-backed) and matching on overlaps.
- Event comments and "who else is going" with mutual-match highlights.
- Store analytics for owners (views, RSVPs).
- Automated face match for verification.
- Expand beyond Kansas City: run the importer for new cities, add a city picker.

## Growth (ads / premium)
- *Premium:* see who liked you, more daily likes, multiple travel locations, profile boosts.
- *Stores:* featured events, promoted listing on the map.
- Keep Fan Content Policy in mind: no Wizards logos/trademarks in branding, keep the disclaimer, and don't sell card images.
