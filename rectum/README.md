# rectum/ — the clipper keys' glue

The clipper itself is its own repo (`~/projects/mediaStudio/rectum`). The deck's
four rectum keys (`plugin/src/actions/rectum.ts`) shell out to its CLI —
`python3 -m rectum left|right|crop|grab` — and own nothing but the key face.
Anything that composes rectum with another tool for a deck key lives here.
Nothing does yet; the image-routing draft is in `archive/grab-router/`.
