# Community Guides

A community library, step-by-step reader and publishing editor for No Vibe No Code. The module owns its UI, API and schema; the host supplies account authentication, D1, R2 and the shared animated Guides shell.

## Develop locally

Use Node 24 or newer. No dependencies or production credentials are needed for this preview:

```sh
npm run dev
```

Open `http://127.0.0.1:8798/community/`. The top bar switches between author, reader, staff and guest. The preview starts with three clearly local example guides. Its database and images exist only in memory and disappear when it stops. It listens on localhost only. Do not deploy the `demo/` server.

Run the focused checks with `npm test` and `npm run check`. They complete in seconds. The host repository has the complete browser test and Cloudflare integration checks.

## Product behavior

- Everyone can browse, search, filter and read published guides.
- Existing club accounts can write guides or import Markdown. Private drafts autosave after a short pause and before internal navigation. A failed save keeps the editor open; Export preserves the text as a Markdown file.
- Every step has a title, instructions, optional copyable AI prompt, difficulty and screenshots. Markdown allows paragraphs, headings, lists, bold, emphasis, links and code. Raw HTML stays text. Upload images through the editor rather than embedding external image URLs.
- Publishing makes a snapshot available immediately. Later draft edits remain private until published again. Authors can unpublish, archive or restore their own work.
- Staff can hide or restore contributions with an explanation. An author cannot bypass a staff hide by publishing again.
- Completion is tied to the signed-in account and stable step IDs. Community progress does not affect the official collection percentage.
- The latest five published text revisions are retained. Old revision screenshots are not guaranteed after they are removed from both the current draft and published guide.

Limits: 50 guides per account, 32 steps per guide, eight screenshots per step, 150 KB of guide text, 5 MB per image, 25 MB and 50 images per guide, 100 MB of images per account. Images must be PNG, JPEG or WebP, with at most 8192 pixels per side and 24 megapixels. The shared library caps at 10,000 guides and 2 GB of images. Unreferenced images become eligible for cleanup after 24 hours. Pending uploads count toward quotas; failed R2 deletion keeps its reservation until retry succeeds.

## Integration contract

`createCommunityApi(auth)` in `server/api.js` handles `/api/community/*` and returns `null` for unrelated routes. Inject `currentUser`, `readCookie`, `csrfValid`, `cookie` and `withinRateLimit`. Users must have `id`, `display_name`, `public_slug`, `role`, `status` and `auth_version`; sessions require `id`, `user_id`, `expires_at`. Bind `env.DB` and `env.COMMUNITY_FILES`.

The host applies `migrations/0001_community.sql` as its next ordered migration and calls `cleanupCommunity(env)` from its existing scheduled job. Migration files are immutable after release; add new migrations and copy them into the host migration sequence. An integration check verifies that the initial copies match.

Bundle `web/community.js` as an IIFE and define `__COMMUNITY_REPO__` to the public contribution URL. The normal API origin is `https://novibenocode.ccwu.cc/api/community`. The local demo alone defines `__COMMUNITY_API__` to its localhost API. Load `web/community.css` after the host styles.

The host creates a `[data-community-root]` inside `.scene-content`. Before revealing it, await `GuideCommunity.prepare(scene, href, signal)`; attach listeners with `GuideCommunity.mount(scene)` and call the returned disposer when leaving. Await `GuideCommunity.beforeLeave()` before navigation. The host provides `GuideScene.navigate()` and `GuideScene.replaceURL()`.

API writes require the exact signed-in account ID, CSRF and live session. Revision checks prevent lost updates; SQL checks revalidate session and image state at commit. Only the exact Guides origin has credentialed cross-origin access. Private data and media use `no-store`; content and arbitrary uploaded HTML are never executed.

## Source layout

- `web/`: library, editor, reader, inert Markdown and responsive styles.
- `server/`: API and content validation, independent of the host framework.
- `migrations/`: feature schema.
- `tests/`: SQLite-backed behavior and boundary tests.
- `demo/`: standalone local preview with disposable accounts.

The requested destination is `NoVibeNoCode/community-guides`, mounted as `community/` in the host repository. Hosting setup is recorded in the host's `docs/community-guides.md`; do not assume the GitHub namespace is available until it has been verified.
