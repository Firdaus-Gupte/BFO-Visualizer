# BFO / CCO Visualizer

A clean, beautiful, **pedagogical** browser for exploring the
[Basic Formal Ontology (BFO)](https://basic-formal-ontology.org/) and the
[Common Core Ontologies (CCO)](https://github.com/CommonCoreOntology/CommonCoreOntologies).

Most ontology tools are dense, arrow-filled graphs that overwhelm a learner.
This one does the opposite: it uses **nested circles** (circle packing) as the
visual metaphor for the subclass hierarchy, and reveals the ontology
**gradually**. You start at `Entity`, click one level at a time, and build a
mental map without ever seeing the whole graph at once.

![concept](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20vanilla%20JS%20%2B%20D3-blue)

---

## What it does

- Opens on the BFO root class **Entity** as a large circle.
- **Click a class** to smoothly zoom in; its direct subclasses appear nested
  inside, and grandchildren show as faint previews. Deeper levels stay hidden
  until you navigate further (*progressive disclosure*).
- **Click the background** (or a breadcrumb) to zoom back out.
- **Sibling classes share a pastel color**; when you zoom into one, its own
  children get a fresh shared color.
- **BFO vs CCO** is shown subtly: BFO circles have a solid border, CCO circles
  have a **dashed border** and a small **CCO** badge.
- **Breadcrumbs**, a prominent **current-focus** label + source badge, **Reset**,
  hover **tooltips**, **search**, and an **info panel** with the official
  metadata (definition, examples, identifier/IRI, parent, subclasses, OWL
  restrictions).
- **Scope toggle:** *BFO only* (default) or *BFO + CCO*.

---

## How to open it

Just open **`index.html`** in any modern browser. No server, no build step,
no `npm install`.

> One caveat: most browsers block `<script src>` from `file://` only in rare
> configurations. If a browser ever refuses to load the local scripts, run a
> tiny static server from this folder instead:
>
> ```bash
> python -m http.server 8777
> # then visit http://localhost:8777
> ```

The only external dependency is **D3 v7**, loaded from a CDN in `index.html`
(needed for the zoomable circle-packing layout and smooth transitions). An
internet connection is therefore needed the first time D3 loads; to go fully
offline, download `d3.min.js` and point the `<script>` tag at the local copy.

---

## Files

```
bfo-cco-visualizer/
  index.html              # markup + script/style includes
  styles.css              # all styling (clean, minimal, pastel)
  app.js                  # all app logic (circle packing, zoom, search, info…)
  ontology-data.js        # the FULL extracted ontology (auto-generated)
  sample-data.js          # a small hand-curated fallback slice
  tools/
    extract_ontology.py   # converts a .ttl file -> ontology-data.js (run offline)
  CommonCoreOntologiesMerged.ttl   # source ontology (BFO + CCO 2.1)
  README.md
```

`app.js` prefers `window.REAL_ONTOLOGY` (from `ontology-data.js`); if that file
is missing it falls back to `window.SAMPLE_ONTOLOGY` (from `sample-data.js`), so
the app always works.

---

## How the data structure works

The visualizer consumes a single JSON tree. Each node is one OWL class:

```js
{
  id: "BFO:0000040",                                  // short CURIE
  iri: "http://purl.obolibrary.org/obo/BFO_0000040",  // full IRI
  label: "material entity",
  source: "BFO",                                      // "BFO" | "CCO"
  definition: "An independent continuant that …",
  examples: ["a human being", "a portion of water"],
  restrictions: ["has continuant part only material entity"], // readable strings
  identifier: "019-BFO",
  otherParents: ["…"],   // optional: extra parents (multiple inheritance)
  children: [ /* nested nodes, omitted if the class is a leaf */ ]
}
```

The tree is a **spanning tree** of the class hierarchy rooted at
`BFO:0000001` (entity). A class with more than one parent is placed under the
first parent encountered; its other parents are recorded in `otherParents` and
shown in the info panel.

---

## Replacing the sample data with real BFO/CCO data

The included `ontology-data.js` was generated from
`CommonCoreOntologiesMerged.ttl` (BFO + CCO 2.1). To regenerate it from any
BFO/CCO Turtle file:

```bash
python tools/extract_ontology.py <your-ontology.ttl> ontology-data.js
```

`extract_ontology.py`:

- needs only the Python 3 standard library (no `rdflib`, no `pip install`);
- does a lightweight, block-based parse of the Turtle file;
- pulls labels, definitions (`skos:definition`), examples (`skos:example`),
  identifiers, `rdfs:subClassOf` parents, and OWL restrictions;
- infers `source` from the IRI (`…/obo/BFO_…` → BFO,
  `commoncoreontologies.org/ont…` → CCO);
- writes `window.REAL_ONTOLOGY = { … }`.

To hand-author data instead, just edit `sample-data.js` (or replace
`ontology-data.js`) following the structure above.

---

## Features currently implemented

- [x] Zoomable circle-packing hierarchy with smooth animated transitions
- [x] Progressive disclosure (focus + children + faint grandchildren only)
- [x] Click-to-zoom, background-click / breadcrumb / Reset to zoom out
- [x] Leaf classes open the info panel instead of zooming
- [x] Shared pastel color per sibling group
- [x] BFO (solid) vs CCO (dashed + badge) styling
- [x] Manual pan & wheel-zoom (secondary to guided click-to-zoom)
- [x] Hover enlarge/glow + minimal tooltip
- [x] Full-ontology search (label / id / definition) with jump-to-class
- [x] Info panel: label, source, identifier/IRI, definition, examples,
      parent, subclasses, OWL restrictions
- [x] BFO-only / BFO + CCO scope toggle

---

## Future features (intentionally not built yet)

- Runtime Turtle upload/parsing in the browser
- A **“show relations”** toggle for object properties
  (`has_part`, `part_of`, `participates_in`, `bearer_of`, `realized_in`, …).
  The code keeps the hierarchy as the central layer so this can be layered on
  later without restructuring.
- Richer OWL restriction handling / visualization
- Export the current view as PNG/SVG
- Save favorite paths/classes
- Official documentation deep-links
- **Beginner-friendly explanations**, kept clearly separate from the official
  ontology text (the info panel currently shows official text only, by design).

---

## A note on the design principle

The goal is to make BFO/CCO feel **navigable and learnable**. So, deliberately:
no dense web of arrows, no whole-graph dump, no technical completeness at the
expense of clarity. Start at `Entity`, click inward one level at a time, and let
the structure reveal itself.
