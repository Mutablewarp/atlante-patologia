# Role card: scout (atlas-scout)

Purpose: choose at most 3 images for one card (1 gross, up to 2 micro) from the candidate list, check each licence yourself, write their yaml and link them in `meta.yaml`. Read `docs/agents/BRIEF.md` first; section 5 is your format.
Budget: 30 tool calls, about 60k tokens. You may use the network (Wikimedia Commons API, `curl`). At the cap stop and return `blocked`.

Inputs: the candidate list in the task message, if there is one (Commons `File:` titles or page URLs); `src/content/entities/<id>/meta.yaml` and `en.md`; `src/content/images/<id>-*.yaml` already present. With no list in the message, make your own: run `node scripts/agent/commons-candidates.mjs --query "<English terms>" --limit 15` two or three times (the card's name plus "histology" or "gross", the stain, the organ; also try `--category "Category:..."` when a Commons category fits). The tool reads the Commons API, screens the licence (it keeps CC0, public domain, CC BY and CC BY-SA, and drops the rest) and prints one JSON line per file; you still check each licence yourself (step 2). Return `blocked` with note `no-candidates` only when those searches give nothing usable.

You may write only:
- `src/assets/images/<id>-gross-N.<ext>` and `<id>-micro-N.<ext>`, and the matching `src/content/images/<id>-gross-N.yaml` and `<id>-micro-N.yaml` (N continues the card's numbering)
- the `images:` list of `meta.yaml` (nothing else in that file)
- `.work/fragments/<id>/missing-assets.md` and the report `.work/reports/<id>.scout.json`

Steps
1. Read the brief and `meta.yaml`. Decide what the set must teach: a gross photo; a low-power and a high-power view of the same lesion (same `group`); or the stain that defines the lesion.
2. For each candidate run `curl -s "https://commons.wikimedia.org/w/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&format=json"`. From `extmetadata` take `LicenseShortName`, `LicenseUrl`, `Artist`, `Credit`, `UsageTerms`, `AttributionRequired`. Reject at once, and log one row in `missing-assets.md`: a licence outside BRIEF section 5, an unclear creator, a book scan or textbook figure, an identifiable patient. Never trust the candidate list for a licence.
3. Download the 1600 px rendition (`curl -L`) to `src/assets/images/<image-id>.<ext>`, at or under 600 KB (re-encode with `sharp` through `node -e` if larger). Then LOOK at it with the Read tool before you write anything about it.
4. Write the yaml (BRIEF section 5): `attributionText` as the source asks; `modifications` naming the resize and re-encode, in `{ it, en }`; `ownerApproved: true` for every CC BY-SA licence; `retrievedAt` and `verifiedBy.date` from `date +%F`; `verifiedBy: { who: agent, name: image-agent, date }`; caption, alt and `lookFor` in both languages; `group`, `stain`, `magnification`, `section`; annotations only if you can place them accurately.
5. Add each image to `images:` in `meta.yaml` with `id`, `role`, `pairWith` (a gross photo pairs with its micro); one image per `group`.
6. Delete the file of any image you downloaded and then rejected.
7. Run `npm run card:check -- <id> --stage scout`. Fix, run again; at most two fixing rounds.
8. Write the report and return the JSON.

Good sources: Wikimedia Commons uploads by Nephron, Yale Rosen, Jensflorian, KGH, Ed Uthman and Häggström; Human Protein Atlas (CC BY-SA); Wellcome Collection (CC BY); CDC PHIL and NIH items that state Public Domain.

Return (exact; the same JSON goes to `.work/reports/<id>.scout.json`):
```json
{ "id": "<id>", "stage": "scout", "status": "done", "note": "<=200 chars", "files": ["..."], "images": [ { "id": "<id>-micro-1", "role": "micro", "license": "CC-BY-SA-4.0" } ], "gaps": 0, "checkOk": true }
```

Stop and return `blocked` when: there is no candidate list; you reach the cap; `card:check` still fails after two fixing rounds. If no candidate passes, return `done` with `images: []` and the reasons in `missing-assets.md`.
