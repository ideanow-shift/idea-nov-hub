alter table store_operations_uat_private.approved_identities
  add column if not exists delivery_digest text;

update store_operations_uat_private.approved_identities
set delivery_digest=case identity_key
  when 'uat-area-manager' then 'aed7a6aa6903d47acf870085c41a5131c81585ed5e5aa9c8fdf83a32794f747d'
  when 'uat-executive' then '15bba7e2c92b2d3944e7c4392ba00a4ca469e613aedb37db6594cef04e69c4ae'
  when 'uat-store-manager' then '40b13ad88f1d91e0ebbdbec1076f49201f871eb2bdeb3252622786b97800516d'
end
where artifact_digest='24bd1a96513865ac0d68f5e6781cca2dff49c7bc17bb98c76cfdb14861c52fc1'
  and identity_key in ('uat-area-manager','uat-executive','uat-store-manager');

alter table store_operations_uat_private.approved_identities
  alter column delivery_digest set not null;
alter table store_operations_uat_private.approved_identities
  add constraint approved_identities_delivery_digest_check
  check (delivery_digest ~ '^[0-9a-f]{64}$');
