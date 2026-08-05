create type public.user_report_status as enum ('pending', 'resolved', 'dismissed');

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_url text not null,
  reason text not null,
  details text,
  status public.user_report_status not null default 'pending',
  created_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.user_reports enable row level security;

-- RLS Policies
create policy "Users can insert their own reports."
  on public.user_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view their own reports."
  on public.user_reports for select
  to authenticated
  using (auth.uid() = reporter_id);
