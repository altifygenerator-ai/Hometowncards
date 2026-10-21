insert into public.marketing_subscribers(email,status,consent_source,consent_at,confirmed_at,unsubscribe_hash)
select lower(email),'active','giveaway_checkbox',confirmed_at,confirmed_at,encode(gen_random_bytes(32),'hex')
from public.shop_giveaway_entries
where newsletter_opt_in is true and confirmed_at is not null
on conflict(email) do nothing;
