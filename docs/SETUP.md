# Setup guide

Everything here starts on a free tier. Do the steps in order; each takes 5–20 minutes.

## 0. What you'll need to sign up for

| Service | Why | Cost to start |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, sign-in, photo storage, live chat | Free (pauses after 1 week of no activity on free tier) |
| [Google Cloud](https://console.cloud.google.com) | Google Maps store import, Android map, Google sign-in | Free monthly credit covers early use |
| [Discord Developer Portal](https://discord.com/developers/applications) | Discord sign-in | Free |
| [Apple Developer Program](https://developer.apple.com/programs/) | Apple sign-in + putting the app on the App Store | **$99/year** (needed before iPhone launch) |
| [Google Play Console](https://play.google.com/console) | Putting the app on Google Play | **$25 one time** |
| [Expo / EAS](https://expo.dev) | Builds the phone apps in the cloud (no Mac needed) | Free tier |
| [Vercel](https://vercel.com) | Hosts the admin website | Free |

You can build and test everything without the Apple and Google Play accounts. You only need them to publish.

## 1. Create the Supabase project

1. Create a project at supabase.com. Pick a US Central region if offered.
2. Install the CLI: `npm i -g supabase`, then `supabase login`.
3. From this repo's root: `supabase link --project-ref <your-project-ref>`
4. Push the database: `supabase db push`. This runs `supabase/migrations/*.sql`.
5. In **Project Settings → API**, copy the **Project URL**, **anon key** and **service_role key**. Keep the service role key secret.

## 2. Sign-in providers (Supabase → Authentication → Providers)

Add these **redirect URLs** under Authentication → URL Configuration:
- `adventurefoundry://auth/callback` (the phone app)
- `http://localhost:3000/auth/callback` and later `https://<your-admin-site>/auth/callback`

**Google:** Google Cloud → APIs & Services → Credentials → *Create OAuth client ID* (type: Web). Authorized redirect URI = the callback URL Supabase shows on the Google provider page. Paste the client ID and secret into Supabase.

**Discord:** Discord Developer Portal → New Application → OAuth2. Add the Supabase callback URL as a redirect. Paste the client ID and secret into Supabase.

**Apple:** needs the $99 Apple Developer account. Follow Supabase's "Login with Apple" guide. Add your bundle ID `com.adventurefoundry.app` to the Apple provider's *Client IDs*. Apple requires that any iPhone app offering Google/Discord sign-in also offers Apple, which is why it's included.

## 3. Google Maps (store import + Android map)

1. Google Cloud → enable **Places API (New)** and **Maps SDK for Android**.
2. Create **two API keys**:
   - *Places key*: restrict to Places API (New). Used only on the server.
   - *Android Maps key*: restrict to Maps SDK for Android and your app's package name.
3. Give the Places key to the store importer and deploy it:
   ```bash
   supabase secrets set GOOGLE_PLACES_API_KEY=<places key>
   supabase functions deploy import-stores
   ```
4. Set a **budget alert** in Google Cloud Billing (e.g. $5) so nothing surprises you.

iPhone uses Apple Maps, which needs no key.

## 4. Make yourself an admin

Sign in once (website or app), then in Supabase → SQL editor:
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

## 5. Run the admin website

```bash
cd apps/admin
cp .env.example .env.local   # fill in the three Supabase values
npm install
npm run dev                  # http://localhost:3000
```
Go to **Admin → Stores → Import Kansas City stores from Google**. Then hide any shops that don't run Magic and verify the ones you know.

To put it online: import the repo into Vercel, set **Root Directory** to `apps/admin`, and add the same three env vars.

## 6. Run the phone app

```bash
cd apps/mobile
cp .env.example .env         # Supabase URL + anon key, Android maps key, your Discord invite
npm install
npx expo start
```
Sign-in redirects and some native features need a **development build** rather than Expo Go:
```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # or ios
```
Install the build on your phone, then `npx expo start --dev-client`.

## 7. Tests

The database flows (matching, easy out, blocking, privacy rules) can be run against any local Postgres 15+ with PostGIS:
```bash
PGHOST=localhost PGUSER=postgres supabase/tests/run.sh
```

## 8. Before launch checklist

- [ ] Privacy policy and terms pages (required by both app stores for apps with accounts and user content)
- [ ] A support email that works (the app's "Delete account" points to it; Apple requires in-app account deletion, see roadmap)
- [ ] App Store "user-generated content" requirements: block ✓, report ✓, moderation ✓, published contact info
- [ ] Supabase: upgrade off the free tier before launch so the project doesn't pause
- [ ] Recruit a few KC stores to post their weekly events so the Events tab isn't empty on day one
