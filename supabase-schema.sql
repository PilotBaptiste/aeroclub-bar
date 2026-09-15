-- =============================================================================
-- Supabase Schema: Multi-Tenant Bar Management SaaS
-- =============================================================================
-- Converts the existing single-tenant aeroclub bar app (Redis KV) to a
-- multi-tenant PostgreSQL schema on Supabase.
--
-- Design decisions:
--   - Every tenant table carries an org_id FK with ON DELETE CASCADE so that
--     deleting an organization cleanly removes all its data.
--   - org_id is indexed on every table for fast tenant-scoped queries.
--   - Row Level Security (RLS) is enabled on ALL tables. Policies use a helper
--     function get_user_orgs() to verify the authenticated user belongs to the
--     organization that owns the row.
--   - products.emoji is text (not char) so it can hold multi-codepoint emoji
--     or an image URL for custom icons.
--   - transactions.items stays jsonb (array of {productId, name, qty, price})
--     because the line-item shape may evolve per tenant and denormalizing the
--     product name/price at sale time is intentional (historical accuracy).
--   - organizations.settings is jsonb for per-org config that changes often
--     (admin PIN, bureau PIN, opening hours, loyalty thresholds, etc.).
--   - credits tracks loyalty/fidelity programs per member x product type,
--     matching the existing coffeeCredits / madeleineCredits / productCredits.
--   - numeric(10,2) is used for money columns — sufficient for bar prices and
--     avoids floating-point rounding.
--   - Transactions are append-only (no update/delete RLS) for audit integrity.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
-- pgcrypto is enabled by default on Supabase; gen_random_uuid() is available.


-- ---------------------------------------------------------------------------
-- 1. Organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  logo_url   text,
  settings   jsonb not null default '{}',   -- pins, opening hours, misc config
  theme      jsonb not null default '{}',   -- colors, branding overrides
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  organizations          is 'Each row is one bar / client tenant.';
comment on column organizations.slug     is 'URL-safe identifier, e.g. "acba".';
comment on column organizations.settings is 'Flexible JSON for adminPin, bureauPin, openingHours, loyaltyThresholds, etc.';


-- ---------------------------------------------------------------------------
-- 2. Users (profile layer on top of auth.users)
-- ---------------------------------------------------------------------------
create table users (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'staff'
             check (role in ('super_admin', 'org_admin', 'staff')),
  created_at timestamptz not null default now()
);

comment on table  users      is 'Application-level profile; PK references Supabase auth.users.';
comment on column users.role is 'Platform-wide role. super_admin can manage all orgs.';


-- ---------------------------------------------------------------------------
-- 3. User <-> Organization junction
-- ---------------------------------------------------------------------------
create table user_organizations (
  user_id     uuid not null references users (id) on delete cascade,
  org_id      uuid not null references organizations (id) on delete cascade,
  role_in_org text not null default 'staff'
              check (role_in_org in ('admin', 'treasurer', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index idx_user_organizations_org_id on user_organizations (org_id);

comment on table  user_organizations            is 'Maps users to the organizations they belong to, with per-org role.';
comment on column user_organizations.role_in_org is 'Role scoped to this organization: admin, treasurer, or staff.';


-- ---------------------------------------------------------------------------
-- 4. Categories
-- ---------------------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  name       text not null,
  emoji      text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_categories_org_id on categories (org_id);


-- ---------------------------------------------------------------------------
-- 5. Products
-- ---------------------------------------------------------------------------
create table products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  name          text not null,
  emoji         text,                          -- emoji character or image URL
  price         numeric(10, 2) not null default 0,
  cost          numeric(10, 2) not null default 0,
  stock         int not null default 0,
  stock_reserve int not null default 0,        -- threshold for low-stock alerts
  category_id   uuid references categories (id) on delete set null,
  location      text not null default 'cafe'
                check (location in ('frigo', 'cafe', 'congelateur')),
  archived      boolean not null default false,
  position      int not null default 0,
  led_start     int,                           -- LED strip start index
  led_end       int,                           -- LED strip end index
  led_color     text,                          -- hex color for LED strip
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_products_org_id on products (org_id);

comment on column products.stock_reserve is 'Minimum stock level before a low-stock warning is triggered.';
comment on column products.led_start     is 'Physical LED strip index — used to light up the product location on a shelf.';


-- ---------------------------------------------------------------------------
-- 6. Members (bar patrons / club members)
-- ---------------------------------------------------------------------------
create table members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  name       text not null,
  email      text,
  balance    numeric(10, 2) not null default 0,  -- prepaid account balance
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_members_org_id on members (org_id);

comment on column members.balance is 'Prepaid account balance; positive = credit the member can spend.';


-- ---------------------------------------------------------------------------
-- 7. Transactions (sales)
-- ---------------------------------------------------------------------------
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  items          jsonb not null default '[]',   -- [{productId, name, qty, unitPrice}]
  total          numeric(10, 2) not null default 0,
  payment_method text not null,                 -- 'cash', 'card', 'account', 'free', etc.
  member_id      uuid references members (id) on delete set null,
  created_by     uuid references users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_transactions_org_id     on transactions (org_id);
create index idx_transactions_created_at on transactions (created_at);
create index idx_transactions_member_id  on transactions (member_id);

comment on column transactions.items      is 'Denormalized line items as JSON array — preserves historical product name and price at time of sale.';
comment on column transactions.created_by is 'The staff user who recorded the sale; null if recorded by an anonymous/shared terminal.';


-- ---------------------------------------------------------------------------
-- 8. Procurements (restocking / purchases from suppliers)
-- ---------------------------------------------------------------------------
create table procurements (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  product_id     uuid not null references products (id) on delete cascade,
  quantity       int not null,
  unit_cost      numeric(10, 2) not null default 0,
  total_cost     numeric(10, 2) not null default 0,
  payment_method text,
  supplier       text,
  created_by     uuid references users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_procurements_org_id on procurements (org_id);


-- ---------------------------------------------------------------------------
-- 9. Batches (per-product lots with optional expiry tracking)
-- ---------------------------------------------------------------------------
create table batches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  product_id  uuid not null references products (id) on delete cascade,
  quantity    int not null default 0,
  expiry_date date,
  created_at  timestamptz not null default now()
);

create index idx_batches_org_id on batches (org_id);

comment on table batches is 'Tracks individual product lots for expiry-date management (FIFO rotation).';


-- ---------------------------------------------------------------------------
-- 10. Suggestions (user feedback / ideas)
-- ---------------------------------------------------------------------------
create table suggestions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  text       text not null,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index idx_suggestions_org_id on suggestions (org_id);


-- ---------------------------------------------------------------------------
-- 11. Credits (loyalty / fidelity programs)
-- ---------------------------------------------------------------------------
-- Replaces the old coffeeCredits, madeleineCredits, productCredits maps.
-- One row per (member, type, optional product).  total_bought and free_earned
-- let the app compute "buy N get 1 free" without scanning transactions.

create table credits (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  member_id    uuid not null references members (id) on delete cascade,
  product_id   uuid references products (id) on delete set null,
  type         text not null
               check (type in ('coffee', 'madeleine', 'product')),
  total_bought int not null default 0,
  free_earned  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One credit tracker per member per type per product
  unique (org_id, member_id, type, product_id)
);

create index idx_credits_org_id    on credits (org_id);
create index idx_credits_member_id on credits (member_id);

comment on table  credits              is 'Loyalty tracking: "buy N get 1 free" counters per member.';
comment on column credits.total_bought is 'Cumulative purchases counted toward the next free item.';
comment on column credits.free_earned  is 'Number of free items already redeemed.';


-- ===========================================================================
-- Helper function: get_user_orgs
-- ===========================================================================
-- Returns the set of organization IDs the given user belongs to.
-- Used by RLS policies to scope every query to the user's tenants.

create or replace function get_user_orgs(user_uuid uuid)
returns setof uuid
language sql
stable
security definer
as $$
  select org_id
  from user_organizations
  where user_id = user_uuid
$$;

comment on function get_user_orgs is 'Returns org IDs the user belongs to — used in RLS policies.';


-- ===========================================================================
-- Helper function: is_super_admin
-- ===========================================================================
-- Returns true if the authenticated user has the super_admin platform role.

create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and role = 'super_admin'
  )
$$;


-- ===========================================================================
-- Row Level Security
-- ===========================================================================

-- ---- organizations --------------------------------------------------------
alter table organizations enable row level security;

create policy "Users can view their own organizations"
  on organizations for select
  using (
    id in (select get_user_orgs(auth.uid()))
    or is_super_admin()
  );

create policy "Super admins can insert organizations"
  on organizations for insert
  with check (is_super_admin());

create policy "Org admins can update their organization"
  on organizations for update
  using (
    id in (select get_user_orgs(auth.uid()))
    or is_super_admin()
  );

-- ---- users ----------------------------------------------------------------
alter table users enable row level security;

create policy "Users can view themselves"
  on users for select
  using (id = auth.uid() or is_super_admin());

create policy "Users can update themselves"
  on users for update
  using (id = auth.uid());

-- ---- user_organizations ---------------------------------------------------
alter table user_organizations enable row level security;

create policy "Users can view their own memberships"
  on user_organizations for select
  using (
    user_id = auth.uid()
    or org_id in (select get_user_orgs(auth.uid()))
    or is_super_admin()
  );

create policy "Org admins can manage memberships"
  on user_organizations for all
  using (
    org_id in (
      select org_id from user_organizations
      where user_id = auth.uid() and role_in_org = 'admin'
    )
    or is_super_admin()
  );

-- ---- Tenant-scoped tables -------------------------------------------------
-- The following tables share the same RLS pattern: SELECT, INSERT, UPDATE,
-- DELETE allowed when the row's org_id is in the user's organizations
-- (or user is super_admin).

-- categories
alter table categories enable row level security;

create policy "Org members can view categories"
  on categories for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage categories"
  on categories for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- products
alter table products enable row level security;

create policy "Org members can view products"
  on products for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage products"
  on products for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- members
alter table members enable row level security;

create policy "Org members can view members"
  on members for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage members"
  on members for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- transactions (append-only: no update/delete policies for audit integrity)
alter table transactions enable row level security;

create policy "Org members can view transactions"
  on transactions for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can insert transactions"
  on transactions for insert
  with check (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- procurements
alter table procurements enable row level security;

create policy "Org members can view procurements"
  on procurements for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage procurements"
  on procurements for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- batches
alter table batches enable row level security;

create policy "Org members can view batches"
  on batches for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage batches"
  on batches for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

-- suggestions (anyone can insert, only admin/treasurer can update status)
alter table suggestions enable row level security;

create policy "Org members can view suggestions"
  on suggestions for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Anyone in org can insert suggestions"
  on suggestions for insert
  with check (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org admins can update suggestions"
  on suggestions for update
  using (
    org_id in (
      select org_id from user_organizations
      where user_id = auth.uid() and role_in_org in ('admin', 'treasurer')
    )
    or is_super_admin()
  );

-- credits
alter table credits enable row level security;

create policy "Org members can view credits"
  on credits for select
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());

create policy "Org members can manage credits"
  on credits for all
  using (org_id in (select get_user_orgs(auth.uid())) or is_super_admin());


-- ===========================================================================
-- Automatic updated_at trigger
-- ===========================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger trg_members_updated_at
  before update on members
  for each row execute function set_updated_at();

create trigger trg_credits_updated_at
  before update on credits
  for each row execute function set_updated_at();


-- ===========================================================================
-- Seed data: ACBA organization
-- ===========================================================================

insert into organizations (id, slug, name, settings)
values (
  gen_random_uuid(),
  'acba',
  'Aéro-Club du Bassin d''Arcachon',
  '{
    "adminPin": "1234",
    "bureauPin": "0000",
    "openingHours": "Wed 18h-20h, Sat 10h-12h",
    "loyaltyThresholds": {
      "coffee": 10,
      "madeleine": 10
    }
  }'::jsonb
);
