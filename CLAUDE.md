# Gn0me Home site

## Keep "What's New" up to date

Staff see a log of site changes at `/whats-new`, with a page-to-page walkthrough. Its entries live in `content/whats-new.ts`.

Whenever a change is something members or staff will notice (a new page or feature, a renamed or moved menu item, a changed workflow, a visible fix, or a privacy change), add an entry to `content/whats-new.ts` in the same commit:

- Put it at the top of the list, under a comment for that day, dated the day it ships (`YYYY-MM-DD`).
- Give it a new, unique `id` (e.g. `2026-10-13-short-name`), and never change an existing entry's `id`.
- Write for clan staff, not developers. Say what changed, where to find it, and how to try it. Plain words, no file names or code.
- Set `audience` to who can use it: `everyone`, `staff`, or `admin` (admin panel only).
- Put the most relevant page first in `links`. That's where the walkthrough takes people.

Skip it for changes nobody using the site would notice, such as refactors, dependency bumps, or build fixes.
