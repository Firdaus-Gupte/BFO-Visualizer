# BFO / CCO Visualizer

Click [here](https://firdaus-gupte.github.io/BFO-Visualizer/) to use the tool.

A clean, beautiful, **pedagogical** browser for exploring the
[Basic Formal Ontology (BFO)](https://basic-formal-ontology.org/) and the
[Common Core Ontologies (CCO)](https://github.com/CommonCoreOntology/CommonCoreOntologies), built using Claude Code.



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

Click [here](https://firdaus-gupte.github.io/BFO-Visualizer/) to use the tool.




---


## Features currently implemented

- Zoomable circle-packing hierarchy with smooth animated transitions
- Progressive disclosure (focus + children + faint grandchildren only)
- Click-to-zoom, background-click / breadcrumb / Reset to zoom out
- Leaf classes open the info panel instead of zooming
- Shared pastel color per sibling group
- BFO (solid) vs CCO (dashed + badge) styling
- Manual pan & wheel-zoom (secondary to guided click-to-zoom)
- Hover enlarge/glow + minimal tooltip
- Full-ontology search (label / id / definition) with jump-to-class
- Info panel: label, source, identifier/IRI, definition, examples,
      parent, subclasses, OWL restrictions
- BFO-only / BFO + CCO scope toggle

---

