create extension if not exists pgcrypto;

create table if not exists codex_activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'unused' check (status in ('unused', 'activated', 'disabled')),
  activated_account text,
  activated_at timestamptz,
  batch_id text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz
);

create index if not exists codex_activation_codes_status_idx
  on codex_activation_codes(status);

create index if not exists codex_activation_codes_activated_at_idx
  on codex_activation_codes(activated_at desc);

create index if not exists codex_activation_codes_account_idx
  on codex_activation_codes(activated_account);

create index if not exists codex_activation_codes_batch_idx
  on codex_activation_codes(batch_id);

create table if not exists codex_admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  created_at timestamptz not null default timezone('utc', now())
);
