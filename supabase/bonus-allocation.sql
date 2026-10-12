-- Conservative initial platform-funded bonus allocation; not a physical inventory recount.
with founder as (
 select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved'
), inserted as (
 insert into public.bonus_card_pools(funding_seller_id,sport,available_count,reserved_count)
 select id,'Mixed',1000,0 from founder
 on conflict(funding_seller_id,sport) do nothing
 returning id,available_count
)
insert into public.bonus_stock_movements(pool_id,delta,reason)
select id,available_count,'add_bulk' from inserted;
update public.reward_policies set is_active=true,updated_at=now()
where id='hometown-bonus-cards-v1'
and exists(select 1 from public.bonus_card_pools where funding_seller_id=public.reward_policies.funding_seller_id and sport='Mixed' and available_count-reserved_count>=1000);
