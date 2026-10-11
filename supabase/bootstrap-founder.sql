-- Run ONLY on the new Hometown Card Shop Supabase project, AFTER
-- schema.sql and marketplace-operations.sql, AFTER the founding user accepts
-- a Supabase Auth invitation to altifygenerator@gmail.com.
-- This does not create an Auth login or send an invitation.
do $$
declare v_user uuid; v_seller uuid;
begin
 select id into v_user from auth.users
 where lower(email)=lower('altifygenerator@gmail.com') and email_confirmed_at is not null
 order by created_at desc limit 1;
 if v_user is null then
  raise exception 'Invite and confirm altifygenerator@gmail.com in Supabase Auth before applying founder bootstrap.';
 end if;
 select id into v_seller from public.sellers where slug='hometown-card-shop' and status='approved';
 if v_seller is null then raise exception 'Founding seller not found. Apply the schema first.'; end if;
 insert into public.platform_staff(user_id,role) values(v_user,'owner')
 on conflict(user_id) do update set role='owner';
 insert into public.seller_members(seller_id,user_id,role) values(v_seller,v_user,'owner')
 on conflict(seller_id,user_id) do update set role='owner';
 update public.sellers set contact_email='altifygenerator@gmail.com',updated_at=now() where id=v_seller;
end $$;
