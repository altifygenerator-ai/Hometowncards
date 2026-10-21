-- Let a real entrant request a replacement email when the first confirmation
-- expires or never arrives. Track only counts and server timestamps, no raw tokens.
alter table public.shop_giveaway_entries
 add column if not exists confirmation_last_sent_at timestamptz,
 add column if not exists confirmation_send_count integer not null default 0
   check (confirmation_send_count between 0 and 100);
