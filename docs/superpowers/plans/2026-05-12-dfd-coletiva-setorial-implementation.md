# DFD Coletiva Setorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build shared sector rooms where members add collective DFD items and chefias convert the room into one or more official DFDs.

**Architecture:** Add a room layer over the existing `dfd_collective_contributions` table. Keep aggregation and expense-class splitting in pure TypeScript helpers, expose room operations through authenticated Next.js route handlers, then render member/chefia workflows in `/dfds-coletivas` and `/dfds-coletivas/[id]`.

**Tech Stack:** Next.js App Router, React client pages, Supabase/Postgres with RLS, TypeScript helper tests using `node:test`, existing shadcn-style UI primitives.

---

### Task 1: Domain Rules And Tests

**Files:**
- Modify: `src/lib/collective-dfd.ts`
- Modify: `src/lib/collective-dfd.test.ts`

- [x] **Step 1: Write failing tests**

Add tests proving that room status permissions work, participants carry avatar URLs, and contributions split into official DFD groups by expense class.

- [x] **Step 2: Run test and verify RED**

Run: `node --test --experimental-strip-types src/lib/collective-dfd.test.ts`
Expected before implementation: FAIL because helpers such as `canEditCollectiveRoom`, `summarizeCollectiveRoom`, and `splitCollectiveItemsByExpenseClass` are missing.

- [ ] **Step 3: Implement helpers**

Add exported types and helpers:
- `CollectiveRoomStatus`
- `CollectiveRoomRole`
- `canEditCollectiveRoom`
- `canEditCollectiveContribution`
- `summarizeCollectiveRoom`
- `splitCollectiveItemsByExpenseClass`

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/collective-dfd.test.ts`
Expected: PASS.

### Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260512103000_collective_dfd_rooms.sql`

- [ ] **Step 1: Add room schema**

Create `dfd_collective_rooms`, add nullable `room_id` to `dfd_collective_contributions`, add `user_avatar_url`, add room DFD link table, and add event table.

- [ ] **Step 2: Add RLS**

Permit members of the same unit to read/open/add contributions, permit owners to edit their own open contributions, permit chefia/admin to update rooms and convert, and keep converted/archived rooms read-only for members.

### Task 3: API Layer

**Files:**
- Create: `src/app/api/collective-rooms/route.ts`
- Create: `src/app/api/collective-rooms/[id]/route.ts`
- Create: `src/app/api/collective-rooms/[id]/contributions/route.ts`
- Create: `src/app/api/collective-rooms/[id]/contributions/[contributionId]/route.ts`
- Create: `src/app/api/collective-rooms/[id]/convert/route.ts`
- Create: `src/lib/collective-room-api.ts`

- [ ] **Step 1: Implement shared API helpers**

Add auth/profile resolution, unit membership checks, chefia checks, room loading, event insertion, and payload sanitizers.

- [ ] **Step 2: Implement room list/create/detail/update**

`GET /api/collective-rooms` lists rooms visible to the user. `POST /api/collective-rooms` creates an open room. `GET /api/collective-rooms/[id]` returns room, participants, aggregated items, raw contributions, linked DFDs, and events. `PATCH /api/collective-rooms/[id]` lets chefia update title, description, scope, or status.

- [ ] **Step 3: Implement contribution add/edit/delete**

Members can add in open rooms. Members edit/delete only their own open contributions. Chefia can edit/delete any open room contribution with event history.

- [ ] **Step 4: Implement conversion**

Chefia validates room, aggregates active contributions, splits by expense class, creates official DFDs and `dfd_items`, links them in `dfd_collective_room_dfds`, marks contributions consolidated, marks room converted, and records events.

### Task 4: Room UI

**Files:**
- Create: `src/app/(dashboard)/dfds-coletivas/page.tsx`
- Create: `src/app/(dashboard)/dfds-coletivas/[id]/page.tsx`

- [ ] **Step 1: Build list page**

Render filters, create-room form, room list with status, participant count, item count, estimated value, user contribution marker, and links to details.

- [ ] **Step 2: Build detail page**

Render header, editable chefia metadata, participants with avatar/photo, grouped items, per-user distribution, catalog search, contribution form, event history, linked official DFDs, and chefia conversion action.

### Task 5: Navigation And Cart Integration

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(dashboard)/catalogo/page.tsx`

- [ ] **Step 1: Add sidebar entry**

Add "DFDs Coletivas" in Meu Espaco for members and in Chefia for chefias/superadmin.

- [ ] **Step 2: Add cart action**

Add a cart drawer action to send selected items to an open collective room via the new API, without breaking the existing DFD creation flow.

### Task 6: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests**

Run: `node --test --experimental-strip-types src/lib/collective-dfd.test.ts`

- [ ] **Step 2: Run lint**

Run: `npm run lint`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Review git diff**

Run: `git diff --stat` and inspect feature files before final response.
