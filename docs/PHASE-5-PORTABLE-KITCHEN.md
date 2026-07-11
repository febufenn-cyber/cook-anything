# Phase 5 — Portable Kitchen

Phase 5 adds optional identity and conflict-safe kitchen synchronization without making an account a prerequisite for cooking.

## Status

- Anonymous local-first behavior remains the default.
- Cloud sync is disabled when public Supabase configuration is absent.
- No Supabase migration is applied by this repository change.
- No production auth provider, redirect URL, deletion worker or email template is configured.
- No Worker or VPS deployment is performed.
- Hosted companion execution remains disabled.
- Household membership and invitation controls are implemented; shared household editing is deliberately canary-gated.

## Product contract

1. Every kitchen edit commits to IndexedDB before a network request.
2. A sync outage never blocks pantry, cookbook, shopping, planning or Cook Mode.
3. Signing in does not upload or replace local data until the user chooses a migration strategy.
4. Recovery snapshots precede destructive migrations and conflict decisions.
5. Records synchronize independently rather than as one kitchen document.
6. Server revisions—not client clocks—govern conflicts.
7. Mutations are idempotent through server-side receipts.
8. Deletes use tombstones so offline devices cannot silently resurrect records.
9. Allergen and explicit-exclusion conflicts merge conservatively.
10. BYOK keys, auth tokens, hosted cookies, companion messages and photos are forbidden from sync payloads.

## Browser architecture

### Local kitchen database

`cook-anything-kitchen` remains the source used by the product UI. It stores:

- profile
- pantry
- saved recipes
- cook history
- shopping list
- meal plan

Each high-level local write commits first and then creates a durable mutation.

### Sync database

`cook-anything-sync` stores:

- mutation queue
- revision cache
- unresolved conflicts
- cursor/account/pause metadata
- temporary recovery snapshots

The queue survives refreshes, restarts and offline periods. Personal revisions use a stable local `personal:self` namespace before and after authentication, so introducing an account UUID cannot fork revision history.

### Synchronization sequence

```text
local IndexedDB write
  → durable mutation
  → compact superseded mutations
  → register or verify device
  → push idempotent batch
  → store acknowledgements or visible conflicts
  → pull records after server cursor
  → apply personal records without re-queuing
  → advance cursor
```

The client pushes before pulling. A conflicting mutation leaves the active queue only after the conflict is safely stored for review.

## Optional authentication

The browser uses Supabase Auth REST endpoints directly and adds no runtime package.

Supported entry points:

- Google OAuth with PKCE
- Apple OAuth with PKCE
- email magic link

The account callback route is `/account/`. Configure exact production and staging redirect URLs in Supabase before enabling public configuration.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PUBLIC_BROWSER_KEY
```

Legacy projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose a service-role credential through a `NEXT_PUBLIC_*` variable.

Access and refresh tokens remain browser-local account-session data. They are validated separately from kitchen payloads and never enter kitchen exports or synchronization records.

## Required migration order

Apply all migrations in this exact order:

1. `supabase/migrations/20260712_phase5_portable_kitchen.sql`
2. `supabase/migrations/20260712_phase5_sync_push_hardening.sql`
3. `supabase/migrations/20260712_phase5_migration_device_registration.sql`

The third migration permits the explicit “use this device” choice before ordinary first sync, while rejecting an ID owned by another account and preserving revocation for an existing device.

## Database boundary

The migrations create:

- profiles
- devices
- typed synchronization records
- mutation receipts
- households and memberships
- expiring single-use invitations
- account-deletion requests

Direct browser privileges on synchronized tables are revoked. Authenticated browser access is limited to RPCs that derive identity from `auth.uid()`:

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

Personal scope IDs are never trusted from the browser. Household writes require owner or editor membership; invitations require the owner role.

## Guest-to-account migration

After authentication, the account page shows local and cloud counts before any data moves.

### Merge

- Creates a 14-day local recovery snapshot.
- Queues the current local kitchen.
- Pushes local records and pulls cloud records.
- Combines independent records.
- Leaves true revision conflicts visible.

### Use this device

- Creates a recovery snapshot.
- Tombstones existing personal cloud records.
- Uploads the current browser kitchen.

### Use cloud kitchen

- Creates a recovery snapshot.
- Clears local kitchen stores.
- Pulls the cloud kitchen from cursor zero.

No strategy is selected automatically.

## Conflict behavior

- Pantry, shopping, saves and history conflict per record.
- Meal plans conflict per entry or slot.
- Delete-versus-edit is explicit.
- Profile conflicts offer a conservative merge that unions allergen exclusions and excluded ingredients.
- The user may review serialized local and cloud values before choosing.

## Devices

Each browser installation receives a random opaque device ID. The server stores a bounded device name and last-seen time. Users can revoke other devices. A revoked device cannot push, pull or perform a migration reset, even if it retains an otherwise valid auth session.

## Household foundation

Phase 5 includes:

- household creation
- owner/editor/viewer roles
- server-side membership enforcement
- email-bound, random, single-use, 48-hour invitations
- separate personal and household record scopes

Household records do not overwrite the selected personal kitchen. Shared pantry editing remains gated until personal sync passes a real staging canary. Personal history, safety preferences, API settings and companion content are not automatically shared.

## Export, recovery and deletion

### Cloud export

`export_cloud_kitchen` returns synchronized records the user is authorized to read. Authentication tokens, BYOK credentials and companion content are excluded.

### Recovery

Migration and conflict snapshots remain in local IndexedDB for approximately 14 days. Restoring a snapshot replaces the local kitchen and queues the restored records for later synchronization.

### Sign-out

Sign-out removes the browser account session and synchronization binding but keeps the local kitchen. A later account connection requires migration selection again.

### Account deletion

`request_account_deletion` records a request and revokes devices. Production enablement requires a trusted deletion worker or operator process that:

1. revalidates the request,
2. handles owned households,
3. deletes records and mutation receipts,
4. deletes the Supabase Auth user using trusted service-role authority,
5. records completion without retaining kitchen payloads.

The browser separately asks whether local data should remain.

## Service-worker boundary

The generic `/account/` shell may be cached, but requests containing OAuth codes, invitation tokens or auth errors are excluded. The service worker also excludes:

- `Authorization`
- `apikey`
- `x-api-key`
- `/api/*`
- companion routes and snapshots
- all cross-origin Supabase and BYOK traffic

## Staging procedure

1. Create a separate Supabase staging project.
2. Apply all three migrations in order.
3. Confirm direct table reads and writes fail for anon and authenticated roles.
4. Configure only the required Google, Apple and email providers.
5. Allow exact staging `/account/` redirect URLs.
6. Set the staging public URL and publishable key.
7. Create two users and at least three browser devices.
8. Test empty-cloud, empty-local and populated-both migrations.
9. Replay identical mutation IDs after simulating a lost response.
10. Edit the same records from two offline devices.
11. Exercise delete/edit, meal-slot and safety-profile conflicts.
12. Revoke an offline device, reconnect it and verify all sync operations fail.
13. Test invitation reuse, expiry, wrong email and removed membership.
14. Test cloud export and local recovery restore.
15. Run the deletion worker and verify record plus Auth removal.
16. Inspect logs to confirm tokens and payloads are not logged.
17. Repeat with a small opt-in canary before production.

## Production exit gate

Do not enable public cloud sync until all are true:

- all three SQL migrations are applied through controlled change management
- official redirect URLs are configured
- auth providers and email templates are reviewed
- cross-user and cross-household tests pass against a real project
- mutation replay and network-interruption tests pass
- a deletion worker exists and has been exercised
- database backup and restore procedures are documented
- edge rate limits and abuse alerts are configured
- privacy text identifies the actual processor and operator
- no service-role credential is present in browser output
- full Phase 1–5 CI remains green

## Deliberate limits

- No production Supabase project is configured by this commit.
- Public CI cannot perform a real provider integration test without a staging project.
- Account deletion remains pending until a trusted backend worker completes it.
- Household shared editing remains canary-gated.
- Kitchen payloads are not end-to-end encrypted.
- Hosted companion execution remains disabled and independent of kitchen sync.
