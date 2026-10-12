
-- Public seller-interest inbox. No seller accounts are created by submissions.
create table if not exists public.seller_interest_leads(
 id uuid primary key default gen_random_uuid(),
 contact_name text not null check(length(contact_name) between 2 and 120),
 email text not null check(length(email) between 5 and 254),
 shop_name text not null default '',
 location text not null default '',
 inventory_size text not null default '',
 currently_selling text not null default '',
 seller_plan_interest text not null default 'undecided' check(seller_plan_interest in ('payg','starter','undecided')),
 notes text not null default '',
 notification_status text not null default 'pending' check(notification_status in ('pending','sent','failed')),
 notified_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists seller_interest_recent_idx on public.seller_interest_leads(lower(email),created_at desc);
alter table public.seller_interest_leads enable row level security;
-- Service-role-only: no public read of email addresses or direct insertion.
