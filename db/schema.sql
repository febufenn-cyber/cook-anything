-- Cook Anything — Postgres/Supabase schema (mirror of src/lib/types.ts)
-- The site currently runs on the JSON data layer in data/; this schema is the
-- upgrade path when the database moves to Supabase. scripts/export-recipes.ts
-- produces JSON that maps 1:1 onto these tables.

create table if not exists cuisines (
  slug text primary key,
  name text not null,
  country_slug text,
  region_slug text,
  blurb text not null default '',
  signature_ingredients text[] not null default '{}'
);

create table if not exists countries (
  slug text primary key,
  name text not null,
  continent text not null,
  blurb text not null default ''
);

create table if not exists regions (
  slug text primary key,
  name text not null,
  country_slug text not null references countries(slug),
  blurb text not null default ''
);

create table if not exists ingredients (
  slug text primary key,
  name text not null,
  name_ta text,
  name_hi text,
  category text not null,
  pantry_staple boolean not null default false,
  aliases text[] not null default '{}',
  allergens text[] not null default '{}'
);

create table if not exists methods (
  slug text primary key,
  name text not null,
  blurb text not null default '',
  indian_equivalent text
);

create table if not exists recipes (
  id text primary key,                    -- "ca-" || slug
  slug text unique not null,
  title text not null,
  native_title text,
  description text not null,
  cuisine_slug text not null references cuisines(slug),
  country_slug text not null references countries(slug),
  region_slug text references regions(slug),
  language text not null default 'en',
  meal_type text[] not null default '{}',
  diet_type text[] not null default '{}',
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  spice_level text not null check (spice_level in ('none','mild','medium','hot','very_hot')),
  budget_level text not null check (budget_level in ('budget','moderate','premium')),
  prep_time_minutes int not null check (prep_time_minutes >= 0),
  cook_time_minutes int not null check (cook_time_minutes >= 0),
  total_time_minutes int not null check (total_time_minutes = prep_time_minutes + cook_time_minutes),
  servings int not null check (servings between 1 and 12),
  cookware text[] not null default '{}',
  methods text[] not null default '{}',
  tags text[] not null default '{}',
  allergens text[] not null default '{}',
  nutrition jsonb,                        -- {calories, protein, ..., isEstimate}
  cultural_note text,
  regional_variation text,
  indian_kitchen_adaptation text,
  source text not null,
  source_url text,
  license text not null,
  author text not null,
  verification_status text not null check (verification_status in (
    'ai_drafted','editor_needed','community_submitted','public_domain_imported',
    'open_license_imported','licensed_partner','verified')),
  image text,
  image_license text,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  recipe_id text not null references recipes(id) on delete cascade,
  position int not null,
  name text not null,
  normalized_name text not null references ingredients(slug),
  quantity numeric,
  unit text,
  optional boolean not null default false,
  notes text,
  primary key (recipe_id, position)
);

create table if not exists recipe_steps (
  recipe_id text not null references recipes(id) on delete cascade,
  step_order int not null,
  text text not null,
  timer_minutes int,
  method_slug text references methods(slug),
  primary key (recipe_id, step_order)
);

create table if not exists recipe_substitutions (
  recipe_id text not null references recipes(id) on delete cascade,
  position int not null,
  ingredient_slug text not null references ingredients(slug),
  substitute text not null,
  notes text,
  primary key (recipe_id, position)
);

-- Community foundation (matches localStorage shapes used in the UI today)
create table if not exists profiles (
  id uuid primary key,                    -- references auth.users on Supabase
  display_name text,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists saved_recipes (
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id text not null references recipes(id) on delete cascade,
  collection text not null default 'Saved',
  saved_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists recipe_collections (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists recipe_submissions (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id),
  payload jsonb not null,                 -- full recipe draft in platform schema
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists recipe_ratings (
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id text not null references recipes(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review text,
  cooked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists recipe_reports (
  id bigint generated always as identity primary key,
  recipe_id text not null references recipes(id) on delete cascade,
  reason text not null,                   -- rights-issue | correction | safety | other
  detail text,
  reporter_contact text,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

-- Search-critical indexes
create index if not exists idx_recipes_cuisine on recipes(cuisine_slug);
create index if not exists idx_recipes_country on recipes(country_slug);
create index if not exists idx_recipes_total_time on recipes(total_time_minutes);
create index if not exists idx_recipes_diet on recipes using gin(diet_type);
create index if not exists idx_recipes_tags on recipes using gin(tags);
create index if not exists idx_recipe_ingredients_norm on recipe_ingredients(normalized_name);
create index if not exists idx_recipes_title_trgm on recipes using gin (title gin_trgm_ops); -- requires pg_trgm
