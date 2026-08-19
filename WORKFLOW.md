# Engineering Workflow

All engineering tasks follow this workflow.

## Roles

* **Orchestrator** — plans, assesses risk, routes work, and owns completion.

* **Backend** — implements backend changes.

* **Frontend** — implements frontend changes.

* **QA** — independently verifies behavior using browser, accessibility, usability, performance, and regression testing as relevant. Follows `docs/QA.md`.

* **Review** — continuously checks whether the **model matches the concept** and the **code matches the contract**. Follows `docs/REVIEW.md`. Reports; does not fix.

**Self-review does not count as review.** Filling an empty field looks reasonable while
writing it and only reads wrong later — the author is the one person who cannot see it.
Every model-level defect so far (`Transfer.kind`, a fallback naming an unknown recipient
"me", a past event reading today's supply, the client counting name collisions inside its
own list) survived self-review and was found by the user.

**Review does not write code.** Five sessions share one worktree, so two writers in the
same directory overwrite each other — and a reviewer who fixes loses the independence that
is the entire point. Review sends findings **straight to the owning session**, not through
the Orchestrator; only contract changes come to the Orchestrator.

---

## Workflow

```text id="jyxtur"

Request

  ↓

Orchestrator

  ├─ Define acceptance criteria

  ├─ Identify affected areas

  ├─ Assess risk

  └─ Define verification

  ↓

Implementation

  ├─ Backend if affected

  └─ Frontend if affected

  ↓

Self-review

  ↓

Cross-review if FE/BE boundary changed

  ↓

Relevant QA if needed

  ↓

HIGH risk → Orchestrator deep review

  ↓

Final gate

```

Use the minimum workflow necessary for the identified risk.

Do not invoke agents or verification steps that do not add meaningful confidence.

---

## Risk

### LOW

Isolated, well-understood changes with limited impact and easy recovery.

Examples:

* styling/copy

* isolated UI changes

* straightforward bug fixes

* behavior-preserving refactors

Typical flow:

```text id="w8qqgi"

Implement → Self-review → Relevant checks → Done

```

### MEDIUM

Changes with meaningful behavioral, contract, or regression risk.

Examples:

* API changes

* validation changes

* new user flows

* state-management changes

* schema changes

* cross-component behavior

Typical flow:

```text id="7l8fp8"

Implement → Self-review → Cross-review if needed → QA → Done

```

### HIGH

Changes with significant security, data, operational, or user impact.

Examples:

* auth/authz

* payments

* sensitive data

* destructive operations

* risky migrations

* data integrity

* concurrency/idempotency

* critical infrastructure or flows

Typical flow:

```text id="ryv96a"

Implement

→ Self-review

→ Cross-review if needed

→ Relevant QA

→ Orchestrator deep review

→ Done

```

Risk determines **verification depth**, not which agents must participate.

---

## Implementation

Implementation agents must:

1. Understand the acceptance criteria and existing behavior.

2. Implement only the assigned scope.

3. Run relevant tests, type checks, and lint checks.

4. Self-review the resulting diff.

5. Report unresolved concerns.

Passing tests alone does not imply completion.

---

## Cross-Review

Cross-review is required when Frontend and Backend share a **changed contract or assumption**.

It is not a general second code review. It is also not a substitute for **Review** —
cross-review is bounded to one change, Review runs continuously and owns the question
"does the contract still describe what the code does".

**Frontend reviewing Backend:**

* API contracts

* response/error behavior

* auth behavior

* null/optional states

* frontend-visible failure behavior

**Backend reviewing Frontend:**

* API usage

* validation/auth assumptions

* retries and duplicate requests

* state transitions

* concurrency/idempotency assumptions

* unintended backend side effects

If the FE/BE boundary did not meaningfully change, skip cross-review.

---

## QA

QA provides independent behavioral verification when it adds meaningful confidence.

Select only relevant checks:

| Change                         | Verification       |

| ------------------------------ | ------------------ |

| User-visible behavior          | Functional/browser |

| UI structure or interaction    | Accessibility      |

| New/changed user flow          | Usability          |

| Performance-sensitive behavior | Performance        |

| Meaningful regression risk     | Regression         |

QA is not mandatory for every LOW-risk task.

For bug fixes, reproduce the original failure when practical.

---

## HIGH-Risk Review

For HIGH-risk changes, the Orchestrator performs the final focused review.

Review the risk-bearing parts of the change, especially:

* security/auth boundaries

* data integrity

* migration/destructive behavior

* concurrency/idempotency

* failure and recovery behavior

* unresolved review/QA findings

Do not repeat a general code review.

---

## Findings and Rework

Findings are either:

* **BLOCKING** — must be resolved before completion.

* **NON_BLOCKING** — may be recorded separately.

Blocking findings return to the owning agent:

```text id="ngqt5s"

Finding

→ Fix

→ Self-review

→ Re-run affected verification

```

Only repeat verification invalidated by the fix.

If implementation reveals new risk, unexpected scope, or a changed system boundary, stop expanding scope and return to the Orchestrator for replanning.

---

## Completion

The Orchestrator marks the task complete when:

* acceptance criteria are satisfied

* implementation and self-review are complete

* required checks pass

* required cross-review is complete

* required QA is complete

* blocking findings are resolved

* HIGH-risk review is complete when applicable

Completion requires evidence, not agent confidence.

---

## Decision Rules

```text id="k73sxy"

Backend affected?

→ Backend

Frontend affected?

→ Frontend

FE/BE contract or shared assumption changed?

→ Cross-review

Behavior needs independent verification?

→ Relevant QA

HIGH risk?

→ Orchestrator deep review

```

&gt; **Risk determines verification depth.

&gt; Affected behavior determines verification type.

&gt; Changed boundaries determine cross-review.**

