// ============================================================
//  sample-data.js
// ------------------------------------------------------------
//  A small, hand-curated slice of BFO (plus a couple of CCO
//  classes) so the visualizer works out-of-the-box even if the
//  full auto-generated `ontology-data.js` is missing.
//
//  The app prefers `window.REAL_ONTOLOGY` (the full extracted
//  ontology in ontology-data.js). If that file is absent, it
//  falls back to this `window.SAMPLE_ONTOLOGY`.
//
//  DATA SHAPE (one node):
//  {
//    id:           "BFO:0000001",                 // short CURIE
//    iri:          "http://.../BFO_0000001",      // full IRI
//    label:        "entity",                       // display name
//    source:       "BFO" | "CCO",                  // ontology
//    definition:   "official text...",             // may be ""
//    examples:     ["...", "..."],                  // may be []
//    restrictions: ["has_part some ..."],           // may be []
//    identifier:   "001-BFO",                       // may be ""
//    children:     [ ...nested nodes... ]           // omit if leaf
//  }
//
//  To use your OWN data, just replace ontology-data.js (see README).
// ============================================================

window.SAMPLE_ONTOLOGY = {
  id: "BFO:0000001",
  iri: "http://purl.obolibrary.org/obo/BFO_0000001",
  label: "entity",
  source: "BFO",
  definition: "An entity is anything that exists or has existed or will exist.",
  examples: ["Julius Caesar", "the Eiffel Tower", "your left kidney"],
  restrictions: [],
  identifier: "001-BFO",
  children: [
    {
      id: "BFO:0000002",
      iri: "http://purl.obolibrary.org/obo/BFO_0000002",
      label: "continuant",
      source: "BFO",
      definition:
        "A continuant is an entity that persists, endures, or continues to exist through time while maintaining its identity.",
      examples: ["a human being", "a tennis ball", "a region of space"],
      restrictions: [],
      identifier: "008-BFO",
      children: [
        {
          id: "BFO:0000004",
          iri: "http://purl.obolibrary.org/obo/BFO_0000004",
          label: "independent continuant",
          source: "BFO",
          definition:
            "A continuant that is the bearer of qualities and realizable entities and which depends on no other entity.",
          examples: ["an organism", "a heart", "a chair"],
          restrictions: [],
          identifier: "017-BFO",
          children: [
            {
              id: "BFO:0000040",
              iri: "http://purl.obolibrary.org/obo/BFO_0000040",
              label: "material entity",
              source: "BFO",
              definition:
                "An independent continuant that has some portion of matter as continuant part.",
              examples: ["a human being", "a portion of water"],
              restrictions: [],
              identifier: "019-BFO",
              children: [
                {
                  id: "BFO:0000030",
                  iri: "http://purl.obolibrary.org/obo/BFO_0000030",
                  label: "object",
                  source: "BFO",
                  definition:
                    "A material entity that is spatially extended, maximally self-connected and self-contained, and possesses an internal unity.",
                  examples: ["an organism", "a molecule", "a planet"],
                  restrictions: [],
                  identifier: "024-BFO",
                  children: [
                    {
                      id: "CCO:ont00001262",
                      iri: "https://www.commoncoreontologies.org/ont00001262",
                      label: "Artifact",
                      source: "CCO",
                      definition:
                        "An Object that was designed by some Agent to realize a certain Function.",
                      examples: ["a hammer", "a printed book"],
                      restrictions: [],
                      identifier: "",
                    },
                  ],
                },
                {
                  id: "BFO:0000027",
                  iri: "http://purl.obolibrary.org/obo/BFO_0000027",
                  label: "object aggregate",
                  source: "BFO",
                  definition:
                    "A material entity consisting of a plurality of objects as member parts.",
                  examples: ["a swarm of bees", "a collection of stamps"],
                  restrictions: [],
                  identifier: "025-BFO",
                },
                {
                  id: "BFO:0000024",
                  iri: "http://purl.obolibrary.org/obo/BFO_0000024",
                  label: "fiat object part",
                  source: "BFO",
                  definition:
                    "A material entity that is part of an object but is not demarcated by any physical discontinuities.",
                  examples: ["the upper half of your body", "the Western hemisphere"],
                  restrictions: [],
                  identifier: "026-BFO",
                },
              ],
            },
            {
              id: "BFO:0000141",
              iri: "http://purl.obolibrary.org/obo/BFO_0000141",
              label: "immaterial entity",
              source: "BFO",
              definition:
                "An independent continuant that contains no material entities as parts.",
              examples: ["the interior of your mouth"],
              restrictions: [],
              identifier: "028-BFO",
            },
          ],
        },
        {
          id: "BFO:0000020",
          iri: "http://purl.obolibrary.org/obo/BFO_0000020",
          label: "specifically dependent continuant",
          source: "BFO",
          definition:
            "A continuant that inheres in or is borne by other entities.",
          examples: ["the color of a tomato", "the role of being a doctor"],
          restrictions: [],
          identifier: "020-BFO",
          children: [
            {
              id: "BFO:0000019",
              iri: "http://purl.obolibrary.org/obo/BFO_0000019",
              label: "quality",
              source: "BFO",
              definition:
                "A specifically dependent continuant that does not require any further process in order to be realized.",
              examples: ["the color of a tomato", "the mass of a cloud"],
              restrictions: [],
              identifier: "055-BFO",
            },
            {
              id: "BFO:0000017",
              iri: "http://purl.obolibrary.org/obo/BFO_0000017",
              label: "realizable entity",
              source: "BFO",
              definition:
                "A specifically dependent continuant whose instances are realized in processes.",
              examples: ["a role", "a disposition", "a function"],
              restrictions: [],
              identifier: "058-BFO",
              children: [
                {
                  id: "BFO:0000023",
                  iri: "http://purl.obolibrary.org/obo/BFO_0000023",
                  label: "role",
                  source: "BFO",
                  definition:
                    "A realizable entity that exists because its bearer is in some special circumstances, and which the bearer need not have.",
                  examples: ["the role of being a doctor"],
                  restrictions: [],
                  identifier: "061-BFO",
                },
                {
                  id: "BFO:0000016",
                  iri: "http://purl.obolibrary.org/obo/BFO_0000016",
                  label: "disposition",
                  source: "BFO",
                  definition:
                    "A realizable entity that essentially causes a specific process in its bearer under certain circumstances.",
                  examples: ["the disposition of glass to break"],
                  restrictions: [],
                  identifier: "062-BFO",
                  children: [
                    {
                      id: "BFO:0000034",
                      iri: "http://purl.obolibrary.org/obo/BFO_0000034",
                      label: "function",
                      source: "BFO",
                      definition:
                        "A disposition that exists in virtue of the bearer's physical make-up and is realized in a process in which the bearer is used for a certain end.",
                      examples: ["the function of a heart to pump blood"],
                      restrictions: [],
                      identifier: "064-BFO",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "BFO:0000031",
          iri: "http://purl.obolibrary.org/obo/BFO_0000031",
          label: "generically dependent continuant",
          source: "BFO",
          definition:
            "A continuant that is dependent on one or other independent continuant bearers and can migrate from one bearer to another through copying.",
          examples: ["a pdf file", "a musical score"],
          restrictions: [],
          identifier: "074-BFO",
          children: [
            {
              id: "CCO:ont00001331",
              iri: "https://www.commoncoreontologies.org/ont00001331",
              label: "Information Content Entity",
              source: "CCO",
              definition:
                "A Generically Dependent Continuant that is about some entity.",
              examples: ["a name", "a measurement", "a diagram"],
              restrictions: [],
              identifier: "",
            },
          ],
        },
      ],
    },
    {
      id: "BFO:0000003",
      iri: "http://purl.obolibrary.org/obo/BFO_0000003",
      label: "occurrent",
      source: "BFO",
      definition:
        "An occurrent is an entity that unfolds itself in time, or is the boundary of such an entity, or is a temporal or spatiotemporal region.",
      examples: ["a heartbeat", "a war", "the year 2026"],
      restrictions: [],
      identifier: "077-BFO",
      children: [
        {
          id: "BFO:0000015",
          iri: "http://purl.obolibrary.org/obo/BFO_0000015",
          label: "process",
          source: "BFO",
          definition:
            "An occurrent that has temporal proper parts and for some time depends on at least one material entity.",
          examples: ["the life of an organism", "a heartbeat", "a war"],
          restrictions: [],
          identifier: "083-BFO",
          children: [
            {
              id: "CCO:ont00000061",
              iri: "https://www.commoncoreontologies.org/ont00000061",
              label: "Act",
              source: "CCO",
              definition:
                "A Process in which at least one Agent plays a causative role.",
              examples: ["signing a contract", "throwing a ball"],
              restrictions: [],
              identifier: "",
            },
          ],
        },
        {
          id: "BFO:0000008",
          iri: "http://purl.obolibrary.org/obo/BFO_0000008",
          label: "temporal region",
          source: "BFO",
          definition: "An occurrent over which processes can unfold; a part of time.",
          examples: ["the year 2026", "the first second of a race"],
          restrictions: [],
          identifier: "100-BFO",
        },
        {
          id: "BFO:0000011",
          iri: "http://purl.obolibrary.org/obo/BFO_0000011",
          label: "spatiotemporal region",
          source: "BFO",
          definition: "An occurrent that is an occurrent part of spacetime.",
          examples: ["the spatiotemporal region occupied by a race"],
          restrictions: [],
          identifier: "095-BFO",
        },
      ],
    },
  ],
};
