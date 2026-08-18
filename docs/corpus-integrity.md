# Corpus integrity repair

The legacy corpus contained a small number of structural errors that made IDs and relationships ambiguous. These are data-integrity defects, not editorial taxonomy decisions.

The deterministic repair in `scripts/repair-integrity.mjs` applies only the following rules:

- keep record `3` as the canonical Functional Fixedness record and retire duplicate record `56`;
- preserve the public Functional Fixedness slug;
- keep Law of the Instrument on ID `57`;
- move Decoy Effect from the duplicate ID `57` to the next unused ID `220` while preserving its public slug;
- update Framing Effect relations that used `57` for Decoy Effect;
- replace relations to retired Functional Fixedness ID `56` with canonical ID `3`;
- remove references to missing ID `4`;
- remove self-relations and duplicate relation IDs.

The repair intentionally does **not** merge semantic duplicates such as repeated Conservatism Bias, Hindsight Bias, Illusory Truth Effect, or Subadditivity Effect records. Those require taxonomy/editorial review under issue #2.

After the repair, `scripts/validate-data.mjs` remains the hard gate preventing duplicate IDs or slugs from returning.
