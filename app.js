// ============================================================
//  app.js — BFO / CCO Visualizer
// ------------------------------------------------------------
//  A pedagogical, zoomable circle-packing browser for the BFO and
//  CCO class hierarchies. Circle CONTAINMENT is the visual metaphor
//  for the subclass relation: a class's subclasses are drawn nested
//  inside it. We reveal the ontology GRADUALLY (progressive
//  disclosure): at any moment you see the focused class, its direct
//  subclasses, and faint previews of grandchildren — nothing deeper.
//
//  Only external dependency: D3 v7 (loaded from a CDN in index.html).
//
//  The code is organized top-to-bottom as:
//    1. Data selection & config
//    2. State
//    3. Build / render the diagram
//    4. Zoom geometry (zoomTo) + visibility styling (applyStyles)
//    5. Navigation (goTo, click handling, breadcrumbs, focus display)
//    6. Tooltip / hover
//    7. Search
//    8. Info panel
//    9. Toolbar wiring + boot
// ============================================================

(function () {
  "use strict";

  // Build marker — logged on load so we can confirm (via the browser console)
  // that GitHub Pages is serving the latest deployed code, not a cached copy.
  const BUILD = "5578171";
  console.log("BFO/CCO Visualizer — Build: " + BUILD);

  // ---------- 1. Data selection & config ----------

  // Prefer the full auto-generated ontology; fall back to the small sample.
  const rawData = window.REAL_ONTOLOGY || window.SAMPLE_ONTOLOGY;
  if (!rawData) {
    document.body.innerHTML =
      "<p style='padding:40px;font-family:sans-serif'>No ontology data found. " +
      "Make sure <code>ontology-data.js</code> or <code>sample-data.js</code> is loaded.</p>";
    return;
  }

  // Logical drawing size. The SVG uses a viewBox, so this is unitless and the
  // diagram scales responsively to the window.
  const DIAM = 932;

  // Pastel palette for sibling groups. Every set of siblings under the same
  // parent shares ONE of these shades; a node's own children get a different
  // shade (we rotate through the palette as we walk the tree).
  const PALETTE = [
    "#AEC6FF", "#FFD8A8", "#B5EAD7", "#FFB7B2", "#C7CEEA",
    "#E2C2FF", "#FDE2A0", "#B8E0D2", "#FFC8DD", "#A0E7E5",
    "#FBE7C6", "#D0F4DE",
  ];
  const FOCUS_FILL = "#f6f8fc"; // very light fill for the focused "container" circle
  const ROOT_FILL = "#eef1f8";

  // ---------- 2. State ----------

  let scope = "ALL"; // "BFO" = BFO only, "ALL" = BFO + CCO (default: full hierarchy)
  let root = null; // d3 hierarchy root for the current scope
  let focus = null; // currently focused node
  let selected = null; // node shown in the info panel
  let currentView = [0, 0, DIAM]; // [cx, cy, size] in pack coordinates
  let currentK = 1; // current screen-scale factor
  let idMap = new Map(); // class id -> d3 node (for the current scope)

  // D3 selections (assigned during build)
  let svg, viewport, nodeG, circles, labels, badges;

  // ---------- Compressed circle-packing layout (readability) ----------
  // Tunables for the recursive compressed pack. d3.pack() sizes a circle by the
  // area needed to hold its ENTIRE subtree, so a class with many (hidden)
  // descendants — e.g. `Act` — dwarfs sibling peers like `Cause`. For a
  // progressive-disclosure learner's view we instead compress each child's
  // radius sublinearly and enforce a floor, so immediate siblings read as
  // conceptual peers. Descendant count still influences size, just gently.
  const LEAF_R = 24; // base radius of a leaf circle (pre-scale)
  const PACK_PAD = 7; // gap between siblings / inner margin
  const COMPRESS = 0.55; // sublinear exponent: child radius ∝ (subtree size)^COMPRESS
  const MIN_CHILD_R = 13; // floor so small siblings never collapse to nothing
  const MIN_LABEL_RADIUS = 26; // on-screen radius (viewBox units) below which a label is hidden

  // Compute a compressed layout, writing d.x / d.y / d.r on every hierarchy
  // node (same fields d3.pack would set, so zoomTo and everything downstream are
  // unchanged). Built from the public helpers d3.packSiblings / d3.packEnclose.
  function computeLayout(rootNode) {
    // Pass 1 (bottom-up): give every node a "natural" radius (_nat) and, for
    // internal nodes, each child's enclosing-relative position + compressed
    // display radius (_cr). Compression is applied at EVERY level, so siblings
    // stay within a bounded size ratio throughout the tree.
    function measure(d) {
      if (!d.children || !d.children.length) {
        d._nat = LEAF_R;
        return;
      }
      d.children.forEach(measure);
      // Pack largest-first for a tidy arrangement.
      const ordered = d.children.slice().sort((a, b) => b._nat - a._nat);
      const circles = ordered.map((c) => {
        c._cr = Math.max(MIN_CHILD_R, LEAF_R * Math.pow(c._nat / LEAF_R, COMPRESS));
        return { r: c._cr + PACK_PAD, ref: c };
      });
      d3.packSiblings(circles);
      const enc = d3.packEnclose(circles);
      circles.forEach((c) => {
        c.ref._relx = c.x - enc.x;
        c.ref._rely = c.y - enc.y;
      });
      d._nat = enc.r + PACK_PAD;
    }
    measure(rootNode);

    // Pass 2 (top-down): assign absolute coordinates. `scale` shrinks a subtree
    // so it fits the compressed slot its parent allotted it.
    function place(d, cx, cy, scale) {
      d.x = cx;
      d.y = cy;
      d.r = d._nat * scale;
      if (!d.children) return;
      d.children.forEach((c) => {
        const childScale = scale * (c._cr / c._nat);
        place(c, cx + c._relx * scale, cy + c._rely * scale, childScale);
      });
    }
    // Normalize so the root fills DIAM, centered on the viewBox origin (0, 0).
    place(rootNode, 0, 0, DIAM / 2 / rootNode._nat);
  }

  // Manual pan/zoom (secondary to click-to-zoom). Applied as a transform on the
  // viewport <g>; reset to identity whenever we navigate to a new focus.
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.6, 12])
    .on("zoom", (event) => viewport.attr("transform", event.transform));

  // ---------- helpers ----------

  // Relationship of node d to the current focus:
  //   0 = focus, 1 = direct child, 2 = grandchild, >2 = deeper descendant,
  //  -1 = not under focus (an ancestor or a different branch).
  function relationTo(d) {
    let a = d;
    let steps = 0;
    while (a) {
      if (a === focus) return steps;
      a = a.parent;
      steps++;
    }
    return -1;
  }

  // Sibling-group fill: a node is colored by ITS PARENT's color index, so all
  // children of the same parent match.
  function groupFill(d) {
    if (!d.parent) return ROOT_FILL;
    return PALETTE[d.parent._ci % PALETTE.length];
  }

  // Wrap a label into at most two balanced lines for nicer fitting.
  function wrapLabel(text) {
    const words = text.split(/\s+/);
    if (words.length <= 1 || text.length <= 12) return [text];
    const total = text.length;
    let best = 0;
    let bestDiff = Infinity;
    let acc = 0;
    for (let i = 0; i < words.length - 1; i++) {
      acc += words[i].length + 1;
      const diff = Math.abs(acc - (total - acc));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return [
      words.slice(0, best + 1).join(" "),
      words.slice(best + 1).join(" "),
    ];
  }

  // Only keep BFO classes when scope is "BFO". Returns a fresh tree each call.
  function filterTree(node) {
    const copy = Object.assign({}, node);
    if (node.children) {
      const kids = node.children
        .filter((c) => scope === "ALL" || c.source !== "CCO")
        .map(filterTree);
      if (kids.length) copy.children = kids;
      else delete copy.children;
    }
    return copy;
  }

  // ---------- 3. Build / render ----------

  function init() {
    svg = d3
      .select("#viz")
      .attr("viewBox", [-DIAM / 2, -DIAM / 2, DIAM, DIAM])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .on("click", () => {
        // Background click → zoom out to parent.
        if (focus && focus.parent) goTo(focus.parent);
      });

    viewport = svg.append("g").attr("class", "viewport");

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    buildAndRender(null);
  }

  // Rebuild the hierarchy for the current scope and (re)render all nodes.
  // `keepFocusId` keeps the same focus if that class still exists.
  function buildAndRender(keepFocusId) {
    // Stop any in-flight transitions so old (BFO-only) nodes and new (BFO+CCO)
    // nodes can't briefly animate on top of each other (the "smear" artifact).
    svg.interrupt().interrupt("view");
    if (nodeG) {
      nodeG.interrupt();
      circles.interrupt();
      labels.interrupt();
      badges.interrupt();
    }

    const filtered = filterTree(rawData);
    const h = d3
      .hierarchy(filtered)
      .sum(() => 1)
      .sort((a, b) => b.value - a.value);
    computeLayout(h);
    root = h;

    // Assign a color index, pre-wrapped label lines, and id lookup for each node.
    idMap = new Map();
    root.descendants().forEach((d, i) => {
      d._ci = i;
      d._lines = wrapLabel(d.data.label);
      idMap.set(d.data.id, d);
    });

    // DATA JOIN — one <g.node> per class.
    const sel = viewport
      .selectAll("g.node")
      .data(root.descendants(), (d) => d.data.id);
    sel.exit().remove();

    const enter = sel
      .enter()
      .append("g")
      .attr("class", "node");

    // New nodes start fully transparent. Otherwise they'd render at the SVG
    // default opacity (1) and then animate down to their target (0 for the many
    // hidden descendants), flashing a smear of overlapping circles/labels/badges
    // for the whole transition. Starting at 0 means only nodes that SHOULD be
    // visible fade in.
    enter
      .append("circle")
      .style("opacity", 0)
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .on("mouseover", function (event, d) {
        const r = relationTo(d);
        if (r !== 0 && r !== 1) return;
        d3.select(this).classed("hover", true).attr("r", d.r * currentK * 1.04);
        showTooltip(event, d);
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", function (event, d) {
        d3.select(this).classed("hover", false).attr("r", d.r * currentK);
        hideTooltip();
      });

    enter.append("text").attr("class", "node-label").style("opacity", 0);
    enter
      .append("text")
      .attr("class", "cco-badge")
      .text("CCO")
      .style("opacity", 0);

    nodeG = enter.merge(sel);
    circles = nodeG.select("circle");
    labels = nodeG.select("text.node-label");
    badges = nodeG.select("text.cco-badge");

    // (Re)lay out the label tspans for every node.
    labels.each(function (d) {
      const text = d3.select(this);
      text.selectAll("tspan").remove();
      const lines = d._lines;
      lines.forEach((ln, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr(
            "dy",
            i === 0 ? `${0.32 - (lines.length - 1) * 0.55}em` : "1.1em"
          )
          .text(ln);
      });
    });

    // Decide focus and paint.
    focus = (keepFocusId && idMap.get(keepFocusId)) || root;
    applyStyles();
    zoomTo([focus.x, focus.y, focus.r * 2]);
    updateBreadcrumbs();
    updateFocusDisplay();
    selectNode(focus, true);
  }

  // ---------- 4. Zoom geometry + visibility ----------

  // Position every circle/label for a given view [cx, cy, size].
  function zoomTo(v) {
    currentView = v;
    const k = DIAM / v[2];
    currentK = k;

    nodeG.attr(
      "transform",
      (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`
    );
    circles.attr("r", (d) => d.r * k);

    // LABEL visibility is separate from CIRCLE visibility: a grandchild circle
    // may show faintly with no label. Label only the focus's immediate children,
    // and only when the circle is big enough to fit readable text. Everything
    // else is hidden outright (display:none) so no stale text can smear.
    labels.each(function (d) {
      const sel = d3.select(this);
      const r = d.r * k; // on-screen radius (viewBox units)
      if (relationTo(d) !== 1 || r <= MIN_LABEL_RADIUS) {
        sel.attr("display", "none");
        return;
      }
      const maxLen = Math.max.apply(null, d._lines.map((s) => s.length));
      // Fit by width, but clamp so large circles don't get giant text.
      let fs = Math.min(r * 0.32, (2 * r * 0.8) / (maxLen * 0.6), 44);
      fs = Math.max(fs, 7);
      sel.attr("display", null).attr("font-size", fs);
    });

    // CCO badges follow the same rule (immediate CCO children, big enough only).
    badges.each(function (d) {
      const sel = d3.select(this);
      const r = d.r * k;
      if (relationTo(d) !== 1 || d.data.source !== "CCO" || r <= MIN_LABEL_RADIUS) {
        sel.attr("display", "none");
        return;
      }
      const fs = Math.max(8, Math.min(13, r * 0.16));
      sel.attr("display", null).attr("font-size", fs).attr("y", -r * 0.62);
    });
  }

  // Apply fills, opacities, strokes and pointer-events based on the focus.
  // This is what produces progressive disclosure.
  function applyStyles() {
    circles
      .attr("fill", (d) => (d === focus ? FOCUS_FILL : groupFill(d)))
      .attr("fill-opacity", 0.92)
      .attr("stroke-width", (d) => (d === focus ? 1.4 : 1.2))
      .attr("stroke-dasharray", (d) =>
        d.data.source === "CCO" ? "5 4" : null
      )
      .attr("stroke", (d) =>
        d.data.source === "CCO"
          ? "#a98fd6"
          : d === focus
          ? "rgba(40,50,80,0.16)"
          : "rgba(40,50,80,0.10)"
      )
      .attr("pointer-events", (d) => {
        const r = relationTo(d);
        return r === 0 || r === 1 ? "all" : "none";
      });

    circles
      .transition()
      .duration(450)
      .style("opacity", (d) => {
        const r = relationTo(d);
        if (r < 0 || r > 2) return 0; // hidden: deeper, or off-branch
        if (r === 2) return 0.22; // faint grandchild preview
        return 1; // focus + direct children
      });

    labels
      .transition()
      .duration(450)
      .style("opacity", (d) => (relationTo(d) === 1 ? 1 : 0));

    badges
      .transition()
      .duration(450)
      .style("opacity", (d) =>
        relationTo(d) === 1 && d.data.source === "CCO" ? 0.95 : 0
      );
  }

  // ---------- 5. Navigation ----------

  function onNodeClick(d) {
    // Clicking the focus itself zooms out one level.
    if (d === focus) {
      selectNode(d);
      if (focus.parent) goTo(focus.parent);
      return;
    }
    const r = relationTo(d);
    if (r === 1) {
      selectNode(d);
      if (d.children) {
        goTo(d); // class with subclasses → zoom in
      } else {
        openInfoPanel(); // leaf → just show its info
      }
    }
  }

  // Smoothly move focus to `node`.
  function goTo(node) {
    focus = node;
    selectNode(node, true);
    updateBreadcrumbs();
    updateFocusDisplay();
    applyStyles();
    // Enforce label/badge visibility rules immediately (before the animation),
    // so labels from the previous focus don't linger during the zoom.
    zoomTo(currentView);

    // Reset any manual pan/zoom instantly, then animate the view.
    svg.call(zoomBehavior.transform, d3.zoomIdentity);

    const target = [node.x, node.y, node.r * 2];
    svg
      .transition("view")
      .duration(720)
      .ease(d3.easeCubicInOut)
      .tween("zoomview", () => {
        const i = d3.interpolateZoom(currentView, target);
        return (t) => zoomTo(i(t));
      });
  }

  function updateBreadcrumbs() {
    const nav = d3.select("#breadcrumbs");
    nav.selectAll("*").remove();
    const path = focus.ancestors().reverse();
    path.forEach((n, i) => {
      if (i > 0) nav.append("span").attr("class", "sep").text("›");
      nav
        .append("button")
        .attr("class", "crumb" + (n === focus ? " current" : ""))
        .text(n.data.label)
        .on("click", () => {
          if (n !== focus) goTo(n);
        });
    });
  }

  function updateFocusDisplay() {
    d3.select("#focus-name").text(focus.data.label);
    const badge = d3.select("#focus-source");
    badge
      .text(focus.data.source)
      .classed("cco", focus.data.source === "CCO");
  }

  // ---------- 6. Tooltip / hover ----------

  const tooltip = document.getElementById("tooltip");
  const stage = document.getElementById("stage");

  function showTooltip(event, d) {
    tooltip.innerHTML =
      `${escapeHtml(d.data.label)}<span class="tip-source">${d.data.source}</span>`;
    tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const rect = stage.getBoundingClientRect();
    tooltip.style.left = event.clientX - rect.left + "px";
    tooltip.style.top = event.clientY - rect.top + "px";
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  // ---------- 7. Search ----------

  // Flat index over the FULL ontology (independent of the BFO/CCO scope toggle).
  const searchIndex = [];
  (function buildIndex(n) {
    searchIndex.push(n);
    (n.children || []).forEach(buildIndex);
  })(rawData);

  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  let activeResultIndex = -1;
  let currentResults = [];

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) {
      hideResults();
      return;
    }
    const scored = [];
    for (const n of searchIndex) {
      const label = (n.label || "").toLowerCase();
      const id = (n.id || "").toLowerCase();
      const def = (n.definition || "").toLowerCase();
      let score = -1;
      if (label.startsWith(q)) score = 0;
      else if (label.includes(q)) score = 1;
      else if (id.includes(q)) score = 2;
      else if (def.includes(q)) score = 3;
      if (score >= 0) scored.push({ node: n, score });
    }
    scored.sort(
      (a, b) => a.score - b.score || a.node.label.localeCompare(b.node.label)
    );
    currentResults = scored.slice(0, 40).map((s) => s.node);
    renderResults(q);
  }

  function renderResults(q) {
    searchResults.innerHTML = "";
    activeResultIndex = -1;
    if (!currentResults.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matching classes";
      searchResults.appendChild(li);
      searchResults.hidden = false;
      return;
    }
    currentResults.forEach((n, i) => {
      const li = document.createElement("li");
      li.dataset.index = i;

      const lbl = document.createElement("span");
      lbl.className = "res-label";
      lbl.innerHTML = highlight(n.label, q);

      const meta = document.createElement("span");
      meta.className = "res-meta";
      meta.textContent = `${n.source} · ${n.id}`;

      li.appendChild(lbl);
      li.appendChild(meta);
      li.addEventListener("click", () => pickResult(n));
      searchResults.appendChild(li);
    });
    searchResults.hidden = false;
  }

  function pickResult(n) {
    hideResults();
    searchInput.value = "";
    navigateToId(n.id, n.source);
  }

  function navigateToId(id, source) {
    // If the target is a CCO class but we're in BFO-only mode, switch scope.
    if (source === "CCO" && scope !== "ALL") {
      setScope("ALL");
    }
    if (!idMap.has(id)) {
      // Rebuild (e.g. scope just changed) then navigate.
      buildAndRender(null);
    }
    const node = idMap.get(id);
    if (node) {
      // If it's a leaf, focus its parent and open info; otherwise zoom into it.
      if (node.children) goTo(node);
      else {
        if (node.parent) goTo(node.parent);
        selectNode(node);
        openInfoPanel();
      }
    }
  }

  function hideResults() {
    searchResults.hidden = true;
    activeResultIndex = -1;
  }

  // Wrap the matched substring of `text` in <mark> for the results list.
  function highlight(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, i)) +
      "<mark>" +
      escapeHtml(text.slice(i, i + q.length)) +
      "</mark>" +
      escapeHtml(text.slice(i + q.length))
    );
  }

  // Keyboard navigation within the results list.
  searchInput.addEventListener("input", (e) => runSearch(e.target.value));
  searchInput.addEventListener("keydown", (e) => {
    if (searchResults.hidden) return;
    const items = searchResults.querySelectorAll("li[data-index]");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeResultIndex = Math.min(activeResultIndex + 1, items.length - 1);
      updateActiveResult(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeResultIndex = Math.max(activeResultIndex - 1, 0);
      updateActiveResult(items);
    } else if (e.key === "Enter") {
      const pick =
        activeResultIndex >= 0 ? currentResults[activeResultIndex] : currentResults[0];
      if (pick) pickResult(pick);
    } else if (e.key === "Escape") {
      hideResults();
      searchInput.blur();
    }
  });

  function updateActiveResult(items) {
    items.forEach((it, i) =>
      it.classList.toggle("active", i === activeResultIndex)
    );
    if (items[activeResultIndex]) {
      items[activeResultIndex].scrollIntoView({ block: "nearest" });
    }
  }

  // Hide results when clicking elsewhere.
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) hideResults();
  });

  // ---------- 8. Info panel ----------

  const infoPanel = document.getElementById("info-panel");
  const infoContent = document.getElementById("info-content");

  // Update the info panel content for `node`. By default this does NOT open the
  // panel (it stays hidden until the user asks for it, or clicks a leaf).
  function selectNode(node, _dontRender) {
    selected = node;
    renderInfo(node);
  }

  function openInfoPanel() {
    infoPanel.hidden = false;
  }

  function renderInfo(node) {
    const d = node.data;
    const parts = [];

    parts.push(`<h2>${escapeHtml(d.label)}</h2>`);

    // Source
    const srcClass = d.source === "CCO" ? "cco" : "";
    parts.push(
      `<div class="info-section"><h3>Source ontology</h3>` +
        `<span class="source-badge ${srcClass}">${d.source}</span></div>`
    );

    // Identifier / IRI
    parts.push(
      `<div class="info-section"><h3>Identifier</h3>` +
        `<p class="info-id">${escapeHtml(d.id)}</p>` +
        (d.iri
          ? `<p class="info-id"><a class="info-link" href="${escapeAttr(
              d.iri
            )}" target="_blank" rel="noopener">${escapeHtml(d.iri)}</a></p>`
          : "") +
        "</div>"
    );

    // Definition
    if (d.definition) {
      parts.push(
        `<div class="info-section"><h3>Definition</h3><p>${escapeHtml(
          d.definition
        )}</p></div>`
      );
    }

    // Examples
    if (d.examples && d.examples.length) {
      parts.push(
        `<div class="info-section"><h3>Examples</h3><ul>` +
          d.examples.map((x) => `<li>${escapeHtml(x)}</li>`).join("") +
          `</ul></div>`
      );
    }

    // Parent class (clickable chip)
    if (node.parent) {
      parts.push(
        `<div class="info-section"><h3>Parent class</h3>` +
          chip(node.parent.data) +
          `</div>`
      );
    }

    // Additional (multiple-inheritance) parents, if recorded.
    if (d.otherParents && d.otherParents.length) {
      parts.push(
        `<div class="info-section"><h3>Also a subclass of</h3>` +
          d.otherParents.map((p) => `<span class="chip">${escapeHtml(p)}</span>`).join("") +
          `</div>`
      );
    }

    // Child classes (clickable chips)
    if (node.children && node.children.length) {
      parts.push(
        `<div class="info-section"><h3>Subclasses (${node.children.length})</h3>` +
          node.children.map((c) => chip(c.data)).join("") +
          `</div>`
      );
    }

    // OWL restrictions (info-panel only for MVP)
    if (d.restrictions && d.restrictions.length) {
      parts.push(
        `<div class="info-section"><h3>OWL restrictions</h3><ul>` +
          d.restrictions
            .map((r) => `<li class="restriction">${escapeHtml(r)}</li>`)
            .join("") +
          `</ul></div>`
      );
    }

    infoContent.innerHTML = parts.join("");

    // Wire up clickable chips that carry a data-id.
    infoContent.querySelectorAll(".chip[data-id]").forEach((el) => {
      el.addEventListener("click", () =>
        navigateToId(el.dataset.id, el.dataset.source)
      );
    });
  }

  function chip(data) {
    return `<span class="chip" data-id="${escapeAttr(data.id)}" data-source="${escapeAttr(
      data.source
    )}">${escapeHtml(data.label)}</span>`;
  }

  // ---------- 9. Toolbar wiring + boot ----------

  function setScope(newScope) {
    if (scope === newScope) return;
    scope = newScope;
    d3.selectAll("#scope-toggle button").classed(
      "active",
      function () {
        return this.dataset.scope === scope;
      }
    );
  }

  // Scope toggle buttons
  document.querySelectorAll("#scope-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newScope = btn.dataset.scope;
      if (newScope === scope) return;
      const keep = focus ? focus.data.id : null;
      setScope(newScope);
      buildAndRender(keep);
    });
  });

  // Reset button → back to the root (Entity).
  document.getElementById("reset-btn").addEventListener("click", () => {
    if (root) goTo(root);
  });

  // Info button toggles the panel; opening with nothing selected shows the focus.
  document.getElementById("info-btn").addEventListener("click", () => {
    if (infoPanel.hidden) {
      if (!selected && focus) selectNode(focus);
      infoPanel.hidden = false;
    } else {
      infoPanel.hidden = true;
    }
  });

  document.getElementById("info-close").addEventListener("click", () => {
    infoPanel.hidden = true;
  });

  // ---------- small HTML-escaping utilities ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  // Go!
  init();
})();
