# rectum/ — the clipper keys' glue

The clipper itself is its own repo (`~/projects/mediaStudio/rectum`). The deck's
four rectum keys (`plugin/src/actions/rectum.ts`) shell out to its CLI —
`python3 -m rectum left|right|crop|grab` — and own nothing but the key face.
Anything that composes rectum with another tool for a deck key lives here.
Nothing does yet. GRAB takes video, photos, or both from one URL — rectum does
that itself since 2026-09-17; the older deck-side image router is in
`archive/grab-router/` with the reason it was not revived.
