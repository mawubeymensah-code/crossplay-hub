# CrossPlay Hub

**Your game. Your community.** A Next.js and TypeScript foundation for sharing gameplay across platforms, with Supabase Auth, PostgreSQL profiles/clip metadata, and private Supabase Storage.

## Implemented

- Responsive community feed with game/title/username search and platform filtering.
- Email/password account creation, confirmation-aware sign-in, and sign-out.
- Editable gamer profiles with unique usernames, platform, and bio.
- MP4, WebM, and MOV uploads up to 50 MiB; generated user-owned storage paths.
- Clip publication after upload, with cleanup if database publication fails.
- Signed playback URLs for authenticated community members.
- PostgreSQL checks, foreign keys, feed indexing, and row-level security for profiles, clips, and private storage.
- Accessible loading, empty, error, success, and missing-configuration states.
- A read-only demo with fictional cards when Supabase is not configured. Demo cards contain no playable videos and never claim uploads succeeded.

## Run the demo

Node.js 24 and npm are required:

```bash
npm ci
npm run dev
```

Visit `http://localhost:3000`. Without environment variables you can search/filter the sample feed and inspect profile/upload explanations.

## Connect Supabase

1. Create a Supabase project. Use a **fresh project** for this migration; do not run it over existing tables/policies without reviewing them.
2. Run `supabase/migrations/202610140001_initial.sql` in the project's SQL editor. It creates the tables, private `gameplay-clips` bucket, size/MIME restrictions, and ownership policies in a transaction.
3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your project settings. A publishable key is designed for the browser; **never put a service-role or secret key in a `NEXT_PUBLIC_` variable**.
4. Configure Supabase Auth's site URL and allowed redirect URLs for localhost and your eventual HTTPS deployment. Keep email confirmation enabled. Configure email delivery for deployment.
5. Restart the app (public variables are embedded at build time), create an account, confirm your email, and sign in.
6. Save a profile, then upload a short permitted clip. A second signed-in user should see the clip but cannot modify the first user's profile or delete their video.

Use `npm run build` and `npm start` for a production server. This app uses browser-side Supabase Auth/data access; it does not implement server-rendered authenticated pages. Database/storage policies enforce authorization independently of the interface.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Tests cover validation/filtering, upload ordering and rollback, and PostgreSQL RLS using PGlite. The SQL suite emulates Supabase's `auth.uid()` and storage tables in a real PostgreSQL engine; it verifies cross-user profile/upload/delete denial, unpublished video privacy, publication, and anonymous denial. It **does not replace hosted Supabase integration testing**.

GitHub Actions runs these commands on push/PR once uploaded. The lockfile records the installed versions.

## Data model and authorization

| Resource | Read | Write |
| --- | --- | --- |
| Profiles | Authenticated members | Owner insert/update |
| Clip metadata | Authenticated members | Owner insert/delete |
| Private videos | Owner or authenticated members for published clips | Owner upload/delete within own folder |

Profile creation is explicit. A clip must reference an existing owned storage object and a profile. All sizes/types are also restricted at the storage bucket. No service-role key is needed. Signed URLs are bearer URLs; recipients can access them until expiry, so do not share them outside your intended audience.

## Scope and remaining work

The source implements the first product phase. **A live Supabase project has not been connected or tested.** Auth/email confirmation, hosted storage uploads, and live multi-user behavior still require that integration check. The feed shows the latest 40 clips; infinite pagination, moderation/reporting, account recovery/deletion, video transcoding, thumbnail generation, likes/comments, and FFmpeg highlight selection are not implemented. MOV playback depends on browser codecs. Refresh renews playback URLs after their one-hour expiry.

Before public launch, add content moderation, abuse controls, backup/retention policy, and live integration tests. No real community activity or usage metrics are claimed.

## Official references

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
