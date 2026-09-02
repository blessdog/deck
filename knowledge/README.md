# knowledge/

The project's **typed claims**. One file per claim, frontmatter is the type.

Why this exists: markdown notes gave every statement the type `string`, so a
law, a measured verdict, a refuted hypothesis and somebody's guess were
indistinguishable, and nothing could check or retire any of them. Discoveries
were re-derived session after session, and worse, dead beliefs kept being acted
on. Measured (TEPA, arXiv 2608.07429): under a reversal, append-only memory
scores 0.210 and NO MEMORY AT ALL scores 0.309 — an append-only store is worse
than amnesia, because amnesia fails honestly and a stale note fails
persuasively. Explicit revocation scores 0.950.

## The type

    Claim = law       { text }
          | verdict   { text, scope, evidence }
          | refuted   { text, mechanism }
          | procedure { text, applies-when, not-when, route, sibling }
          | open      { text, proven: false }

Every claim also carries `id`, `kind`, `conflict-key`, `status`, and
**`asked-as`** — at least two questions a PERSON would actually type to find it,
in their words rather than the file's. That gap is the vocabulary problem
(Furnas, Landauer, Gomez & Dumais, CACM 1987: under 0.20 that two people pick
the same term for the same thing), and one person writing both the claim and its
only query is exactly the trap. `check-retrieval.py` asserts every declared
question returns its own claim in the top 3, so findability is a tested property
rather than a hope — measured on the day it was added, 44 of 44 real questions
returned the wrong claim or nothing.

- **law** — absolute, no exceptions. Usually the user's own words.
- **verdict** — measured, and only true inside `scope`. A verdict proven on one
  part of a problem is a *hypothesis* about the rest of it.
- **refuted** — a dead end someone already paid for. `mechanism` says WHY, so
  the lesson transfers instead of just the outcome.
- **procedure** — a route that is currently believed. `sibling` names the
  confusable one, because the classic failure is picking the neighbour.
- **open** — a plan. `proven: false` is mandatory. Do not build against it.

## The collector

`conflict-key` names the QUESTION a claim answers, and **at most one live claim
may answer each question**. Superseding means moving the old file to `archive/`,
setting `status: superseded`, and naming it in the new claim's `supersedes:`.
Git keeps the audit trail for free. Liveness here is reachability, not age: an
archived claim is still readable, it just cannot be reached by a query.

## Tools (global, work in any project)

    ~/.claude/knowledge/bin/check-knowledge.py            # type-check the store
    ~/.claude/knowledge/bin/find-technique.py "<situation>"  # query it
    ~/.claude/knowledge/bin/find-technique.py --brief     # the one-line index
    ~/.claude/knowledge/bin/check-routing.py --config X   # pipeline configs must
                                                          # name a LIVE claim id
    ~/.claude/knowledge/bin/check-retrieval.py            # is every claim findable
    ~/.claude/knowledge/bin/knowledge-bookmark.py "..."   # record a deferral NOW
    ~/.claude/knowledge/bin/state-report.py               # regenerate STATE.md

A PostToolUse hook type-checks AND retrieval-tests this directory on every
write; a SessionStart hook puts the index into every session's context; a Stop
hook regenerates STATE.md.

## Three layers, and only one is typed by hand

| layer | what it holds | where | who writes it |
|---|---|---|---|
| **CLAIM** | a rule, a measurement, a dead end, a route | `knowledge/` | you, typed |
| **NARRATIVE** | what was tried and what happened | `docs/journal/`, commits | you, as a story |
| **STATUS** | what exists right now | `STATE.md` | GENERATED from the repo |

`status.sh` in this directory is an executable that prints whatever THIS project
counts; `state-report.py` runs it and inlines the output. Hand edits to
`STATE.md` are destroyed on the next run — a status file written by hand is a
cache of the repository with no invalidation.
