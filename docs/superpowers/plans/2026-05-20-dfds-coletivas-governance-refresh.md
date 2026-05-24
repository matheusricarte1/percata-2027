# DFDs Coletivas Governance Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `DFDs coletivas` around coautoria entre pares with chefia ownership, proposal publishing, explicit authority transitions, and pre-conversion multi-DFD preview.

**Architecture:** Extend the collective room domain with proposal/publishing/consolidation states and chefia-adjustment metadata, then update the Next.js API layer and both collective room UIs to reflect the new governance model. Keep the official DFD conversion path on the existing `dfds`/`dfd_items` structures.

**Tech Stack:** Next.js App Router, React client pages, TypeScript domain helpers, Supabase/Postgres migrations and route handlers, `node:test`, ESLint, Next build.

---

## File map

- Modify: `src/lib/collective-dfd.ts`
- Modify: `src/lib/collective-dfd.test.ts`
- Modify: `src/lib/collective-room-api.ts`
- Modify: `src/app/api/collective-rooms/route.ts`
- Modify: `src/app/api/collective-rooms/[id]/route.ts`
- Modify: `src/app/api/collective-rooms/[id]/contributions/route.ts`
- Modify: `src/app/api/collective-rooms/[id]/contributions/[contributionId]/route.ts`
- Modify: `src/app/api/collective-rooms/[id]/convert/route.ts`
- Modify: `src/app/(dashboard)/dfds-coletivas/page.tsx`
- Modify: `src/app/(dashboard)/dfds-coletivas/[id]/page.tsx`
- Create: `supabase/migrations/20260520090000_collective_room_governance_refresh.sql`

## Execution blocks

### Task 1: Domain states and tests
- [ ] Expand room statuses to `proposta`, `aberta`, `em_consolidacao_chefia`, `pronta_para_conversao`, `convertida`, `arquivada`.
- [ ] Add helper rules for contribution/edit/publish/reopen/convert visibility.
- [ ] Add tests for proposal visibility semantics, member control loss after `aberta`, and multi-DFD readiness.

### Task 2: Database and API
- [ ] Add room publishing fields and chefia-adjustment fields on contributions.
- [ ] Make room creation produce `proposta` for members and `aberta` for chefia.
- [ ] Restrict proposal visibility to proposer + chefia + admin.
- [ ] Restrict conversion to `pronta_para_conversao`.
- [ ] Persist chefia adjustments and discard events.

### Task 3: Room list UX
- [ ] Replace generic status browsing with operational tabs: proposals, abertas, consolidação, finalizadas.
- [ ] Update creation copy to distinguish proposal vs direct publication.
- [ ] Remove final rooms from the main operational view and move them to `Finalizadas`.

### Task 4: Room detail UX
- [ ] Rebuild stage model around governance regimes instead of generic steps.
- [ ] Add proposal state with publish action for chefia.
- [ ] Make collaboration editable only in `aberta`.
- [ ] Make consolidation/review explicitly owned by chefia.
- [ ] Add multi-DFD preview before conversion.
- [ ] Show chefia-adjusted badges and history.

### Task 5: Verification
- [ ] Run `node --test --experimental-strip-types src/lib/collective-dfd.test.ts`
- [ ] Run `npm run lint`
- [ ] Run `npm run build`

