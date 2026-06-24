#!/usr/bin/env python3
"""
extract_ontology.py
===================

A small, standalone helper that converts a BFO/CCO Turtle (`.ttl`) file into the
clean JavaScript data structure consumed by the BFO/CCO Visualizer.

This script is intentionally NOT part of the browser app. The browser app only
ever loads the already-extracted `ontology-data.js`. Run this script once (or
whenever you update the ontology) to regenerate that file.

It does a lightweight, block-based parse of the Turtle file. It does NOT require
rdflib or any third-party packages -- only the Python standard library -- so it
runs anywhere Python 3 is installed.

Usage
-----
    python tools/extract_ontology.py CommonCoreOntologiesMerged.ttl ontology-data.js

What it extracts for every `owl:Class`:
    - IRI and a friendly CURIE / id
    - rdfs:label
    - source ontology (BFO or CCO), inferred from the IRI
    - skos:definition (official elucidation / definition text)
    - skos:example(s)
    - dc:identifier
    - named superclasses (rdfs:subClassOf <IRI>)
    - OWL restrictions (rendered as readable strings, info-panel only)

It then builds a single rooted tree starting at BFO:0000001 (entity). Classes
with more than one named parent are placed under the first parent reached during
a depth-first walk (and their other parents are recorded in `otherParents`).
"""

import re
import sys
import json

# Predicate / namespace fragments we look for.
BFO_PREFIX = "http://purl.obolibrary.org/obo/BFO_"
CCO_PREFIX = "https://www.commoncoreontologies.org/ont"
ROOT_IRI = "http://purl.obolibrary.org/obo/BFO_0000001"  # entity

# Regexes for the simple single-line annotation values used in this file.
RE_TYPE = re.compile(r"<([^>]+)>\s+rdf:type\s+owl:(\w+)")
RE_LABEL = re.compile(r'rdfs:label\s+"((?:\\.|[^"\\])*)"')
RE_DEF = re.compile(r'skos/core#definition>\s+"((?:\\.|[^"\\])*)"')
RE_EXAMPLE = re.compile(r'skos/core#example>\s+"((?:\\.|[^"\\])*)"')
RE_IDENT = re.compile(r'dc/elements/1\.1/identifier>\s+"((?:\\.|[^"\\])*)"')


def curie_for(iri):
    """Turn a full IRI into a short, display-friendly id."""
    if iri.startswith(BFO_PREFIX):
        return "BFO:" + iri[len(BFO_PREFIX):]
    if iri.startswith("https://www.commoncoreontologies.org/"):
        return "CCO:" + iri.rsplit("/", 1)[-1]
    return iri.rsplit("/", 1)[-1].rsplit("#", 1)[-1]


def source_for(iri):
    if iri.startswith(BFO_PREFIX):
        return "BFO"
    if iri.startswith(CCO_PREFIX):
        return "CCO"
    return None


def split_blocks(text):
    """Split the Turtle file into per-subject blocks delimited by `###  ` headers."""
    parts = re.split(r"(?m)^###  ", text)
    return parts[1:]  # drop the file preamble before the first `###`


def scan_superclasses(block, labels):
    """Return (named_parent_iris, restriction_strings) from the rdfs:subClassOf clause."""
    idx = block.find("rdfs:subClassOf")
    if idx == -1:
        return [], []
    i = idx + len("rdfs:subClassOf")
    n = len(block)
    parents = []
    restrictions = []
    while i < n:
        c = block[i]
        if c in "[(":
            # Capture the whole balanced bracket group (a blank node / list).
            start = i
            depth = 0
            while i < n:
                if block[i] in "[(":
                    depth += 1
                elif block[i] in "])":
                    depth -= 1
                i += 1
                if depth == 0:
                    break
            group = block[start:i]
            if "owl:Restriction" in group:
                restrictions.append(render_restriction(group, labels))
            continue
        if c == "<":
            j = block.index(">", i)
            parents.append(block[i + 1:j])
            i = j + 1
            continue
        if c in ";.":
            break  # first top-level separator ends the subClassOf clause
        i += 1
    return parents, [r for r in restrictions if r]


QUANTIFIERS = [
    ("someValuesFrom", "some"),
    ("allValuesFrom", "only"),
    ("hasValue", "value"),
    ("qualifiedCardinality", "exactly"),
    ("minQualifiedCardinality", "min"),
    ("maxQualifiedCardinality", "max"),
    ("cardinality", "exactly"),
    ("minCardinality", "min"),
    ("maxCardinality", "max"),
]


def render_restriction(group, labels):
    """Render an owl:Restriction blank node as a short readable string."""
    prop_m = re.search(r"owl:onProperty\s+<([^>]+)>", group)
    if not prop_m:
        return ""
    prop = label_or_curie(prop_m.group(1), labels)

    word = ""
    for key, w in QUANTIFIERS:
        if re.search(r"owl:" + key + r"\b", group):
            word = w
            break

    # Cardinality number, if any.
    card_m = re.search(r"owl:(?:min|max|qualified)?[cC]ardinality\b[^\d]*(\d+)", group)
    card = card_m.group(1) if card_m else ""

    # Filler: a named class, or a union/intersection of named classes.
    filler = "..."
    fm = re.search(r"owl:(?:someValuesFrom|allValuesFrom|onClass|hasValue)\s+<([^>]+)>", group)
    if fm:
        filler = label_or_curie(fm.group(1), labels)
    else:
        # Try a union/intersection list of IRIs (skip the onProperty IRI itself).
        iris = re.findall(r"<([^>]+)>", group)
        iris = [x for x in iris if x != prop_m.group(1)
                and "owl#" not in x and "rdf-schema" not in x]
        if "unionOf" in group and iris:
            filler = " or ".join(label_or_curie(x, labels) for x in iris)
        elif "intersectionOf" in group and iris:
            filler = " and ".join(label_or_curie(x, labels) for x in iris)
        elif iris:
            filler = label_or_curie(iris[0], labels)

    pieces = [prop, word, card, filler]
    return " ".join(p for p in pieces if p).strip()


def label_or_curie(iri, labels):
    return labels.get(iri) or curie_for(iri)


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_ontology.py <input.ttl> [output.js]")
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "ontology-data.js"

    with open(in_path, encoding="utf-8") as f:
        text = f.read()

    blocks = split_blocks(text)

    # First pass: collect labels for EVERYTHING (classes + properties) so that
    # restriction strings can resolve property and class names.
    labels = {}
    raw_blocks = []  # (iri, kind, block)
    for block in blocks:
        tm = RE_TYPE.search(block)
        if not tm:
            continue
        iri, kind = tm.group(1), tm.group(2)
        lm = RE_LABEL.search(block)
        if lm:
            labels[iri] = lm.group(1)
        raw_blocks.append((iri, kind, block))

    # Second pass: build class records.
    classes = {}
    children_of = {}
    for iri, kind, block in raw_blocks:
        if kind != "Class":
            continue
        src = source_for(iri)
        if src is None:
            continue  # skip anonymous / foreign classes
        parents, restrictions = scan_superclasses(block, labels)
        named_parents = [p for p in parents if source_for(p)]

        examples = []
        for em in RE_EXAMPLE.finditer(block):
            # Examples are often a single string of "; "-separated items.
            for piece in re.split(r";\s*", em.group(1)):
                piece = piece.strip()
                if piece:
                    examples.append(piece)

        def_m = RE_DEF.search(block)
        ident_m = RE_IDENT.search(block)

        classes[iri] = {
            "id": curie_for(iri),
            "iri": iri,
            "label": labels.get(iri, curie_for(iri)),
            "source": src,
            "definition": def_m.group(1) if def_m else "",
            "examples": examples,
            "restrictions": restrictions,
            "identifier": ident_m.group(1) if ident_m else "",
            "parents": named_parents,
        }
        for p in named_parents:
            children_of.setdefault(p, []).append(iri)

    if ROOT_IRI not in classes:
        print("ERROR: root class (entity / BFO:0000001) not found.")
        sys.exit(1)

    # Build a single spanning tree from the root via depth-first walk.
    visited = set()

    def build(iri):
        rec = classes[iri]
        visited.add(iri)
        node = {
            "id": rec["id"],
            "iri": rec["iri"],
            "label": rec["label"],
            "source": rec["source"],
            "definition": rec["definition"],
            "examples": rec["examples"],
            "restrictions": rec["restrictions"],
            "identifier": rec["identifier"],
        }
        # Record extra parents (multiple inheritance) for the info panel.
        extra = [curie_for(p) for p in rec["parents"]
                 if p in classes and p != iri]
        if len(extra) > 1:
            node["otherParents"] = extra

        kids = sorted(
            (c for c in children_of.get(iri, []) if c in classes and c not in visited),
            key=lambda c: classes[c]["label"].lower(),
        )
        children = [build(c) for c in kids]
        if children:
            node["children"] = children
        return node

    tree = build(ROOT_IRI)

    # Count for a friendly report.
    def count(n):
        return 1 + sum(count(c) for c in n.get("children", []))

    total = count(tree)
    n_cco = sum(1 for c in classes.values() if c["source"] == "CCO" and c["iri"] in visited)
    n_bfo = sum(1 for c in classes.values() if c["source"] == "BFO" and c["iri"] in visited)

    header = (
        "// ============================================================\n"
        "//  ontology-data.js  (AUTO-GENERATED -- do not edit by hand)\n"
        "//  Generated by tools/extract_ontology.py from a BFO/CCO .ttl file.\n"
        "//  To regenerate:\n"
        "//      python tools/extract_ontology.py <input.ttl> ontology-data.js\n"
        f"//  Classes in tree: {total}  (BFO: {n_bfo}, CCO: {n_cco})\n"
        "// ============================================================\n\n"
        "window.REAL_ONTOLOGY = "
    )

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header)
        json.dump(tree, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print(f"Wrote {out_path}: {total} classes (BFO {n_bfo}, CCO {n_cco}).")


if __name__ == "__main__":
    main()
