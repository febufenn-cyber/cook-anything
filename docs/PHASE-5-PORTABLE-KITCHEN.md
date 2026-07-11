# Phase 5 — Portable Kitchen

Phase 5 adds optional identity and conflict-safe kitchen synchronization without making an account a prerequisite for cooking.

## Status

- Code complete on the Phase 5 stacked branch.
- Anonymous local-first behavior remains the default.
- Cloud sync remains disabled when public Supabase configuration is absent.
- No Supabase migration has been applied by this repository change.
- No production auth provider, redirect URL, deletion worker or email template has been configured.
- No Worker or VPS deployment is performed by this phase.
- Hosted companion execution remains disabled.

## Product contract

1. Every ordinary kitchen edit commits to IndexedDB before a network request.
2. An unavailable sync service never blocks pantry, cookbook, shopping, planning or Cook Mode.
3. Signing in does not upload or replace local data until the user chooses merge, use-local or use-cloud.
4. A recovery snapshot is created before a destructive migration or conflict decision.
5. Sync records are independent entities, not one giant kitchen document.
6. Server revisions, not client clocks, decide whether an edit is stale.
7. Mutations are idempotent through permanent mutation receipts.
8. Deletes are tombstones so offline devices cannot silently resurrect records.
9. Safety exclusions are conservatively unioned during profile conflict resolution.
10. BYOK keys, auth tokens, hosted cookies, companion messages and photos are forbidden from sync payloads.

## Browser architecture

### Local kitchen database

`cook-anything-kitchen` remains the source used by the product UI. Stores include:

- profile
- pantry
- saved recipes
- cook history
- shopping list
- meal plan

Each high-level local write now creates a durable mutation after the local transaction completes.

### Sync database

`cook-anything-sync` contains:

- `mutationQueue`
- `revisions`
- `conflicts`
- `meta`
- `recovery`

The queue survives refreshes, browser restarts and offline periods. Revisions use a stable `personal:self` namespace locally so authentication cannot fork revision history by introducing the account UUID.

### Synchronization sequence

```text
local IndexedDB write
  → durable mutation
  → compact superseded mutations
  → register/verify device
  → push idempotent batch
  → store conflicts or acknowledgements
  → pull records after server cursor
  → apply personal records without re-queuing
  → advance cursor
```

The implementation pushes before pulling so current offline work reaches the server before newer remote records are applied. A conflicting mutation is removed from the active queue only after the conflict is stored locally for review.

## Optional authentication

The browser uses Supabase Auth REST endpoints directly and adds no runtime dependency.

Supported entry points:

- Google OAuth with PKCE
- Apple OAuth with PKCE
- email magic link

The account route is `/account/`. Configure exact production and staging redirect URLs in Supabase Auth before enabling public configuration.

Browser configuration:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PUBLIC_BROWSER_KEY
```

A legacy anon key may be used through `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose a service-role key in any `NEXT_PUBLIC_*` variable.

Access and refresh tokens remain browser-local account-session data. They are validated separately from kitchen payloads and are never accepted by the synchronization record validator or exports.

## Supabase database boundary

Apply migrations in order:

1. `supabase/migrations/20260712_phase5_portable_kitchen.sql`
2. `supabase/migrations/20260712_phase5_sync_push_hardening.sql`

The migrations create:

- profiles
- devices
- typed sync records
- mutation receipts
- households and memberships
- expiring single-use invites
- account-deletion requests

Direct browser privileges on synchronized tables are revoked. The browser receives a narrow authenticated RPC surface:

- `register_sync_device`
- `sync_push`
- `sync_pull`
- `sync_kitchen_summary`
- `sync_reset_personal_scope`
- `list_sync_devices`
- `revoke_sync_device`
- `create_kitchen_household`
- `list_kitchen_households`
- `create_household_invite`
- `accept_household_invite`
- `export_cloud_kitchen`
- `request_account_deletion`

Every function derives identity from `auth.uid()`. Personal scope IDs are never trusted from the browser. Household writes require owner or editor membership; invitations require the owner role.

## Guest-to-account migration

After authentication, the account page displays local and cloud counts before data moves.

### Merge

- Creates a 14-day local recovery snapshot.
- Queues every current local record.
- Pushes local records and pulls cloud records.
- Independent records combine.
- Revision conflicts remain visible.

### Use this device

- Creates a recovery snapshot.
- Tombstones existing personal cloud records.
- Uploads the current browser kitchen.

### Use cloud kitchen

- Creates a recovery snapshot.
- Clears local kitchen stores.
- Pulls the account’s cloud records from cursor zero.

No strategy is selected automatically.

## Conflict behavior

- Pantry, shopping, saved recipes and history conflict per record.
- Meal-plan entries conflict per record/slot.
- Delete-versus-edit is explicit.
- Profile safety restrictions support a conservative merge that unions allergen exclusions and excluded ingredients.
- The user may keep local or cloud data after reviewing both serialized records.

Conflict resolution first stores a local recovery snapshot.

## Devices

Each browser installation receives an opaque random device ID. The service stores a user-selected/generated device name and last-seen time. Users can revoke other devices. A revoked device cannot push or pull even if it still has an otherwise valid auth session.

## Household foundation

Phase 5 includes:

- household creation
- owner/editor/viewer roles
- membership enforcement
- email-bound, random, single-use, 48-hour invitations
- separate personal and household record scopes

Household records are authorized and revision-tracked but are not applied over the selected personal kitchen. Shared pantry editing remains intentionally gated until personal synchronization completes a staged canary. This avoids releasing two conflict domains simultaneously.

Personal history, safety preferences, private notes, API settings and companion content are never automatically copied into household scope.

## Export, recovery and deletion

### Cloud export

`export_cloud_kitchen` returns synchronized records the current user is authorized to read. It contains no authentication tokens or BYOK credentials.

### Recovery

Migration and conflict snapshots are kept only in local IndexedDB and expire after approximately 14 days. Restoring one replaces the local kitchen and queues the restored records for review/synchronization.

### Sign-out

Sign-out removes:

- Supabase account tokens
- sync cursor
- revision cache
- mutation/conflict account binding

It keeps the local kitchen. Signing into an account again requires migration selection and recreates a full queue from the local snapshot.

### Account deletion

`request_account_deletion` records a deletion request and revokes devices. It does not claim immediate physical deletion of all provider backups. Production enablement requires a trusted deletion worker or operator process that:

1. revalidates pending requests,
2. removes household ownership or transfers/deletes households,
3. deletes synchronized records and receipts,
4. deletes the Supabase Auth user with service-role authority,
5. records completion without retaining kitchen payloads.

The browser separately asks whether local data should remain.

## Service-worker boundary

The service worker may cache the generic `/account/` shell but refuses requests containing OAuth codes, invite tokens or auth errors. It also excludes:

- `Authorization`
- `apikey`
- `x-api-key`
- `/api/*`
- companion snapshots/routes
- all cross-origin Supabase and BYOK requests

Auth responses, RPC responses and invitation URLs are therefore outside application caches.

## Staging procedure

1. Create a separate Supabase staging project.
2. Apply both Phase 5 migrations.
3. Confirm direct table reads/writes fail for anon and authenticated roles.
4. Configure Google/Apple/email providers as needed.
5. Allow only exact staging `/account/` redirect URLs.
6. Set staging public URL and publishable key.
7. Create two test users and three browsers/devices.
8. Test empty-cloud, empty-local and populated-both migrations.
9. Test lost push responses by replaying the same mutation ID.
10. Test edits from two offline devices.
11. Test delete-versus-edit and profile-safety conflicts.
12. Revoke one device while it is offline; reconnect and verify push/pull fail.
13. Test invitation reuse, expiry, wrong email and removed membership.
14. Test cloud export and local recovery restore.
15. Run the deletion worker and verify Auth plus record removal.
16. Inspect logs to confirm payloads and tokens are not logged.
17. Repeat with a small opt-in canary before production.

## Production exit gate

Do not enable public cloud sync until all are true:

- both SQL migrations applied to staging and production through controlled change management
- official redirect URLs configured
- email/OAuth providers configured and reviewed
- cross-user and cross-household authorization tests pass against a real project
- mutation replay and network-interruption tests pass
- deletion worker exists and is exercised
- backup/restore procedure is documented
- rate limits and abuse alerts are configured at the Supabase/project edge
- privacy text names the actual data processor/project owner
- no service-role credential exists in browser output or repository secrets exposed to clients
- full Phase 1–5 CI remains green

## Known deliberate limits

- No production Supabase project is configured by this commit.
- No real end-to-end Supabase test runs in public CI because no project secret is provided.
- Account deletion is a request until an operator/deletion worker completes it.
- Household membership is available, but shared household editing is canary-gated.
- Kitchen payloads are not end-to-end encrypted.
- Hosted companion execution is unrelated and remains disabled.
