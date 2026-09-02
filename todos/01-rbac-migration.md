# TODO: Migrate to Standard Supabase RBAC

> **Reference**: [Supabase Custom Claims & RBAC Guide](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)

---

## Overview

Migrate from the current ad-hoc role system to Supabase's standard RBAC pattern:

|                            | Current                                     | Target                                                   |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Where roles live**       | `app_metadata.role` (set via admin API)     | `user_roles` table + injected into JWT via Auth Hook     |
| **Where permissions live** | Hardcoded in `types/permissions.ts`         | `role_permissions` table in database                     |
| **Server enforcement**     | Manual `if (isAdmin)` in each edge function | RLS policies on every table + `authorize()` SQL function |
| **Client enforcement**     | `authStore.isAdmin` reads `app_metadata`    | Decode `user_role` from JWT `access_token`               |

---

## Current Inventory

### Roles (2 total)

- `admin` — full access
- (implicit) regular user — limited access

### Permissions Used

From [permissions.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/types/permissions.ts):

| Permission Key            | Who Has It              | What It Does                             |
| ------------------------- | ----------------------- | ---------------------------------------- |
| `add_voice_actors`        | All authenticated users | Can suggest voice actor links            |
| `admin_fetch`             | Admin only              | Can trigger prepare_movie, trending etc. |
| `edit_voice_actor_link`   | All authenticated users | Can edit voice actor links               |
| `delete_voice_actor_link` | All authenticated users | Can delete voice actor links             |

### Edge Functions With Manual Role Checks (5 files)

| File                                                                                                                                                                      | What `isAdmin` controls               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [update-review-status/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/update-review-status/index.ts#L43-L46)       | Admin can review any work entry       |
| [link-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/link-voice-actor/index.ts#L36-L41)               | Admin can impersonate (targetUserId)  |
| [link-user-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/link-user-voice-actor/index.ts#L22-L26)     | Admin-only endpoint                   |
| [delete-voice-actor-link/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/delete-voice-actor-link/index.ts#L27-L32) | Admin can delete any user's link      |
| [get-user-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/get-user-voice-actor/index.ts#L28-L33)       | Admin can view any user's voice actor |

### Client-Side `isAdmin` Usage (~20 locations)

| File                                                                                                                                                          | Usage                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [auth.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/stores/auth.ts#L16-L21)                                                     | `isAdmin` computed from `app_metadata.role`          |
| [usePermissions.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/composables/usePermissions.ts)                                    | `hasPermission()` checks `isAdmin` for `admin_fetch` |
| [useVoiceActorManagement.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/composables/useVoiceActorManagement.ts#L40)              | Exposes `isAdmin` ref                                |
| [base.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/layouts/base.vue#L80)                                                      | Shows admin nav items                                |
| [router.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/router/router.ts#L130)                                                    | Route guard for admin pages                          |
| [movie-details.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/views/movie-details.vue#L9)                                       | Admin toolbar buttons                                |
| [serie-details.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/views/serie-details.vue#L50)                                      | `:is-admin` prop                                     |
| [voice-actor-details.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/views/voice-actor-details.vue#L9)                           | Admin toolbar buttons                                |
| [profile.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/views/profile.vue#L6)                                                   | Admin settings button, impersonation UI              |
| [ProfileVoiceActorSelector.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/profile/ProfileVoiceActorSelector.vue#L51) | Admin-only UI (5 locations)                          |
| [UserManagement.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/admin/UserManagement.vue#L55)                         | Reads `app_metadata.role`                            |
| [ActorItem.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/ActorItem.vue#L41)                                         | `:isAdmin` prop                                      |
| [ActorVoiceActorItem.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/ActorVoiceActorItem.vue#L79)                     | Admin action buttons                                 |
| [NoVoiceActor.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/NoVoiceActor.vue#L12)                                   | Admin add button                                     |
| [VoiceActorList.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/VoiceActorList.vue#L12)                               | Admin actions slot                                   |

### Role Assignment

- [update_user_role/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/update_user_role/index.ts) — Sets `app_metadata.role` via admin API
- [update_user_role.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/update_user_role.ts) — CLI script

---

## Migration Steps

### Phase 1: Database Schema

- `[ ]` Create migration file `supabase/migrations/YYYYMMDD_rbac_setup.sql`
- `[ ]` Define role and permission enums:
  ```sql
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');
  CREATE TYPE public.app_permission AS ENUM (
    'voice_actors.add',
    'voice_actors.edit',
    'voice_actors.delete',
    'work.review',
    'work.delete',
    'users.impersonate',
    'admin.fetch'
  );
  ```
- `[ ]` Create `user_roles` table:
  ```sql
  CREATE TABLE public.user_roles (
    id        bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role      public.app_role NOT NULL,
    UNIQUE (user_id, role)
  );
  ```
- `[ ]` Create `role_permissions` table:
  ```sql
  CREATE TABLE public.role_permissions (
    id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    role       public.app_role NOT NULL,
    permission public.app_permission NOT NULL,
    UNIQUE (role, permission)
  );
  ```
- `[ ]` Seed permissions:
  ```sql
  INSERT INTO public.role_permissions (role, permission) VALUES
    ('admin', 'voice_actors.add'),
    ('admin', 'voice_actors.edit'),
    ('admin', 'voice_actors.delete'),
    ('admin', 'work.review'),
    ('admin', 'work.delete'),
    ('admin', 'users.impersonate'),
    ('admin', 'admin.fetch'),
    ('moderator', 'voice_actors.add'),
    ('moderator', 'voice_actors.edit'),
    ('moderator', 'work.review');
  ```
- `[ ]` Migrate existing admin users from `app_metadata.role` to `user_roles` table:
  ```sql
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'
  FROM auth.users
  WHERE raw_app_meta_data->>'role' = 'admin';
  ```

---

### Phase 2: Auth Hook

- `[ ]` Create the `custom_access_token_hook` function:

  ```sql
  CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
  DECLARE
    claims jsonb;
    user_role public.app_role;
  BEGIN
    SELECT role INTO user_role
    FROM public.user_roles
    WHERE user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    IF user_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    ELSE
      claims := jsonb_set(claims, '{user_role}', 'null');
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END;
  $$;
  ```

- `[ ]` Grant permissions for the hook:

  ```sql
  GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
  GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
  REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
  GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
  REVOKE ALL ON TABLE public.user_roles FROM authenticated, anon, public;

  CREATE POLICY "Allow auth admin to read user roles"
    ON public.user_roles AS PERMISSIVE FOR SELECT
    TO supabase_auth_admin USING (true);
  ```

- `[ ]` Enable the hook in **Supabase Dashboard → Authentication → Hooks → Custom Access Token**
- `[ ]` For local dev: add hook config to `supabase/config.toml`:
  ```toml
  [auth.hook.custom_access_token]
  enabled = true
  uri = "pg-functions://postgres/public/custom_access_token_hook"
  ```

---

### Phase 3: RLS Policies

- `[ ]` Create the `authorize()` helper function:
  ```sql
  CREATE OR REPLACE FUNCTION public.authorize(requested_permission public.app_permission)
  RETURNS boolean AS $$
  DECLARE
    bind_permissions int;
    user_role public.app_role;
  BEGIN
    SELECT (auth.jwt() ->> 'user_role')::public.app_role INTO user_role;
    SELECT count(*)
    INTO bind_permissions
    FROM public.role_permissions
    WHERE role_permissions.permission = requested_permission
      AND role_permissions.role = user_role;
    RETURN bind_permissions > 0;
  END;
  $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';
  ```
- `[ ]` Enable RLS on `voice_actors` table:
  ```sql
  ALTER TABLE voice_actors ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read voice actors" ON voice_actors FOR SELECT TO authenticated, anon USING (true);
  CREATE POLICY "Authorized users can insert" ON voice_actors FOR INSERT TO authenticated WITH CHECK (authorize('voice_actors.add'));
  CREATE POLICY "Authorized users can update" ON voice_actors FOR UPDATE TO authenticated USING (authorize('voice_actors.edit'));
  CREATE POLICY "Authorized users can delete" ON voice_actors FOR DELETE TO authenticated USING (authorize('voice_actors.delete'));
  ```
- `[ ]` Enable RLS on `work` table:
  ```sql
  ALTER TABLE work ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read work" ON work FOR SELECT TO authenticated, anon USING (true);
  CREATE POLICY "Authenticated can insert" ON work FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authorized can delete" ON work FOR DELETE TO authenticated USING (authorize('work.delete'));
  ```
- `[ ]` Enable RLS on `source` table (if needed)
- `[ ]` Enable RLS on `user_roles` table:
  ```sql
  ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can read own role" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
  ```
- `[ ]` Enable RLS on `role_permissions` table:
  ```sql
  ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read permissions" ON role_permissions FOR SELECT TO authenticated USING (true);
  ```

---

### Phase 4: Update Edge Functions (Server-Side)

- `[ ]` Replace manual `isAdmin` checks with `authorize()` or rely on RLS
- `[ ]` Update [update-review-status/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/update-review-status/index.ts):
  - Read `ctx.userClaims.user_role` instead of triple-checking `appMetadata/userMetadata/role`
- `[ ]` Update [link-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/link-voice-actor/index.ts):
  - Replace `isAdmin` with `ctx.userClaims.user_role === 'admin'`
- `[ ]` Update [link-user-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/link-user-voice-actor/index.ts):
  - Same pattern
- `[ ]` Update [delete-voice-actor-link/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/delete-voice-actor-link/index.ts):
  - Same pattern
- `[ ]` Update [get-user-voice-actor/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/get-user-voice-actor/index.ts):
  - Same pattern
- `[ ]` Update [update_user_role/index.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/supabase/functions/update_user_role/index.ts):
  - Change from `ctx.supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role } })`
  - To `INSERT INTO user_roles (user_id, role) VALUES (userId, role) ON CONFLICT DO UPDATE`

---

### Phase 5: Update Client (Mobile App)

- `[ ]` Install `jwt-decode` package: `npm install jwt-decode`
- `[ ]` Update [auth.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/stores/auth.ts):
  - Decode `access_token` to get `user_role` claim:

    ```typescript
    import { jwtDecode } from 'jwt-decode';

    const userRole = computed(() => {
      const session = /* get current session */;
      if (!session?.access_token) return null;
      const jwt = jwtDecode<{ user_role?: string }>(session.access_token);
      return jwt.user_role;
    });

    const isAdmin = computed(() => userRole.value === 'admin');
    ```

  - Remove triple-check on `app_metadata/user_metadata/role`

- `[ ]` Update [permissions.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/types/permissions.ts):
  - Align permission keys with database enum values
- `[ ]` Update [usePermissions.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/composables/usePermissions.ts):
  - Optionally fetch `role_permissions` from DB to build client-side permission map
- `[ ]` Update [UserManagement.vue](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/apps/mobile/src/components/admin/UserManagement.vue):
  - Read role from `user_roles` table instead of `app_metadata`

---

### Phase 6: Cleanup

- `[ ]` Remove old `app_metadata.role` from existing users (optional, backwards compat)
- `[ ]` Delete [update_user_role.ts](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/packages/database/update_user_role.ts) CLI script (replaced by DB inserts)
- `[ ]` Remove unused imports and dead code
- `[ ]` Run `deno check` on all edge functions
- `[ ]` Test locally with `supabase start`

---

### Phase 7: Verification

- `[ ]` Verify admin user has `user_role: 'admin'` in their JWT after login
- `[ ]` Verify regular user has `user_role: null` in their JWT
- `[ ]` Verify RLS blocks unauthorized writes to `voice_actors` and `work`
- `[ ]` Verify edge functions correctly read `user_role` from claims
- `[ ]` Verify mobile app correctly shows/hides admin UI
- `[ ]` Verify `UserManagement.vue` can assign roles via `user_roles` table

---

## Review Notes & Considerations

- **RLS Performance**: The `authorize()` function queries `role_permissions` for every row. Marking the function as `STABLE` is great for caching per statement. The `UNIQUE (role, permission)` constraint added in Phase 1 provides an index which keeps this lookup extremely fast.
- **Client JWT Parsing**: While installing `jwt-decode` (Phase 5) works perfectly, note that Supabase's `getSession()` often parses custom claims into the session object automatically (often under `session.user.app_metadata`). Using `jwt-decode` is a safe and robust fallback if you prefer it.
- **Types Generation**: **CRITICAL** - Remember to run `mise run gen-types` after completing Phase 1 so that the Vue frontend and Edge Functions have strict TypeScript definitions for `app_role`, `app_permission`, and the new tables.
- **Scope**: This is a **medium-sized effort with a high architectural impact**. The actual lines of code changed won't be massive (mostly a find-and-replace for the client-side `isAdmin` check), but because it touches core authentication, it fundamentally improves how authorization is enforced.
