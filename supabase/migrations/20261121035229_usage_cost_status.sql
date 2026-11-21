alter table public.usage_ledger
  alter column actual_cost_usd drop not null,
  alter column actual_cost_usd drop default;

alter table public.usage_ledger
  add column if not exists cost_status text not null default 'unknown'
  check (cost_status in ('unknown', 'estimated', 'actual'));
