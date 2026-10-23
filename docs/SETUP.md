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

## 0.5 Get your computer ready

Commands in this guide (`npm ...`, `npx ...`, `git ...`) are typed into a **terminal** on your computer:
- **Mac:** press ⌘ Space, type **Terminal**, press Enter.
- **Windows:** Start menu, type **Terminal** (or **PowerShell**), press Enter.

Install these once:
1. **Node.js** (LTS version) from [nodejs.org](https://nodejs.org). This also installs `npm` and `npx`.
2. **Git** from [git-scm.com](https://git-scm.com/downloads). On a Mac, typing `git` in Terminal offers to install it.

Check they work by typing `node -v` and then `git --version`. Each should print a version number.

Download the code (one time):
```bash
git clone https://github.com/wynneste/adventure-foundry.git
cd adventure-foundry
```
`cd` means "go into this folder". Every command below assumes you start in this `adventure-foundry` folder. If you close the terminal, open a new one and run `cd adventure-foundry` again.

## 1. Create the Supabase project

1. Create a project at supabase.com. Pick a US Central region if offered.
2. Load the database. Use **either** option:
   - **Easiest:** in Supabase, open **SQL Editor → New query**. Paste the entire contents of `supabase/migrations/20261023000001_init.sql` and click **Run**.
   - **With the command line** (from the `adventure-foundry` folder). `npx` downloads the Supabase tool for you, so there's nothing to install:
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
     Your project ref is the random part of your project URL: `https://<project-ref>.supabase.co`.
3. In **Project Settings → API**, copy the **Project URL**, **anon key** and **service_role key**. Keep the service role key secret.

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
3. Give the Places key to the store importer and deploy it. Run these from the `adventure-foundry` folder. If you loaded the database through the SQL Editor, run `npx supabase login` and `npx supabase link --project-ref <your-project-ref>` first.
   ```bash
   npx supabase secrets set GOOGLE_PLACES_API_KEY=<places key>
   npx supabase functions deploy import-stores
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
cp .env.example .env         # Supabase URL + anon key, Android maps key (Discord invite is pre-filled)
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
