-- Lock down server-only tables that shipped with RLS disabled or default grants.
--
-- public.checkout_rate_limits was created without RLS or a revoke, so the public
-- anon key in the storefront bundle could insert, read, zero, and delete rows and
-- wipe the per-IP/per-email checkout limits enforced by check_checkout_rate_limit().
-- public.admins was protected only by "RLS enabled with no policies"; the default
-- PostgREST grants were still in place, so revoking them removes the latent risk.

alter table public.checkout_rate_limits enable row level security;

revoke all on table public.checkout_rate_limits from anon, authenticated;
revoke all on table public.admins from anon, authenticated;

-- The money CHECK was added not valid in the transactional migration; validate it
-- now that store_settings is seeded, so bad values cannot slip in later.
alter table public.store_settings
  validate constraint store_settings_money_values;
