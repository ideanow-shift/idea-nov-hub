alter table public.stores
  add column if not exists area text,
  add column if not exists store_type text;

comment on column public.stores.area is
  '店舗エリア。店舗情報シートのNOV_エリア等から同期する。';
comment on column public.stores.store_type is
  '店舗種別。直営・FC・カラー専門店などの分類で利用する。';

grant select, update (area, store_type) on public.stores to service_role;
