# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: Joshua Senining, a full-stack and mobile developer in the Philippines (UTC+8),
working alone. Confirmed 10 Oct 2026: just him, mostly on a desktop or laptop browser; a
phone is secondary. No other users, roles or accounts — the app has no auth, and the
deployment sits behind Vercel Authentication.

## Product Purpose

A personal lead-generation engine. Every night it harvests contract, full-time and founder
leads from public job boards and finds local businesses (geo prospects) from OpenStreetMap;
it scores them deterministically against a fixed profile, and a model drafts outreach into
Gmail **as drafts only** for him to review and send by hand. Success is replies and paid
work — measured by logged outcomes (sent, replied, call booked, won, lost).

## Positioning

Built around one person's real profile and honesty rules: every claim in an outreach email
must trace to `memory/PROFILE.md`, nothing is ever sent automatically, and the app explains
its own numbers (why a lead scored what it did, what a reweighting would change, why a site
was not measured) instead of hiding them.

## Operating Context

- Daily triage at a desk: the Inbox (today's scored leads), Follow-ups (a day-4 / day-11
  ladder), Find prospects (a work queue of local businesses with contact buttons),
  All leads (what the filter turned away), Weekly review (reply rates by angle, source,
  stack and send day), Settings (Gmail and source health), and each lead's detail and draft.
- Keyboard triage on the Inbox (j/k, Enter, e, a, f, x, ?).
- Contact happens outside the app: WhatsApp links, Gmail drafts or a mail-app fallback,
  each recorded with an explicit "I sent it".

## Capabilities and Constraints

- Next.js 15 App Router, TypeScript, Tailwind with a replaced spacing scale (keys 0–12),
  Neon Postgres (ap-southeast-1), Vercel Hobby in sin1 (non-commercial), GitHub Actions
  as the scheduler.
- Single user; no multi-tenancy, billing or sign-up.
- Never sends email: drafts only.
- Data-heavy screens: tables, counts, scores, tiers (live / reachable / long shot),
  statuses, measured site findings.

## Brand Commitments

- Name: Lead Engine.
- Visual reference pinned by the user on 10 Oct 2026: the "Pivora — CRM Dashboard" shot on
  Dribbble (https://dribbble.com/shots/26737102-Pivora-CRM-dashboard) — follow its
  typography, spacing, colour and layout language.
- Light and a matching dark theme, following the system setting.

## Evidence on Hand

Real data only: harvested leads, prospects, outreach and outcomes in the database. No
testimonials, customers or metrics exist to quote, and none may be invented.

## Product Principles

1. Honest over impressive: a number on screen must be true, and its reason findable.
2. One person's daily work comes first: fast to scan, fast to act on, keyboard-friendly.
3. Nothing leaves without a human: the app prepares, the person sends.
4. Explain the machine: every score, filter and refusal says why.
