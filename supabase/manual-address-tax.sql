-- Use tax amounts quoted and saved by our checkout BEFORE Stripe payment.
-- Does not activate paid checkout or represent a state tax registration.
alter table public.orders add column if not exists tax_rate numeric(7,6) not null default 0;
alter table public.orders add column if not exists tax_source text;

create or replace function public.hcs_apply_manual_checkout_tax(
 p_order uuid,p_shipping jsonb,p_tax_cents integer,p_rate numeric,p_source text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype;v_state text;
begin
 select * into v_order from public.orders where id=p_order for update;
 if not found or v_order.status<>'held' or v_order.stripe_session_id is not null
    or v_order.checkout_expires_at<=now() then
  raise exception 'Order is no longer eligible for tax calculation';
 end if;
 v_state:=upper(coalesce(p_shipping->'address'->>'state',''));
 if coalesce(p_shipping->>'name','')='' or
  length(coalesce(p_shipping->'address'->>'line1',''))<5 or
  length(coalesce(p_shipping->'address'->>'city',''))<2 or
  coalesce(p_shipping->'address'->>'country','')<>'US' or
  coalesce(p_shipping->'address'->>'postal_code','')!~'^\d{5}(-\d{4})?$'
 then raise exception 'Invalid delivery address';end if;
 if v_state='AR' then
  if p_source<>'ziptax-address-v60' or p_rate<0.065 or p_rate>0.16
   or p_tax_cents<>round((v_order.subtotal_cents+v_order.shipping_cents)*p_rate)
  then raise exception 'Invalid Arkansas sales tax amount';end if;
 else
  if p_source<>'outside-arkansas-not-registered' or p_rate<>0 or p_tax_cents<>0
  then raise exception 'Invalid out-of-state tax amount';end if;
 end if;
 update public.orders set
  tax_cents=p_tax_cents,tax_rate=p_rate,tax_source=p_source,
  total_cents=subtotal_cents+shipping_cents+p_tax_cents,
  shipping_address=p_shipping,shipping_name=left(coalesce(p_shipping->>'name',''),120),
  updated_at=now() where id=p_order;
end;$$;

revoke all on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) to service_role;

-- Webhook verifies a single, exact settled total; Stripe Tax is disabled.
CREATE OR REPLACE FUNCTION public.hcs_settle_checkout(p_order uuid, p_session_id text, p_event_id text, p_event_type text, p_paid boolean DEFAULT false, p_payment_intent text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_shipping jsonb DEFAULT NULL::jsonb, p_amount_total integer DEFAULT NULL::integer, p_tax_cents integer DEFAULT 0)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_o public.orders%rowtype;v_line record;v_bonus record;v_reserved bigint;
begin
 if p_event_id is null or p_event_id not like 'evt_%' then raise exception 'Invalid Stripe event id';end if;
 if p_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded',
   'checkout.session.async_payment_failed','checkout.session.expired') then raise exception 'Unsupported event';end if;
 select * into v_o from public.orders where id=p_order for update;
 if not found or v_o.stripe_session_id<>p_session_id then raise exception 'Unrecognized checkout session';end if;
 if exists(select 1 from public.stripe_webhook_events where id=p_event_id) then return 'duplicate';end if;
 if v_o.status in ('paid','fulfilled') then
  insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
  return 'already_paid';
 end if;
 if v_o.status<>'held' then
  insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
  return 'already_closed';
 end if;
 if p_paid then
  if p_amount_total is null or p_tax_cents<>0 or p_amount_total<>v_o.total_cents
  then
   update public.orders set status='needs_review',updated_at=now() where id=p_order;
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'amount_mismatch_needs_review';
  end if;
  if v_o.checkout_expires_at<=now() then
   update public.orders set status='needs_review',updated_at=now() where id=p_order;
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'expired_paid_needs_review';
  end if;
  -- Consume each held unit exactly once. Stripe is authoritative, not the redirect page.
  for v_line in select r.product_id,r.quantity,p.seller_id
    from public.inventory_reservations r join public.products p on p.id=r.product_id
    where r.order_id=p_order and r.state='held' order by r.product_id for update of r loop
   update public.products set stock=stock-v_line.quantity,
    status=case when stock=v_line.quantity then 'sold_out' else status end,updated_at=now()
    where id=v_line.product_id and stock>=v_line.quantity;
   if not found then raise exception 'Paid order stock conflict; manual reconciliation required';end if;
   insert into public.stock_movements(product_id,seller_id,delta,reason,reference_id)
   values(v_line.product_id,v_line.seller_id,-v_line.quantity,'site_sale',p_session_id);
  end loop;
  update public.inventory_reservations set state='consumed' where order_id=p_order and state='held';
  select * into v_bonus from public.order_bonus_cards where order_id=p_order for update;
  if found then
    update public.bonus_card_pools
      set available_count=available_count-v_bonus.free_card_count,
          reserved_count=reserved_count-v_bonus.free_card_count,updated_at=now()
      where id=v_bonus.pool_id and available_count>=v_bonus.free_card_count and reserved_count>=v_bonus.free_card_count;
    if not found then raise exception 'Bonus inventory conflict';end if;
  end if;
  update public.orders set status='paid',stripe_payment_intent_id=nullif(p_payment_intent,''),
    customer_email=left(p_email,250),shipping_address=coalesce(p_shipping,v_o.shipping_address),
    tax_cents=v_o.tax_cents,total_cents=p_amount_total,updated_at=now() where id=p_order;
  update public.seller_orders set status='paid' where order_id=p_order;
 else
  if p_event_type='checkout.session.completed' then
   -- For delayed payments, retain inventory until final succeeded/failed.
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'awaiting_payment';
  end if;
  update public.inventory_reservations set state=case when p_event_type='checkout.session.expired' then 'expired' else 'cancelled' end
   where order_id=p_order and state='held';
  select * into v_bonus from public.order_bonus_cards where order_id=p_order for update;
  if found then update public.bonus_card_pools set reserved_count=greatest(0,reserved_count-v_bonus.free_card_count),updated_at=now()
    where id=v_bonus.pool_id;end if;
  update public.orders set status='cancelled',updated_at=now() where id=p_order;
  update public.seller_orders set status='cancelled' where order_id=p_order;
 end if;
 insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
 return case when p_paid then 'paid' else 'released' end;
end;$function$;
revoke execute on function public.hcs_settle_checkout(uuid,text,text,text,boolean,text,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.hcs_settle_checkout(uuid,text,text,text,boolean,text,text,jsonb,integer,integer) to service_role;
