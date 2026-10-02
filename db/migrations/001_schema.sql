-- Yuvoy supply database: India-wide lead universe + verified supply.
-- Two layers, kept separate on purpose:
--   raw_record  : everything any source told us, verbatim, with provenance
--   provider    : one row per real-world business, resolved from raw records
-- Verified supply is a provider whose status has moved past 'audited'.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- Where data comes from. trust (0-100) decides which source wins when
-- resolved providers merge conflicting field values.
create table if not exists source (
    id          text primary key,
    name        text not null,
    kind        text not null check (kind in
                  ('registry', 'association', 'map', 'social', 'marketplace', 'field', 'manual')),
    licence     text,           -- terms we hold the data under (ODbL, govt open data, own collection...)
    url         text,
    trust       smallint not null default 50 check (trust between 0 and 100),
    notes       text
);

create table if not exists category (
    id          text primary key,
    parent_id   text references category(id),
    name        text not null,
    mode        text check (mode in ('travel', 'weekend', 'everyday')),
    kind        text not null default 'operator' check (kind in ('operator', 'venue', 'agency'))
);

-- Destination clusters. Nested boxes are fine (Havelock inside Andaman);
-- a provider is assigned to the smallest box containing it.
create table if not exists destination (
    id          text primary key,
    name        text not null,
    state       text not null,
    kind        text not null,
    mode        text not null check (mode in ('travel', 'local')),
    bbox        geometry(Polygon, 4326) not null
);
create index if not exists destination_bbox_idx on destination using gist (bbox);

create table if not exists raw_record (
    id           bigserial primary key,
    source_id    text not null references source(id),
    external_id  text not null,
    fetched_at   timestamptz not null default now(),
    expires_at   timestamptz,          -- set for sources whose terms limit caching (Google Places)
    name         text,
    phone        text,                 -- E.164
    email        text,
    website      text,
    instagram    text,                 -- handle, lowercase, no @
    address      text,
    state        text,
    categories   text[] not null default '{}',
    geom         geography(Point, 4326),
    payload      jsonb not null default '{}',
    unique (source_id, external_id)
);
create index if not exists raw_record_geom_idx on raw_record using gist (geom);

create table if not exists provider (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    legal_name      text,
    gstin           text,
    phone           text,
    email           text,
    website         text,
    instagram       text,
    address         text,
    state           text,
    destination_id  text references destination(id),
    categories      text[] not null default '{}',
    geom            geography(Point, 4326),
    source_count    int not null default 1,
    status          text not null default 'lead' check (status in
                      ('lead', 'contacted', 'met', 'audited', 'signed', 'filmed', 'live',
                       'rejected', 'dormant')),
    quality_score   smallint,
    locked          boolean not null default false,  -- field-team edits survive re-resolution
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists provider_geom_idx on provider using gist (geom);
create index if not exists provider_name_trgm_idx on provider using gin (name gin_trgm_ops);
create index if not exists provider_destination_idx on provider (destination_id);
create index if not exists provider_categories_idx on provider using gin (categories);

-- Which raw records were resolved into which provider.
create table if not exists provider_source (
    raw_record_id  bigint primary key references raw_record(id) on delete cascade,
    provider_id    uuid not null references provider(id) on delete cascade,
    matched_at     timestamptz not null default now()
);
create index if not exists provider_source_provider_idx on provider_source (provider_id);

create table if not exists licence (
    id           bigserial primary key,
    provider_id  uuid not null references provider(id) on delete cascade,
    kind         text not null check (kind in
                   ('gst', 'padi', 'ssi', 'state_adventure', 'tourism_dept', 'water_sports',
                    'insurance', 'fssai', 'trade', 'other')),
    number       text,
    issuer       text,
    valid_from   date,
    valid_until  date,
    document_url text,
    verified_by  text,
    verified_at  timestamptz
);
create index if not exists licence_expiry_idx on licence (valid_until);

create table if not exists audit (
    id           bigserial primary key,
    provider_id  uuid not null references provider(id) on delete cascade,
    audited_at   timestamptz not null default now(),
    auditor      text not null,
    checklist    jsonb not null default '{}',
    result       text not null check (result in ('pass', 'conditional', 'fail')),
    notes        text
);

create table if not exists pipeline_event (
    id           bigserial primary key,
    provider_id  uuid not null references provider(id) on delete cascade,
    from_status  text,
    to_status    text not null,
    at           timestamptz not null default now(),
    by           text,
    note         text
);

create table if not exists experience (
    id                  uuid primary key default gen_random_uuid(),
    provider_id         uuid not null references provider(id) on delete cascade,
    category_id         text not null references category(id),
    title               text not null,
    description         text,
    duration_minutes    int,
    price_min_inr       int,
    price_max_inr       int,
    capacity_per_slot   int,
    min_age             smallint,
    safety_critical     boolean not null default false,
    cancellation_policy text,
    season_months       smallint[],   -- 1-12
    status              text not null default 'draft' check (status in ('draft', 'live', 'paused'))
);

create table if not exists media (
    id                 bigserial primary key,
    experience_id      uuid not null references experience(id) on delete cascade,
    url                text not null,
    filmed_by          text not null check (filmed_by in ('host', 'affiliate', 'yuvoy')),
    rights             text,
    moderation_status  text not null default 'pending' check (moderation_status in
                         ('pending', 'approved', 'rejected'))
);

-- Price and review benchmarks seen on other platforms. Observations only;
-- never copy listing content.
create table if not exists competitor_listing (
    id            bigserial primary key,
    provider_id   uuid not null references provider(id) on delete cascade,
    platform      text not null,
    url           text,
    price_inr     int,
    rating        numeric(2, 1),
    review_count  int,
    observed_at   timestamptz not null default now()
);

-- DPDP Act 2023: lawful basis for holding a provider's contact data, and opt-outs.
create table if not exists contact_consent (
    provider_id   uuid primary key references provider(id) on delete cascade,
    basis         text not null check (basis in ('public_business_listing', 'consent', 'contract')),
    obtained_at   timestamptz not null default now(),
    opted_out_at  timestamptz
);

-- Destination x category density: the "where next" heatmap.
create or replace view destination_density as
select d.id as destination_id, d.name, d.state, d.mode, c as category, count(*) as providers
from provider p
join destination d on d.id = p.destination_id
cross join lateral unnest(p.categories) as c
where p.status <> 'rejected'
group by d.id, d.name, d.state, d.mode, c;
