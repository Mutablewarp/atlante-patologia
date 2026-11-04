#!/usr/bin/env node
// One-off download of the PDB structures used by the pathways (owner decision
// O9). Needs the network; run by hand, never in the build. Outputs are committed.
//
//   node scripts/fetch-structures.mjs            all entries below
//   node scripts/fetch-structures.mjs 1PAU 3JBT  only these
//
// Per entry it writes
//   public/structures/<id>.bcif.gz       reduced BinaryCIF from the RCSB ModelServer, gzip -9
//   src/content/structures/<id>.yaml     provenance (RCSB Data API) + our construct notes
//
// ModelServer rules (private research note, 3Dmol 2.5.5 BCIF parser):
//   - `full?model_nums=1` keeps the categories 3Dmol needs; never use the
//     `/assembly` BinaryCIF output (it crashes the parser);
//   - very large complexes are stored as CA-only traces (`atoms?label_atom_id=CA`).
// The same query is also fetched as text CIF to count the atoms the parse test expects.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODELS = 'https://models.rcsb.org/v1';
const GRAPHQL = 'https://data.rcsb.org/graphql';

/**
 * Structures of the intrinsic apoptosis pathway. `caveats` is our own wording,
 * checked against the RCSB entry (organisms, mutations, fragments, method).
 */
const ENTRIES = [
  {
    pdb: '6O0K',
    caveats: {
      it: 'Costrutto ingegnerizzato: la lunga ansa flessibile di BCL-2 (residui 35–91) è sostituita da una breve ansa di BCL-xL e manca l’àncora di membrana C-terminale (residui 208–239). Il farmaco legato è venetoclax.',
      en: 'Engineered construct: BCL-2’s long flexible loop (residues 35–91) is replaced by a short loop from BCL-xL, and the C-terminal membrane anchor (residues 208–239) is missing. The bound drug is venetoclax.',
    },
  },
  {
    pdb: '1F16',
    caveats: {
      it: 'Struttura NMR in soluzione: si vede il primo modello dell’insieme depositato. È la forma inattiva e solubile di BAX, non il poro nella membrana.',
      en: 'Solution NMR structure: the first model of the deposited ensemble is shown. It is the inactive, soluble form of BAX, not the pore in the membrane.',
    },
  },
  {
    pdb: '3ZCF',
    show: ['A'],
    caveats: {
      it: 'Proteina umana ricombinante. Il cristallo contiene quattro copie; qui se ne mostra una, con il suo gruppo eme.',
      en: 'Recombinant human protein. The crystal holds four copies; one is shown here, with its haem group.',
    },
  },
  {
    pdb: '3JBT',
    coarse: true,
    caveats: {
      it: 'Il citocromo c di questo modello è di cavallo (Equus caballus); Apaf-1 è umano. Per alleggerire il file si mostra solo l’atomo Cα di ogni residuo. I domini CARD che richiamano la procaspasi-9 non sono risolti e la caspasi-9 non fa parte del modello; eme e dATP non sono disegnati in questo file solo Cα.',
      en: 'The cytochrome c in this model is from horse (Equus caballus); Apaf-1 is human. To keep the file small only the Cα atom of each residue is shown. The CARD domains that recruit procaspase-9 are not resolved and caspase-9 is not in this model; the haem and dATP are not drawn in this Cα-only file.',
    },
  },
  {
    pdb: '1NW9',
    caveats: {
      it: 'Si vedono la caspasi-9 e il solo dominio BIR3 di XIAP, non le proteine intere.',
      en: 'It shows caspase-9 and only the BIR3 domain of XIAP, not the whole proteins.',
    },
  },
  {
    pdb: '1PAU',
    caveats: {
      it: 'La caspasi-3 compare con il vecchio nome di apopaina. Si vedono una subunità grande e una piccola, legate a un inibitore peptidico sintetico (Ac-DEVD-CHO).',
      en: 'Caspase-3 appears under its older name, apopain. One large and one small subunit are shown, bound to a synthetic peptide inhibitor (Ac-DEVD-CHO).',
    },
  },
];

const QUERY = `query($ids: [String!]!) { entries(entry_ids: $ids) {
  rcsb_id struct { title } exptl { method }
  rcsb_entry_info { resolution_combined deposited_atom_count deposited_model_count }
  rcsb_accession_info { initial_release_date }
  rcsb_primary_citation { title journal_abbrev year journal_volume page_first pdbx_database_id_DOI pdbx_database_id_PubMed rcsb_authors }
  polymer_entities {
    rcsb_polymer_entity { pdbx_description pdbx_mutation pdbx_fragment }
    rcsb_entity_source_organism { scientific_name }
    rcsb_polymer_entity_container_identifiers { auth_asym_ids }
    entity_poly { rcsb_mutation_count }
  }
  nonpolymer_entities { nonpolymer_comp { chem_comp { id name } } }
} }`;

/** "HOMO SAPIENS" → "Homo sapiens" (RCSB mixes cases). */
const species = (name) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

async function get(url, as = 'text') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return as === 'bytes' ? new Uint8Array(await res.arrayBuffer()) : res.text();
}

/** Whitespace tokenizer for one mmCIF data row ('quoted' and "quoted" values). */
export function cifTokens(line) {
  return [...line.matchAll(/'([^']*)'(?=\s|$)|"([^"]*)"(?=\s|$)|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

/** atom_site rows of a text CIF as objects keyed by column name. */
export function atomSite(cif) {
  const lines = cif.split('\n');
  const start = lines.findIndex((l) => l.startsWith('_atom_site.'));
  if (start < 0) return [];
  const cols = [];
  let i = start;
  for (; lines[i]?.startsWith('_atom_site.'); i++) cols.push(lines[i].trim().slice('_atom_site.'.length));
  const rows = [];
  for (; i < lines.length && /^(ATOM|HETATM)\s/.test(lines[i]); i++) {
    const t = cifTokens(lines[i]);
    rows.push(Object.fromEntries(cols.map((c, k) => [c, t[k]])));
  }
  return rows;
}

/** Chains (auth_asym_id) with residue range and hetero groups (water left out). */
export function summarize(rows) {
  const chains = new Map();
  for (const r of rows) {
    const id = r.auth_asym_id;
    const c = chains.get(id) ?? { id, atoms: 0, first: Infinity, last: -Infinity, hetero: new Set() };
    c.atoms++;
    const seq = Number(r.auth_seq_id);
    if (r.group_PDB === 'ATOM' && Number.isFinite(seq)) {
      c.first = Math.min(c.first, seq);
      c.last = Math.max(c.last, seq);
    }
    if (r.group_PDB === 'HETATM' && r.label_comp_id !== 'HOH') c.hetero.add(r.label_comp_id);
    chains.set(id, c);
  }
  return [...chains.values()].map((c) => ({
    id: c.id,
    atoms: c.atoms,
    ...(Number.isFinite(c.first) ? { residues: `${c.first}-${c.last}` } : {}),
    ...(c.hetero.size ? { hetero: [...c.hetero].sort() } : {}),
  }));
}

async function main() {
  const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
  const list = wanted.length ? ENTRIES.filter((e) => wanted.includes(e.pdb)) : ENTRIES;
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { ids: list.map((e) => e.pdb) } }),
  });
  const { data } = await res.json();
  const byId = new Map(data.entries.map((e) => [e.rcsb_id, e]));
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(`${ROOT}public/structures`, { recursive: true });
  mkdirSync(`${ROOT}src/content/structures`, { recursive: true });

  for (const entry of list) {
    const info = byId.get(entry.pdb);
    if (!info) throw new Error(`${entry.pdb}: not found in the RCSB Data API`);
    const id = entry.pdb.toLowerCase();
    const query = entry.coarse ? 'atoms?label_atom_id=CA&model_nums=1' : 'full?model_nums=1';
    const bcif = await get(`${MODELS}/${entry.pdb}/${query}&encoding=bcif`, 'bytes');
    const rows = atomSite(await get(`${MODELS}/${entry.pdb}/${query}&encoding=cif`));
    const gz = gzipSync(bcif, { level: 9 });
    writeFileSync(`${ROOT}public/structures/${id}.bcif.gz`, gz);

    const c = info.rcsb_primary_citation ?? {};
    const doc = {
      id,
      pdb: entry.pdb,
      title: info.struct.title,
      method: info.exptl.map((x) => x.method).join(', '),
      ...(info.rcsb_entry_info.resolution_combined?.[0] ? { resolution: info.rcsb_entry_info.resolution_combined[0] } : {}),
      organisms: [...new Set(info.polymer_entities.flatMap((p) => (p.rcsb_entity_source_organism ?? []).map((o) => species(o.scientific_name))))].sort(),
      released: info.rcsb_accession_info.initial_release_date.slice(0, 10),
      components: info.polymer_entities.map((p) => ({
        name: p.rcsb_polymer_entity.pdbx_description,
        organism: [...new Set((p.rcsb_entity_source_organism ?? []).map((o) => species(o.scientific_name)))].join(', ') || 'unknown',
        chains: p.rcsb_polymer_entity_container_identifiers.auth_asym_ids,
        mutations: p.entity_poly?.rcsb_mutation_count ?? 0,
        ...(p.rcsb_polymer_entity.pdbx_fragment ? { fragment: p.rcsb_polymer_entity.pdbx_fragment } : {}),
      })),
      ligands: (info.nonpolymer_entities ?? []).map((n) => ({ id: n.nonpolymer_comp.chem_comp.id, name: n.nonpolymer_comp.chem_comp.name.replace(/\n/g, '') })), // RCSB wraps long names
      citation: {
        title: c.title,
        authors: (c.rcsb_authors ?? []).join('; '),
        journal: [c.journal_abbrev, c.journal_volume, c.page_first].filter(Boolean).join(' '),
        year: c.year,
        ...(c.pdbx_database_id_DOI ? { doi: c.pdbx_database_id_DOI } : {}),
        ...(c.pdbx_database_id_PubMed ? { pmid: String(c.pdbx_database_id_PubMed) } : {}),
      },
      caveats: entry.caveats,
      file: `structures/${id}.bcif.gz`,
      bytes: gz.length,
      modelServerQuery: `${query}&encoding=bcif`,
      coarse: !!entry.coarse,
      ...(entry.show ? { show: entry.show } : {}),
      atomCount: rows.length,
      // 3Dmol drops hydrogens and keeps only the first alternate location: the parse test subtracts both.
      hydrogenAtoms: rows.filter((r) => r.type_symbol === 'H' || r.type_symbol === 'D').length,
      extraAltLocAtoms: rows.filter((r) => r.label_alt_id && r.label_alt_id !== '.' && r.label_alt_id !== 'A').length,
      chains: summarize(rows),
      license: 'CC0-1.0',
      sourceUrl: `https://www.rcsb.org/structure/${entry.pdb}`,
      retrievedAt: today,
    };
    writeFileSync(
      `${ROOT}src/content/structures/${id}.yaml`,
      `# Generated by scripts/fetch-structures.mjs from the RCSB Data API and ModelServer; caveats are our own wording.\n${stringify(doc, { lineWidth: 0 })}`,
    );
    console.log(`${entry.pdb}: ${rows.length} atoms, ${bcif.length} B BCIF → ${gz.length} B gz`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
