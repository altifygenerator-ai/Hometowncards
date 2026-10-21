-- Defense in depth: service_role bypasses RLS; client roles remain denied.
create policy marketing_subscribers_deny_clients on public.marketing_subscribers for all to anon,authenticated using (false) with check (false);
create policy marketing_events_deny_clients on public.marketing_events for all to anon,authenticated using (false) with check (false);
create policy marketing_deliveries_deny_clients on public.marketing_deliveries for all to anon,authenticated using (false) with check (false);