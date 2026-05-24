# PRD: Demand Forecast Page

**Product:** NYC DemandMap
**Author:** Dan
**Status:** Draft v0.1
**Date:** 2026-04-05

---

## Problem Statement

The demand forecast is currently a teaser visual on the auth landing page — users see an 8-hour bar chart and a "pax/hr vs historical" readout, but have no way to interact with it after signup. Drivers and fleet managers who come to DemandMap specifically to plan around predicted demand have no dedicated surface to explore the forecast across time horizons, compare against historical baselines, or share a view with teammates. Without this, DemandMap's central value promise ("predict hyperlocal demand") is only delivered inside adjacent surfaces (map, planner, routes) and never as a first-class experience.

## Goals

1. **Deliver the landing page promise.** Give every signed-in user a dedicated `/forecast` page that matches and extends the forecast teaser from the auth landing.
2. **Drive engagement with the forecast itself.** Reach 40% of weekly active users visiting `/forecast` at least once per week within 60 days of launch.
3. **Increase session depth.** Lift median session time on Forecast to 2:00+ and average zones explored per session to 3+.
4. **Establish a returnable surface.** 30%+ of Forecast viewers return to the page within 7 days.
5. **Ship a tight, opinionated v1** in one release — not a configurable analytics tool.

## Non-Goals

1. **No custom forecast models or tunable parameters.** Users cannot change model assumptions, weights, or input variables — this is a consumption surface, not a modeling tool.
2. **No weather scenario comparison in v1.** Weather is displayed as context only; scenario toggling is a P2.
3. **No export/reporting.** CSV download, PDF reports, and scheduled emails are out of scope for v1.
4. **No fleet-specific staffing optimization.** Fleet managers get the same views as drivers in v1; dedicated staffing/dispatch workflows come later.
5. **No historical playback mode.** Users cannot "scrub backward" through past days beyond the historical comparison baseline.

## User Stories

**Driver (primary persona)**

- As a driver, I want to see predicted demand for the next hour, today, and the next 7 days so I can decide when and where to work.
- As a driver, I want to compare the current forecast to a typical day at the same hour and day-of-week so I know whether today is worth extra hours.
- As a driver, I want to see peak windows called out clearly so I don't have to read a chart to find them.
- As a driver, I want to drill into a specific zone on the map and see its forecast curve so I can pick where to position.

**Fleet manager (secondary persona, driver-first build)**

- As a fleet manager, I want the same time-horizon and historical-comparison views as drivers so I can share a single language with my team.
- As a fleet manager, I want to bookmark or link to a specific zone + time view so I can send it to a driver in Slack or text.

## Requirements

### Must-Have (P0)

**R1. Dedicated `/forecast` route** under the `(dashboard)` segment, in nav alongside Map, Planner, Routes.
- Acceptance: authenticated users see Forecast in nav; clicking routes to `/forecast`; page loads in < 1.5s p75.

**R2. Split-view layout.** Map on the left, charts/readouts on the right, with linked selection.
- Acceptance: clicking a zone on the map updates the chart panel; changing the time horizon updates both panels.

**R3. Time horizon selector** with three options: Next Hour, Today, Next 7 Days.
- Acceptance: selector is persistent on the page; selection updates all panels; default is "Today".

**R4. Historical comparison readout** ("+24% vs historical" style) visible at all times.
- Acceptance: baseline is same-hour, same-day-of-week, trailing 4-week average; percentage and direction shown with color.

**R5. Hourly demand bar chart** (extends the landing page teaser) with peak hour called out.
- Acceptance: shows pax/hr per hour for selected horizon; peak bar is visually distinct; hover reveals exact value.

**R6. Zone drilldown panel.** When a zone is selected, show its forecast curve, current vs historical delta, and peak window.
- Acceptance: selecting/deselecting a zone on the map toggles the panel; default state shows city-wide aggregate.

**R7. Shareable URL state.** Selected zone, time horizon, and timestamp are encoded in the URL.
- Acceptance: copying the URL and opening in a new tab restores the same view.

### Nice-to-Have (P1)

**R8. Fleet view toggle** — aggregate forecast across a manager's assigned zones/drivers.
- Acceptance: visible only for users with fleet role; toggles between "My view" and "Fleet view".

**R9. Day-of-week comparison** — small multiples showing Mon–Sun typical curves alongside today.

**R10. Weather context strip** — current conditions and next-6-hour forecast shown as contextual chrome (read-only).

### Future Considerations (P2)

- Weather scenario comparison (what-if toggles)
- Event-driven forecast callouts (concerts, sports, transit disruptions)
- Export / share-to-Slack
- Driver alert subscriptions ("notify me when my zone jumps 20%+")
- Historical playback / backtesting view

## Success Metrics

**Leading indicators (weekly, first 60 days)**

- % of WAU who visit `/forecast` at least once — target **40%**
- Median session duration on `/forecast` — target **≥ 2:00**
- Avg zones explored per session — target **≥ 3**
- Share URL copies per active user — target **≥ 0.5/week**

**Lagging indicators (by day 90)**

- 7-day return rate to Forecast — target **≥ 30%**
- Forecast → Planner/Routes conversion (user views forecast then creates a plan/route in same session) — target **≥ 20%**
- Retention lift: D30 retention for users who visit Forecast in week 1 vs those who don't — target **+10 pts**

## Open Questions

- **[data]** Is the historical baseline available at hourly × zone granularity for the 4-week trailing window? What's the backfill coverage for newer zones?
- **[engineering]** Does the existing forecast API support the Next 7 Days horizon, or does it need a new endpoint? What's the freshness SLA?
- **[design]** What's the empty state when a zone has insufficient history (e.g., new coverage area)?
- **[data]** How do we define "peak" — top hour, top 10% of hours, or a delta threshold vs historical?
- **[engineering]** What zone geometry do we use on the map (existing H3/hex layer from `/map` or a new aggregation)?
- **[legal]** Any disclaimers required on predicted-earnings-adjacent language ("pax/hr" implied earnings)?

## Timeline Considerations

- **Dependencies:** forecast API endpoints (confirm multi-horizon support), existing map zone layer, auth/role plumbing for P1 fleet toggle.
- **Suggested phasing:**
  - **Phase 1 (v1 launch):** R1–R7 (P0 scope). Single release.
  - **Phase 2 (+4 weeks):** R8–R10 (P1).
  - **Phase 3 (TBD):** P2 items pending v1 engagement signal.
- **No hard external deadlines** identified. Recommend targeting v1 ship before the next driver-growth push so Forecast can be a hero surface in onboarding.

---

## Next Steps

- Confirm data availability and API support with engineering (open questions above).
- Design: low-fi split-view layout + zone drilldown panel.
- Break P0 requirements into engineering tickets.
