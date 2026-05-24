# DemandMap: SaaS Platform Rewrite Scope

**From:** CoffeeMap NYC (single-use coffee truck planner)
**To:** DemandMap (multi-vertical demand-driven supply planning platform)

**Date:** April 3, 2026
**Status:** Scoping Document

---

## The Opportunity

CoffeeMap NYC already solves a hard problem: it fuses census data, employment metrics, transit feeds, weather, and events into a real-time demand model that tells coffee truck operators *where to be and when*. That same engine applies to any mobile or event-based vendor who needs to match supply to demand -- food trucks, retail pop-ups, political canvassers, farmers market organizers, festival planners, and more.

The rewrite transforms a single-city, single-vertical tool into a multi-tenant SaaS platform with pluggable "demand profiles" per vertical.

---

## What We Keep (The Core Engine)

The current codebase has strong bones. These components carry forward with refactoring, not replacement:

- **Demand Model** (`demand-model.ts`, `opportunity.ts`) -- the land-use curve engine and composite scoring logic. This becomes the pluggable `DemandProfile` system.
- **Spatial Query Layer** (`spatial.ts`) -- PostGIS queries for radius searches, proximity scoring, and GeoJSON generation. These generalize cleanly.
- **Map Visualization** (`MapCanvas.tsx`) -- Mapbox GL choropleth rendering, layer toggling, and zoom-aware aggregation. Swap Mapbox for MapLibre to eliminate per-load costs.
- **Schedule Planner** (`SchedulePanel.tsx`, `useDailyPlan.ts`) -- daily route/stop planning with time windows. This becomes the universal "deployment planner."
- **Real-Time Feeds** (`gtfs-rt.ts`, `busyness.ts`) -- MTA feed parsing and station busyness. Generalize to support any GTFS-RT feed.
- **Data Ingestion Scripts** -- the pattern of downloading, parsing, and loading government datasets is reusable. Each new city gets its own ingestion config.

---

## Architecture: What Changes

### Multi-Tenancy Model

Each tenant (organization) gets an isolated workspace:

```
Tenant (org)
  ├── Users (roles: admin, planner, viewer)
  ├── City/Region (geographic scope with ingested data)
  ├── Vertical Profile (demand weights, competitor types, data sources)
  ├── Plans & Stops (operational schedules)
  └── Saved Views & Alerts
```

**Isolation strategy:** Row-level security in Supabase. Every table gets a `tenant_id` column. RLS policies enforce access at the database level -- no application-level filtering to get wrong.

### Pluggable Demand Profiles

The current hardcoded coffee demand model becomes a configurable profile system:

| Parameter | Coffee Truck | Food Truck | Political Canvass | Retail Pop-Up |
|-----------|-------------|------------|-------------------|---------------|
| Demand signals | Office density, commute patterns | Lunch crowds, nightlife, events | Voter registration density, demographics | Foot traffic, income levels, retail gaps |
| Competitor layer | Coffee shops (DOHMH) | Restaurants (health dept) | Opposing campaigns (manual) | Retail stores (POI data) |
| Time curves | Morning peak, afternoon dip | Lunch peak, evening peak | Weekday evenings, weekend days | Weekend peaks, holiday corridors |
| Scoring weights | Transit 30%, employment 40%, gap 30% | Events 35%, density 35%, transit 30% | Demographics 50%, density 30%, transit 20% | Income 40%, foot traffic 40%, gap 20% |

Profiles are stored as JSON configs that the demand engine reads at query time. Admins can tune weights through a UI slider panel (the current `ExplorerPanel` weight calibration, generalized).

### City Expansion

NYC is city #1. The data pipeline generalizes to any US city:

- **Census blocks + ACS demographics:** US Census API covers every state/county. Free, no rate limits.
- **Employment (LEHD/LODES):** Available for all 50 states. Same ingestion pattern.
- **Land use:** Varies by city. NYC has PLUTO; other cities use county assessor data or OpenStreetMap building footprints.
- **Transit (GTFS):** 10,000+ agencies worldwide publish GTFS feeds. The Transitland directory indexes them all.
- **Competitors:** Health department inspection data varies by jurisdiction. Supplement with OpenStreetMap POI data and Overpass API queries.

**V1 targets:** NYC (existing), plus 2-3 cities with strong open data -- Chicago, San Francisco, Washington DC.

---

## V1 Tech Stack (Free-Tier Optimized)

The goal: launch and operate at $0/month until meaningful traction, then scale paid services as revenue justifies.

### Swaps from Current Stack

| Current | V1 Replacement | Why |
|---------|---------------|-----|
| Mapbox GL ($) | **MapLibre GL JS + OpenFreeMap tiles** | Fully open-source, no per-load billing, same API surface |
| OpenWeather API (limited free) | **Open-Meteo** | No API key, no rate limits, better forecast data |
| Neon Postgres (0.5GB free) | **Supabase** (500MB + Auth + Storage + Realtime) | All-in-one: database, auth, file storage, row-level security, realtime subscriptions |
| No auth | **Supabase Auth** (50K MAU free) | Built-in with database, supports OAuth, magic links, MFA |
| No payments | **Stripe** (pay-per-transaction) | No monthly fee, only pay when customers pay you |
| No analytics | **PostHog** (1M events/month free) | Product analytics, session replay, feature flags, A/B testing |
| No email | **Brevo** (300 emails/day free) or **Resend** (3K/month) | Transactional emails for onboarding, alerts, reports |

### Full V1 Stack

```
Frontend:      Next.js 16 (App Router) + React 19 + TailwindCSS 4
Maps:          MapLibre GL JS + OpenFreeMap vector tiles
Database:      Supabase PostgreSQL + PostGIS extension
Auth:          Supabase Auth (OAuth, magic link, MFA)
ORM:           Prisma 6 (keep current, add RLS policies)
Payments:      Stripe (subscriptions + usage metering)
Email:         Brevo or Resend (transactional)
Analytics:     PostHog + Vercel Web Analytics
Weather:       Open-Meteo (free, no key)
Events:        PredictHQ (limited free) + city open data portals (Socrata)
Transit:       GTFS static + GTFS-RT via Transitland
Demographics:  US Census API + BLS API (free, unlimited)
Hosting:       Vercel (free tier: 100GB bandwidth, serverless functions)
Storage:       Supabase Storage (1GB free) for user uploads, exports
```

**Estimated monthly cost at launch: $0**
**Estimated cost at 100 active users: ~$0** (well within free tiers)
**Estimated cost at 1,000 active users: ~$50-100/month** (Supabase Pro + Vercel Pro)

---

## Feature Scope: V1

### Phase 1: Platform Foundation (Weeks 1-3)

**1.1 Multi-Tenant Database Migration**

- Add `tenant_id` to all existing tables (CensusBlock excluded -- shared reference data)
- Create new tables: `tenants`, `tenant_users`, `vertical_profiles`, `tenant_cities`
- Implement Supabase RLS policies on all tenant-scoped tables
- Migrate Prisma schema with tenant isolation

**1.2 Authentication & Onboarding**

- Supabase Auth integration (Google OAuth + magic link email)
- Tenant creation flow: org name, vertical selection, city selection
- Role-based access: admin (manage team + billing), planner (full edit), viewer (read-only)
- Onboarding wizard: pick vertical, pick city, customize demand weights

**1.3 MapLibre Migration**

- Replace `mapboxgl` imports with `maplibre-gl` (API is nearly identical)
- Swap tile source to OpenFreeMap vector tiles
- Update geocoding to use Nominatim (OSM) instead of Mapbox Geocoding
- Verify all choropleth layers, popups, and interactions work

### Phase 2: Generalized Demand Engine (Weeks 3-5)

**2.1 Demand Profile System**

- Abstract current coffee-specific constants into JSON profile configs
- Build profile editor UI (extend current weight sliders)
- Preset profiles for launch verticals: food truck, political canvass, retail pop-up, event planning
- Custom profile creation for power users

**2.2 Competitor Layer Abstraction**

- Replace `CoffeeShop` model with generic `CompetitorLocation` model
- Support multiple competitor types per profile (e.g., food truck profile tracks both restaurants and other food trucks)
- Allow manual competitor entry (pin-drop + details) for verticals without public data
- OpenStreetMap Overpass API integration for POI-based competitor detection

**2.3 Multi-City Data Pipeline**

- Parameterize ingestion scripts by city/state FIPS codes
- Build admin CLI for onboarding a new city: `npm run ingest -- --city chicago --state IL`
- Census blocks, ACS demographics, LEHD employment for any US geography
- GTFS feed auto-discovery via Transitland API

### Phase 3: User-Facing Features (Weeks 5-8)

**3.1 Dashboard & Analytics**

- Tenant home dashboard: top opportunities today, plan completion, team activity
- Historical demand trends (which blocks performed well over time)
- Weather-adjusted demand forecasting (Open-Meteo 7-day forecast integration)
- Exportable reports (PDF/CSV of top blocks, daily plans)

**3.2 Enhanced Schedule Planner**

- Drag-and-drop route builder with drive-time estimates (OSRM -- free, self-hostable)
- Recurring schedule templates (e.g., "every Tuesday morning route")
- Team assignment: assign plans to team members
- Mobile-optimized plan view for field operators

**3.3 Alerts & Notifications**

- Event-triggered alerts: "New street fair permitted near your top blocks this Saturday"
- Weather alerts: "Rain forecast Thursday -- consider indoor-adjacent blocks"
- Demand spikes: "Transit ridership 40% above baseline at Union Square"
- Delivery via email (Brevo/Resend) with in-app notification center

**3.4 Collaboration**

- Shared team workspace with role-based permissions
- Plan comments and notes
- Activity log (who changed what, when)

### Phase 4: Monetization & Growth (Weeks 8-10)

**4.1 Stripe Integration**

- Free tier: 1 city, 1 user, 5 saved plans, basic choropleth
- Starter ($29/mo): 1 city, 3 users, unlimited plans, all overlays, alerts
- Pro ($79/mo): 3 cities, 10 users, API access, custom profiles, priority support
- Enterprise (custom): unlimited cities, SSO, dedicated support, custom integrations

**4.2 Usage Metering**

- Track API calls, map loads, data exports per tenant
- Overage billing for heavy API users on Pro tier
- Usage dashboard in tenant settings

**4.3 Public Marketing Site**

- Landing page with vertical-specific messaging (food trucks, politics, retail)
- Interactive demo map (read-only, NYC data)
- Pricing page, docs, blog

---

## V2 Roadmap (Post-Launch Expansion)

These features justify upgrading to paid APIs and infrastructure:

| Feature | Service | Cost Trigger |
|---------|---------|-------------|
| **Foot traffic data** | SafeGraph / Placer.ai | $500+/mo -- add when revenue supports it |
| **Predictive demand ML** | Custom model on Hugging Face or Replicate | GPU inference costs at scale |
| **International expansion** | Country-specific census/transit data | Engineering time, not API costs |
| **Real-time competitor tracking** | Google Places API or Yelp Fusion | Per-query pricing |
| **SMS alerts** | Twilio | $0.0079/msg -- add on Pro tier |
| **Drive-time routing** | Mapbox Directions or Google Routes | Per-request pricing |
| **Custom data integrations** | Zapier / webhooks for POS, CRM | Engineering time |
| **White-label / embedded** | Custom deployment pipeline | Enterprise tier feature |

---

## Database Schema Changes

### New Tables

```sql
-- Tenant (organization)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  vertical TEXT NOT NULL, -- 'food_truck', 'political', 'retail', 'event', 'custom'
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users belong to tenants with roles
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id), -- Supabase Auth
  role TEXT DEFAULT 'viewer', -- 'admin', 'planner', 'viewer'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- City/region configurations per tenant
CREATE TABLE tenant_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  city_slug TEXT NOT NULL, -- 'nyc', 'chicago', 'sf'
  state_fips TEXT NOT NULL,
  county_fips TEXT[],
  is_active BOOLEAN DEFAULT true,
  data_version TEXT, -- track ingestion version
  UNIQUE(tenant_id, city_slug)
);

-- Pluggable demand profiles
CREATE TABLE demand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  config JSONB NOT NULL, -- weights, time curves, competitor types, scoring params
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generic competitor locations (replaces CoffeeShop)
CREATE TABLE competitor_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  city_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- configurable per vertical
  tier TEXT, -- quality tier (configurable)
  location GEOMETRY(Point, 4326),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  metadata JSONB, -- flexible per-vertical attributes
  source TEXT, -- 'manual', 'osm', 'health_dept', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts configuration
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'event', 'weather', 'demand_spike'
  config JSONB NOT NULL, -- trigger conditions
  delivery TEXT[] DEFAULT ARRAY['in_app'], -- 'email', 'in_app'
  is_active BOOLEAN DEFAULT true
);
```

### Modified Tables

```sql
-- DailyPlan: add tenant_id, assigned_user
ALTER TABLE daily_plans ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE daily_plans ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE daily_plans ADD COLUMN city_slug TEXT;

-- PlanStop: add tenant_id
ALTER TABLE plan_stops ADD COLUMN tenant_id UUID REFERENCES tenants(id);
```

### Shared Reference Data (No tenant_id)

These tables remain shared across all tenants -- they're public government data:

- `census_blocks` -- geometry + geography
- `block_hourly_demand` -- recomputed per profile at query time, or cached per (profile_id, geoid, time_window)
- `subway_stations` / `station_ridership_baselines`
- `nta_boundaries`

---

## Migration Strategy

The rewrite doesn't start from scratch. It's an incremental transformation:

**Step 1: Infrastructure swap** -- MapLibre, Open-Meteo, Supabase Auth. The app looks the same but runs on free services.

**Step 2: Multi-tenant shell** -- Add tenant tables, RLS policies, and onboarding flow. Existing NYC data becomes the "demo" tenant.

**Step 3: Generalize the engine** -- Abstract demand profiles, competitor layers, and time curves. Keep NYC coffee as the reference implementation.

**Step 4: Second city** -- Prove the pipeline works for Chicago or SF. This validates the multi-city architecture.

**Step 5: Second vertical** -- Build a political canvassing profile or food truck profile. This validates the demand profile system.

**Step 6: Monetize** -- Stripe integration, pricing tiers, public marketing site.

---

## Free Service Integration Summary

| Service | What It Replaces/Adds | Free Tier Limit | Risk Level |
|---------|----------------------|-----------------|------------|
| MapLibre GL JS | Mapbox GL ($) | Unlimited | None (open source) |
| OpenFreeMap | Mapbox tiles ($) | Unlimited | Low (community-run) |
| Open-Meteo | OpenWeather (limited) | Unlimited, no key | None |
| Supabase | Neon + custom auth | 500MB DB, 50K MAU | Low (generous free tier) |
| US Census API | Already used | Unlimited | None |
| BLS API | Already used | Unlimited | None |
| GTFS / Transitland | MTA-specific feeds | Unlimited | None (public standard) |
| OSM Overpass API | No competitor alt. | Rate-limited but free | Medium (rate limits) |
| Nominatim | Mapbox Geocoding ($) | 1 req/sec | Medium (self-host if needed) |
| PostHog | Nothing (new) | 1M events/mo | Low |
| Stripe | Nothing (new) | Pay-per-transaction | None |
| Brevo | Nothing (new) | 300 emails/day | Low |
| Vercel | Already used | 100GB bandwidth | Low |

---

## Estimated Timeline

| Phase | Scope | Duration | Milestone |
|-------|-------|----------|-----------|
| **Phase 1** | Foundation (auth, MapLibre, multi-tenant DB) | 3 weeks | Users can sign up and see the NYC map |
| **Phase 2** | Demand engine generalization | 2 weeks | Configurable profiles, generic competitors |
| **Phase 3** | User features (dashboard, alerts, mobile) | 3 weeks | Feature-complete for beta |
| **Phase 4** | Monetization + marketing | 2 weeks | Stripe live, public landing page |
| **Total** | | **10 weeks** | Production launch |

---

## Key Risks & Mitigations

**OpenFreeMap reliability:** Community-hosted tile server. Mitigation: can self-host tiles on Vercel Edge or fall back to Protomaps (another free option).

**Supabase 500MB limit:** PostGIS geometry data is large. NYC census blocks alone could approach this. Mitigation: store geometry in a shared Neon instance (reference data), keep tenant-specific data in Supabase. Or compress geometries with ST_SimplifyPreserveTopology.

**Nominatim rate limits:** 1 request/second for geocoding. Mitigation: implement client-side caching, batch geocoding during ingestion, self-host Nominatim if volume demands it.

**City data variability:** Not every city has PLUTO-equivalent land use data. Mitigation: fall back to OpenStreetMap building footprints + ACS housing data as universal proxies.

**Demand model accuracy across verticals:** Coffee truck demand signals differ from political canvassing. Mitigation: V1 profiles are "best guess" with tunable weights. User feedback loop refines them over time.
