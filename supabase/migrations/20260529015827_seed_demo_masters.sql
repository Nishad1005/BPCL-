insert into public.regions (id, name, type, parent_id) values
  ('00000000-0000-0000-0000-000000000001','Madhya Pradesh','state',null),
  ('00000000-0000-0000-0000-000000000002','Chhattisgarh','state',null),
  ('00000000-0000-0000-0000-000000000011','Indore Area','area','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012','Bhopal Area','area','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000021','Raipur Area','area','00000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.stores (id, store_name, dealer_name, city, state, region_id) values
  ('00000000-0000-0000-0000-0000000000a1','Indore Forecourt 1','Indore Dealer','Indore','Madhya Pradesh','00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-0000000000a2','Indore Forecourt 2','Indore Dealer','Indore','Madhya Pradesh','00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-0000000000a3','Bhopal Forecourt 1','Bhopal Dealer','Bhopal','Madhya Pradesh','00000000-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-0000000000a4','Raipur Forecourt 1','Raipur Dealer','Raipur','Chhattisgarh','00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-0000000000a5','Raipur Forecourt 2','Raipur Dealer','Raipur','Chhattisgarh','00000000-0000-0000-0000-000000000021')
on conflict (id) do nothing;
