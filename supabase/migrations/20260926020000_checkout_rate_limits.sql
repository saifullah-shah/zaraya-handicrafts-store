-- Scheduled cleanup for abandoned cash-on-delivery reservations.
-- Guests can place COD orders without payment, so stock stays reserved until an
-- admin cancels it or this job expires the reservation. Requires pg_cron, which is
-- available on Supabase projects; the block degrades gracefully where it is not.

do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when others then
    raise notice 'pg_cron unavailable; schedule release-expired-cod-orders manually.';
    return;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'release-expired-cod-orders',
      '*/15 * * * *',
      'select public.release_expired_cod_orders();'
    );
  end if;
exception
  when others then
    raise notice 'Could not schedule release-expired-cod-orders: %', sqlerrm;
end;
$$;
