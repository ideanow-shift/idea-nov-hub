alter table public.employees
  add column if not exists joined_on date,
  add column if not exists retired_on date,
  add column if not exists leave_start_date date,
  add column if not exists leave_end_date date,
  add column if not exists leave_type text;

comment on column public.employees.joined_on is
  '入社日。社員台帳の現在状態として保持し、生産性・勤続年数・経営管理で利用する。';
comment on column public.employees.retired_on is
  '退職日。退職者集計・離職分析・経営管理で利用する。';
comment on column public.employees.leave_start_date is
  '休職開始日。産休・育休・休職の期間管理で利用する。';
comment on column public.employees.leave_end_date is
  '休職終了予定日または復職日。';
comment on column public.employees.leave_type is
  '休職区分。例: 産休, 育休, 休職。';

grant select, update (
  joined_on,
  retired_on,
  leave_start_date,
  leave_end_date,
  leave_type
) on public.employees to service_role;
