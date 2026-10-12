-- Applied to the Hometown Card Shop project on 2026-10-11.
-- Enforce that comparisons belong to research belonging to the very same seller.
alter table public.card_price_research add constraint card_price_research_id_seller_unique unique(id,seller_id);
alter table public.card_price_comparables add constraint card_price_comparable_owner_fk
 foreign key(run_id,seller_id) references public.card_price_research(id,seller_id) on delete cascade;
