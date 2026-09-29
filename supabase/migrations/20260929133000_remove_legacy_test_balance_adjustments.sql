-- Remove the two legacy test balance adjustments that were creating a non-real wallet balance.
delete from public.transactions
where id in (
  'e208ca6d-ab42-4ef5-b199-b596757f9d52',
  '9fd98051-984f-4d99-acea-cc95886d56b0'
);
