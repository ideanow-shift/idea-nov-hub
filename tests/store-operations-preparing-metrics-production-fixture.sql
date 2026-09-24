\set ON_ERROR_STOP on

create table if not exists public.corporations (
  id uuid primary key,
  corporation_no text not null unique,
  is_active boolean not null default true
);
create table if not exists public.stores (
  id uuid primary key,
  store_id text not null unique,
  store_name text not null,
  corporation_id uuid,
  is_active boolean not null default true
);
create table if not exists public.employees (
  id uuid primary key,
  is_active boolean not null default true
);

insert into public.corporations(id,corporation_no) values
('e4059116-bdb3-4e13-9763-bbc77bdfe062','0001'),
('f0d56e0d-62e1-4eba-a37a-17e396ab0b61','0002'),
('becb6f4b-2222-406d-8315-1eed48717327','0003'),
('127b2041-a61c-498e-9040-a9d0a8146182','0004'),
('2dcb7eb1-3aa9-4f75-a439-471da534b2fb','0005'),
('34afa056-2d7c-413a-b6ea-80e2620e003c','0006');

insert into public.stores(id,store_id,store_name,corporation_id,is_active) values
('2980442d-294c-4aae-a9bb-78f530a3a20a','annex','ANNEX','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('1bcba30a-d063-4cdb-be74-425e250aeb25','kamishakujii','上石神井','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('fec1e181-ca5b-482d-a865-3f488f19128f','shimoigusa','下井草','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('3ba5e54d-5f39-4bcd-b917-7daaea34a8e9','kumegawa','久米川','becb6f4b-2222-406d-8315-1eed48717327',true),
('73ee82b5-86fa-42e7-ab03-0e075d218dc3','hoya','保谷','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('71551fcf-853f-4cad-ac94-82b93e75de82','kokubunnji','国分寺','127b2041-a61c-498e-9040-a9d0a8146182',true),
('1285ac70-9181-44db-9443-cbd043ab908b','tokorozawa','所沢','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('acc91785-3bb5-49f0-a2f6-0be6e5d511eb','shintokorozawa','新所沢','f0d56e0d-62e1-4eba-a37a-17e396ab0b61',true),
('02d29285-6df0-44b2-bca8-4d61bfe1f5a8','higashikurume','東久留米','34afa056-2d7c-413a-b6ea-80e2620e003c',true),
('e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6','higashiyamato','東大和','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('4e5526cc-9ec7-42aa-ac60-579b6c438c88','ekoda','江古田','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('36c222de-0554-4265-b177-3b68285cc4a4','ikebukuro','池袋','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('ad931406-22de-4ba7-a6eb-4502d5c50a91','shakujiikoen','石神井公園','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('5f66193f-d360-4967-b9c7-a100c8ee5e94','tachikawa','立川','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('e7ecb022-6b19-4952-bf4b-fbf5f4c53895','hanakoganei','花小金井','2dcb7eb1-3aa9-4f75-a439-471da534b2fb',true),
('b898c63f-1cc1-42c5-be4f-916f24f49cb6','nogata','野方','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('887da14c-2c0d-46b3-8953-962c7c8dd590','takadanobaba','高田馬場','e4059116-bdb3-4e13-9763-bbc77bdfe062',true),
('b5a206dc-4a1f-4eb4-9b14-a6f3e5cb2b2c','saginomiya','鷺ノ宮','f0d56e0d-62e1-4eba-a37a-17e396ab0b61',true),
('62070a3c-c484-4a9b-bc06-c3904b27f2c0','roane','Roane','f0d56e0d-62e1-4eba-a37a-17e396ab0b61',true),
('a1997308-a402-4ddb-a3f7-8b70a75b054c','legacy-store-0013','KYARA旧','e4059116-bdb3-4e13-9763-bbc77bdfe062',false),
('ac20934d-ef15-4363-8c2f-759193c7fcc7','kyarahalf','KYARA HALF','e4059116-bdb3-4e13-9763-bbc77bdfe062',true);

insert into public.employees(id,is_active)
values ('369d9cd5-f6ba-4e53-9428-f631f0893469',true);

insert into dbf_ingest.metric_definitions
  (metric_code,definition_version,value_kind,display_name,description,is_active)
values ('RETAIL_PURCHASE_RATE','v1','rate','店販購買率','existing production rate fixture',true);

insert into dbf_ingest.source_files
  (sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id,received_via)
values (repeat('c',64),1,'existing-rate.json','application/json','existing_retail_rate_fixture',
  '369d9cd5-f6ba-4e53-9428-f631f0893469','nov_hub_secure_session');

insert into dbf_ingest.import_batches
  (source_file_id,fact_kind,fiscal_month,source_type,status,revision,created_by_employee_id,approved_by_employee_id,approved_at)
select id,'store_operating_result','2026-06-01','existing_rate_fixture','approved',1,
  '369d9cd5-f6ba-4e53-9428-f631f0893469','369d9cd5-f6ba-4e53-9428-f631f0893469',statement_timestamp()
from dbf_ingest.source_files where source_system='existing_retail_rate_fixture';

insert into public.dbf_store_monthly_metric_facts
  (fiscal_month,company_id,store_id,metric_code,rate,definition_version,source_type,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select '2026-06-01', 'e4059116-bdb3-4e13-9763-bbc77bdfe062', v.store_id,
  'RETAIL_PURCHASE_RATE',v.rate,'v1','existing_rate_fixture',sf.id,b.id,
  '369d9cd5-f6ba-4e53-9428-f631f0893469',1,'confirmed',true
from (values
  ('2980442d-294c-4aae-a9bb-78f530a3a20a'::uuid,0.10::numeric),
  ('1bcba30a-d063-4cdb-be74-425e250aeb25'::uuid,0.11::numeric),
  ('fec1e181-ca5b-482d-a865-3f488f19128f'::uuid,0.12::numeric),
  ('73ee82b5-86fa-42e7-ab03-0e075d218dc3'::uuid,0.13::numeric)
) v(store_id,rate)
cross join dbf_ingest.source_files sf
join dbf_ingest.import_batches b on b.source_file_id=sf.id
where sf.source_system='existing_retail_rate_fixture';
