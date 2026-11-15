# Anatomy assets: licence record

What the interactive body (`public/anatomy/`) is made of, what each source states, and what the project changed. The project records what the sources state; it makes no claim of legal compliance, and this is not legal advice. Raw downloads are not committed (`.work/anatomy/raw/`, with names, sizes and SHA-256 in `SOURCES.txt` there). The build is `scripts/anatomy/build-body.mjs`; the choices are in `docs/BODY_SPEC.md` and `scripts/anatomy/organ-map.yaml`.

## BodyParts3D 4.0

- Source: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>, files of 2026-11-13: `isa_BP3D_4.0_obj_99.zip` (2,234 OBJ files) and the four tables `isa_parts_list_e.txt`, `isa_element_parts.txt`, `partof_parts_list_e.txt`, `partof_element_parts.txt`, plus `README_e.html`. Data release 4.0 of 2013-06-19 (OBJ files with "polygon reduction rate = 99%").
- Licence page <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html> (last updated 2025/02/27) and the README (License section, last updated 2025/02/25): Creative Commons Attribution 4.0 International. Credit asked for, verbatim: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".
- The header of every OBJ file says instead: "licensed under CC Attribution-Share Alike 2.1 Japan", with the credit "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan". The README's update history lists a licence update on 2011/08/25 and another on 2025/02/27.
- What the project does with the two texts: it shows the 2025 credit line, keeps the older header text recorded here, and distributes the derived meshes under **CC BY-SA 4.0** (the licence of the site's content, `LICENSE-CONTENT.md`), which carries the attribution of the 2025 text and the share-alike term of the header. Open question for the owner: ask the Database Center for Life Science which text governs.
- Used for: the shell (`skin`) and every organ of kind `mesh` in `scripts/anatomy/organ-map.yaml`, and the BodyParts3D boxes that the HRA fits are matched to (`bony pelvis`, `sternum`) and the anchors of the thyroid shape (`thyroid cartilage`, `trachea`).

## HRA 3D Reference Object Library, release v2.5

- Source: <https://humanatlas.io/3d-reference-library>. The page states: all HRA 3D reference objects are released under Attribution 4.0 International (CC BY 4.0); the purl page of each object carries `https://creativecommons.org/licenses/by/4.0/`. Objects are built from the Visible Human data (U.S. National Library of Medicine): the female objects from the female data, `lung-male` from the male data.
- Objects used (persistent address `https://purl.humanatlas.io/ref-organ/<object>/<version>`; the file named on that page is `cdn.humanatlas.io/digital-objects/ref-organ/<object>/<version>/assets/<file>.glb`): `uterus-female/v1.2`, `fallopian-tube-female-left/v1.2`, `fallopian-tube-female-right/v1.2`, `ovary-female-left/v1.3`, `ovary-female-right/v1.3`, `lung-male/v1.3` (the surfaces of its bronchopulmonary segments: BodyParts3D has no lung surface; file `3d-vh-m-lung.glb`, 10,941,068 bytes, sha256 `97fcec4753c60d5a968b9d92cdc68fe66a44ab19d85dec843cda3a66d3ab43ab`, licence read on its purl page 2026-11-15: `https://creativecommons.org/licenses/by/4.0/`), `mammary-gland-female-left/v1.1`, `mammary-gland-female-right/v1.1`, `pelvis-female/v1.3`, `sternum-female/v1.0`, `manubrium-female/v1.0`. The pelvis, sternum and manubrium are used only to compute the fits; they are not in the build.
- Citations asked for by the library page, by release: v1.0 and v1.1: Browne, Kristen, Leonard E. Cross, Bruce W. Herr II, Elizabeth G. Record, Ellen M. Quardokus, Andreas Bueckle, and Katy Börner. 2021. HuBMAP CCF 3D Reference Object Library (accessed March 12, 2021 for v1.0 and December 1, 2021 for v1.1). v1.2 and v1.3: Schlehlein, Heidi, Bruce W. Herr II, Ellen M. Quardokus, Andreas Bueckle, and Katy Börner. 2022. HuBMAP CCF 3D Reference Object Library (accessed May 06, 2022 for v1.2 and December 15, 2022 for v1.3).
- Terms of use of the library page: supplied with no warranties.

## Changes made by the project (all assets)

- BodyParts3D: the element files of each concept merged; frame converted from millimetres, Z up, to metres, Y up, body centred, feet at 0 (a rotation, no mirroring); welded; simplified to the triangle targets of spec §11; smooth normals recomputed; quantized and compressed with `EXT_meshopt_compression`; one mesh per organ, named by the organ id.
- HRA objects: the named nodes merged, moved and scaled into the BodyParts3D body (one scale from the box diagonals of the landmark pair, a translation, and a 12 mm offset backwards, see `organ-map.yaml`), simplified, normals recomputed, compressed as above. The page says that these organs are fitted from a female reference and that the base body is male.
- Thyroid gland: an original schematic shape (two ellipsoid lobes and an isthmus, `scripts/anatomy/schematic.mjs`) placed from the trachea and the thyroid cartilage; the page says it is schematic, not a scan.
- Colours are set by the viewer from the site's own tokens.

## Credit lines to show under the viewer and on the Licences page

- "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" (and, in this record, the older header text above).
- "Lungs and female organs (uterus, fallopian tubes, ovaries, breast): HRA 3D Reference Object Library, v2.5, CC BY 4.0, <https://humanatlas.io/3d-reference-library>; fitted into the base body and simplified by this project."
- "Changes: merged, simplified, recoloured, moved and scaled." The manifest carries the BodyParts3D line in `credit`; the HRA line and the changes line are added by the viewer task (B-4c).
