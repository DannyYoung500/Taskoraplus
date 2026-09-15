insert into public.monetization_providers (category, provider_key, provider_name, priority, enabled)
values
  ('ads','adsgram','AdsGram',10,false),
  ('ads','monetag','Monetag',20,false),
  ('ads','onclicka','OnClickA',30,false),
  ('ads','richads','RichAds',40,false),
  ('ads','gigapub','GigaPub',50,false),
  ('ads','tads','TADS',60,false)
on conflict (provider_key) do update
set provider_name=excluded.provider_name,
    category=excluded.category,
    priority=excluded.priority;
