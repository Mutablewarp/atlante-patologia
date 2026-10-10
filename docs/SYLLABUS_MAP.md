# Syllabus map

Status: PHASE 0 draft, 2026-10-10. Scope and depth are **the owner's decision** (CHECKPOINT 1).

## How this was built

- Structure source: the only supplied reference, *Rubin's Pathology: Mechanisms of Human Disease*, 8th ed. (© 2020) — see [SOURCES.md](SOURCES.md).
- All 1,671 PDF pages were text-extracted locally (gitignored `.work/`). The heading tree (4,080 headings) was rebuilt from font styles; 817 headings carry a "pathology" or "clinical features" run-in label and were used as a proxy for disease-entity sections.
- The reference uses sentence-style headings. **None are reproduced here.** Topics below use standard disease/process names in our own grouping.
- Italian labels are *proposed* standard terms. They must be checked against an Italian reference the owner names (open question).
- "Ref pages" = PDF page numbers of the owner's file, for the claim-ledger and verifier agents. They are not printed book page numbers.

## Units

| Term | Meaning |
|---|---|
| Entity card | One page for one disease, lesion or process (schema in [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md)). |
| Core (tier 1) | High-yield for a standard Italian medical-degree *anatomia patologica* exam. Built first. |
| Extended (tier 2) | Rarer entities and detail. Built after all core content passes the gates. |
| Pattern Page | Cross-organ page for one process (horizontal layer). |

Estimates are planning numbers (±30%). Each batch in Phase 3 re-counts before starting.

## Summary

| ID | Module (EN) | Modulo (IT, proposed) | Ref pages | Entities est. | Core est. |
|---|---|---|---|---:|---:|
| **I. General pathology** | | | | | |
| g01 | Cell injury, adaptation and death | Danno, adattamento e morte cellulare | 26–82 | 28 | 18 |
| g02 | Inflammation | Infiammazione | 83–118 | 20 | 14 |
| g03 | Repair, regeneration and fibrosis | Riparazione, rigenerazione e fibrosi | 119–154 | 14 | 8 |
| g04 | Immunopathology | Immunopatologia | 155–192 | 30 | 16 |
| g05 | Neoplasia | Neoplasie | 193–270 | 35 | 20 |
| g06 | Genetic and developmental disorders | Malattie genetiche e dello sviluppo | 271–347 | 45 | 20 |
| g07 | Hemodynamic disorders | Disturbi emodinamici | 348–372 | 18 | 14 |
| g08 | Environmental and nutritional pathology | Patologia ambientale e nutrizionale | 373–413 | 30 | 12 |
| g09 | Infectious and parasitic diseases | Malattie infettive e parassitarie | 414–518 | 100 | 35 |
| **II. Systemic conditions** | | | | | |
| s10 | Aging | Invecchiamento | 520–528 | 6 | 2 |
| s11 | Systemic autoimmune diseases | Malattie autoimmuni sistemiche | 529–546 | 10 | 6 |
| s12 | Sepsis | Sepsi | 547–553 | 4 | 3 |
| s13 | Obesity, diabetes and complications | Obesità, diabete mellito e complicanze | 554–578 | 12 | 8 |
| s14 | Pregnancy and placenta | Patologia della gravidanza e della placenta | 579–605 | 30 | 10 |
| s15 | Systemic amyloidosis | Amiloidosi sistemica | 606–612 | 7 | 5 |
| **III. Organ systems** | | | | | |
| o16 | Blood vessels | Vasi sanguigni | 614–656 | 40 | 20 |
| o17 | Heart | Cuore | 657–718 | 50 | 28 |
| o18 | Respiratory system | Apparato respiratorio | 719–789 | 60 | 32 |
| o19 | Gastrointestinal tract | Tratto gastroenterico | 790–861 | 85 | 40 |
| o20 | Liver and biliary system | Fegato e vie biliari | 862–924 | 65 | 32 |
| o21 | Pancreas | Pancreas | 925–939 | 12 | 8 |
| o22 | Kidney | Rene | 940–997 | 55 | 28 |
| o23 | Lower urinary tract and male genital system | Basse vie urinarie e apparato genitale maschile | 998–1037 | 40 | 20 |
| o24 | Female genital system and peritoneum | Apparato genitale femminile e peritoneo | 1038–1097 | 65 | 30 |
| o25 | Breast | Mammella | 1098–1126 | 25 | 14 |
| o26 | Hematopathology (marrow, blood, nodes, spleen, thymus) | Ematopatologia | 1127–1218 | 80 | 38 |
| o27 | Endocrine system | Sistema endocrino | 1219–1265 | 50 | 26 |
| o28 | Skin | Cute | 1266–1323 | 50 | 22 |
| o29 | Head and neck (incl. salivary glands, ear) | Testa e collo | 1324–1353 | 45 | 18 |
| o30 | Bones, joints and soft tissue | Ossa, articolazioni e tessuti molli | 1354–1431 | 70 | 32 |
| o31 | Skeletal muscle and peripheral nerve | Muscolo scheletrico e nervo periferico | 1432–1464 | 35 | 14 |
| o32 | Central nervous system | Sistema nervoso centrale | 1465–1559 | 70 | 34 |
| o33 | Eye | Occhio | 1560–1581 | 25 | 8 |
| o34 | Forensic pathology (optional) | Patologia forense (opzionale) | 1582–1588 | 8 | 2 |
| | **Total before de-duplication** | | | **1,319** | **637** |
| | **After merging cross-listed entities (~10%)** | | | **~1,190** | **~590** |

Cross-listed examples merged into one canonical card with several lens tags: rheumatoid arthritis (s11/o30), tuberculosis (g09/o18), amyloidosis (s15/o17/o22), Langerhans cell histiocytosis (o18/o26/o30), granulomatosis with polyangiitis (o16/o18/o22/o29), Kaposi sarcoma (o16/o28), mycosis fungoides (o26/o28), hemochromatosis (o20/o30), Wilson disease (o20/o32), mesothelioma (o18/o19/o24), neuroblastoma (g06/o27), systemic sclerosis (s11/o19/o28).

### Derived workload (planning only)

| Item | Rule | Full scope | Core only |
|---|---|---:|---:|
| Entity cards | above | ~1,190 | ~590 |
| Flashcards (auto-generated) | ~8–12 per card | ~9,500–14,000 | ~4,700–7,000 |
| Vignette MCQs | ≥ 3 per card | ≥ 3,600 | ≥ 1,800 |
| Images wanted | 2–4 per card | 2,400–4,800 | 1,200–2,400 |
| Claims in ledger | ~25 per card | ~30,000 | ~15,000 |
| Pattern Pages | list below | 16 | 16 |

The image and review rows are the binding constraints; see [RISKS.md](RISKS.md) R1, R4, R5.

## Topic tree

Format: **group** — entities (standard names). (P) = Pattern Page candidate. ⚠ = edition-dependent, verify against current primary sources (see [SOURCES.md](SOURCES.md)).

### I. General pathology

**g01 Cell injury, adaptation and death**
- **Reversible injury** — hydropic (cellular) swelling, fatty change (steatosis), ischemic/hypoxic injury, ischemia–reperfusion injury.
- **Intracellular accumulations** — lipids, proteins (hyaline change), glycogen, pigments (lipofuscin, hemosiderin, melanin, bilirubin, exogenous pigments).
- **Proteostasis** — ubiquitin–proteasome system, heat shock proteins/chaperones, autophagy (and their failure in disease).
- **Adaptations** — atrophy, hypertrophy, hyperplasia (physiologic vs pathologic), metaplasia, dysplasia (P: adaptation→metaplasia→dysplasia).
- **Extracellular accumulations** — dystrophic vs metastatic calcification, amyloid (→ s15), hyaline.
- **Oxidative injury** — ROS sources, antioxidant defenses, free-radical injury.
- **Necrosis** — coagulative, liquefactive, caseous, fat (enzymatic), fibrinoid, gangrene (P: types of necrosis).
- **Programmed cell death** — apoptosis (extrinsic, intrinsic, BCL-2 family), necroptosis, pyroptosis, anoikis, NETosis, entosis; apoptosis vs necrosis comparison.

**g02 Inflammation**
- **Acute inflammation** — vascular changes, leukocyte recruitment (margination, rolling, adhesion, transmigration, chemotaxis), phagocytosis and killing (oxidative/non-oxidative).
- **Mediators** — complement, kinins, coagulation link; cytokines, chemokines; lipid mediators; NO.
- **Morphologic patterns** — serous, fibrinous, purulent/abscess, ulcer, pseudomembranous (P: acute vs chronic inflammation).
- **Chronic inflammation** — cell types, granulation tissue, granulomatous inflammation (P: granulomatous disease).
- **Outcomes and systemic effects** — resolution, scarring, chronicity; acute-phase response, fever, leukocytosis.
- **Disorders of inflammation** — complement deficiencies, leukocyte function defects (cross-link o26).

**g03 Repair, regeneration and fibrosis**
- Cell proliferative potential (labile/stable/permanent), stem cells, extracellular matrix, angiogenesis, granulation tissue.
- Wound healing by primary and secondary intention; remodeling.
- Abnormal repair — hypertrophic scar, keloid, dehiscence, contracture, chronic wounds; local and systemic factors impairing healing.
- Site-specific repair — liver, kidney, heart, CNS, bone (cross-links); fibrosis as end-stage organ pattern.

**g04 Immunopathology**
- **Immune system basics** — innate vs adaptive immunity, MHC, T- and B-cell function (prerequisite cards, not disease cards).
- **Hypersensitivity** — types I–IV with prototype diseases (P: hypersensitivity across organs).
- **Primary immunodeficiencies** — X-linked agammaglobulinemia, CVID, selective IgA deficiency, hyper-IgM, DiGeorge/22q11, SCID, Wiskott–Aldrich, ataxia–telangiectasia, complement defects.
- **Autoimmunity principles** — tolerance failure, molecular mimicry (→ s11).
- **Transplant pathology** — hyperacute, acute (cellular/antibody-mediated), chronic rejection; graft-versus-host disease.
- **HIV/AIDS** — transmission, viral biology, natural history, opportunistic diseases, effect of ART.

**g05 Neoplasia**
- **Definitions and nomenclature** — benign vs malignant, differentiation/anaplasia, tumor nomenclature rules (P: neoplasia families).
- **Diagnosis** — histologic criteria, marker studies (IHC), grading and staging ⚠ (TNM edition).
- **Invasion and metastasis** — routes (lymphatic, hematogenous, transcoelomic), metastatic cascade.
- **Cell cycle and its control** — cyclins/CDKs, RB, p53, DNA repair.
- **Hallmarks of cancer** — sustained proliferation, evasion of growth suppression and death, replicative immortality/senescence, angiogenesis, hypoxia, invasion, reprogrammed metabolism, immune evasion (checkpoints).
- **Genetic and epigenetic mechanisms** — driver mutations, oncogenes, tumor suppressors, genomic instability, epigenetics, clonal evolution, cancer stem cells, heterogeneity.
- **Carcinogens** — oncogenic viruses (HPV, EBV, HBV/HCV, HTLV-1, HHV-8, MCPyV), H. pylori, aflatoxin, chemical carcinogenesis (initiation/promotion), UV and ionizing radiation, asbestos.
- **Host effects** — cachexia, paraneoplastic syndromes.
- **Inherited cancer syndromes** — overview card linking organ entities.
- **Epidemiology** — sourced figures only.

**g06 Genetic and developmental disorders**
- **Cytogenetics** — numerical/structural abnormalities, FISH, microarrays (methods cards).
- **Chromosomal syndromes** — trisomy 21, 18, 13; Turner; Klinefelter; 22q11 deletion; other microdeletions.
- **Single-gene disorders** — inheritance patterns; amino-acid disorders (PKU, tyrosinemia, alkaptonuria); carbohydrate disorders (galactosemia, glycogen storage diseases); lysosomal storage diseases (Tay–Sachs, Niemann–Pick, Gaucher, mucopolysaccharidoses); membrane/receptor disorders (cystic fibrosis, familial hypercholesterolemia); structural proteins (Marfan, Ehlers–Danlos, osteogenesis imperfecta → o30).
- **Non-Mendelian inheritance** — triplet repeats (fragile X), mitochondrial disorders, imprinting (Prader–Willi/Angelman).
- **Congenital anomalies** — terminology (malformation, deformation, disruption, sequence, syndrome), teratogens, perinatal infections (TORCH).
- **Perinatal and pediatric disease** — prematurity, fetal growth restriction, neonatal respiratory distress syndrome, bronchopulmonary dysplasia, necrotizing enterocolitis, fetal hydrops, birth injury, SIDS.
- **Pediatric tumors** — hemangioma/lymphangioma, overview of embryonal tumors (neuroblastoma, Wilms, retinoblastoma, hepatoblastoma; canonical cards live in organ modules).

**g07 Hemodynamic disorders**
- Hyperemia and congestion; hemorrhage (types).
- Hemostasis overview (cross-link o16/o26); thrombosis — Virchow triad, arterial, cardiac, venous (DVT), fate of thrombi (P: thrombosis→embolism→infarction).
- Embolism — pulmonary, systemic arterial, fat, air, amniotic fluid.
- Infarction — red vs white, factors affecting outcome.
- Edema — Starling forces; cardiac, hepatic, renal, cerebral, pulmonary edema; effusions.
- Fluid loss and overload; shock (cardiogenic, hypovolemic, distributive/septic → s12), multiple organ dysfunction; DIC.

**g08 Environmental and nutritional pathology**
- **Pollution and toxins** — air pollution, tobacco smoke (active, environmental, in utero), metals (lead, mercury, arsenic, cadmium), carbon monoxide, agricultural and industrial chemicals.
- **Occupational disease** — asbestos (→ o18), organic toxins.
- **Physical agents** — UV light, ionizing radiation (acute radiation syndrome, local radiation injury, carcinogenesis), non-ionizing radiation, hypothermia, hyperthermia/heat stroke, burns, altitude illness.
- **Substance use** — alcohol (organ effects, fetal alcohol syndrome), drugs of abuse, IV drug complications.
- **Iatrogenic** — adverse drug reactions, exogenous hormones (oral contraceptives, menopausal hormone therapy).
- **Nutrition** — protein–energy malnutrition (marasmus, kwashiorkor), vitamins A, B-complex (B1, B3, B12/folate), C, D, E, K; trace elements.
- **Climate change and health** — one overview card (owner to confirm inclusion).

**g09 Infectious and parasitic diseases**
- **Principles** — virulence, host defenses, routes, susceptibility, immunocompromised host; patterns of tissue response (P: granulomatous disease; P: viral cytopathic effects).
- **RNA viruses** — common cold viruses, influenza, parainfluenza (croup), RSV, coronaviruses ⚠ (COVID-19 absent from reference), measles, rubella, Zika, mumps, rotavirus, noroviruses, hemorrhagic fevers (yellow fever, dengue, Ebola), West Nile.
- **DNA viruses** — adenovirus, parvovirus B19, poxviruses ⚠ (smallpox, mpox), herpesviruses (HSV-1/2, VZV, EBV, CMV, HHV-8), HPV.
- **Gram-positive bacteria** — S. aureus, coagulase-negative staphylococci, S. pyogenes, S. pneumoniae, group B streptococcus, diphtheria, listeriosis, anthrax.
- **Gram-negative bacteria** — pertussis, H. influenzae, N. meningitidis, gonorrhea, chancroid, granuloma inguinale, E. coli, salmonellosis/typhoid, shigellosis, cholera, Campylobacter, Klebsiella/Pseudomonas pneumonia, Legionella, melioidosis, brucellosis, tularemia, plague, bartonellosis.
- **Clostridia** — gas gangrene/food poisoning, tetanus, botulism, C. difficile (→ o19).
- **Other bacteria** — actinomycosis, nocardiosis; spirochetes (syphilis, Lyme disease, leptospirosis, relapsing fever, non-venereal treponematoses); chlamydiae (urogenital, LGV, trachoma, psittacosis); rickettsiae (Rocky Mountain spotted fever, typhus, Q fever); mycoplasma.
- **Mycobacteria** — tuberculosis (primary, secondary, miliary), leprosy, non-tuberculous mycobacteria (MAC).
- **Fungi** — candidiasis, aspergillosis, mucormycosis, cryptococcosis, Pneumocystis, histoplasmosis, coccidioidomycosis, blastomycosis, paracoccidioidomycosis, sporotrichosis, chromoblastomycosis, dermatophytes, mycetoma.
- **Protozoa** — malaria, babesiosis, toxoplasmosis, amebiasis, cryptosporidiosis, giardiasis, leishmaniasis, Chagas disease, African trypanosomiasis, primary amebic meningoencephalitis.
- **Helminths** — filariasis, onchocerciasis, loiasis, intestinal nematodes (ascariasis, hookworm, pinworm, strongyloidiasis, trichinosis), schistosomiasis, other flukes, tapeworms (cysticercosis, echinococcosis).
- Scope note: an Italian *anatomia patologica* course usually covers far less microbiology; core tier keeps ~35 entities with distinctive tissue pathology.

### II. Systemic conditions

**s10 Aging** — cellular senescence, telomeres, mechanisms of aging, progeroid syndromes, caloric restriction and longevity signaling. Mostly mechanism cards; 2 core.

**s11 Systemic autoimmune diseases** — autoimmunity mechanisms, autoantibodies as markers, systemic lupus erythematosus (and variants, drug-induced), rheumatoid arthritis (canonical card in o30), Sjögren syndrome, systemic sclerosis (diffuse/limited), mixed connective tissue disease, overview of vasculitides (→ o16).

**s12 Sepsis** ⚠ (definitions changed over time) — definitions, pathogenesis (cytokine storm, immunosuppression, coagulopathy), organ injury in sepsis, scoring systems.

**s13 Obesity, diabetes and complications** — energy balance and appetite regulation, BMI and obesity, insulin resistance, type 1 and type 2 diabetes ⚠ (classification), gestational diabetes, macrovascular and microvascular complications, infections in diabetes; cross-links to kidney, eye, nerve.

**s14 Pregnancy and placenta** — normal placenta and immune tolerance; placental infections (chorioamnionitis, villitis, TORCH, parvovirus, HIV, Listeria, syphilis); villitis of unknown etiology; vascular disorders (fetal vascular malperfusion, abruption, placenta accreta spectrum, infarcts, maternal malperfusion, chorangiosis); meconium effects; fetal growth disorders; spontaneous abortion; twin gestation; maternal complications (preeclampsia/eclampsia, HELLP, amniotic fluid embolism, intrahepatic cholestasis, acute fatty liver of pregnancy, peripartum cardiomyopathy); gestational trophoblastic disease (complete/partial mole, invasive mole, choriocarcinoma, placental-site trophoblastic tumor) ⚠.

**s15 Systemic amyloidosis** — amyloid structure and stains (P: amyloid across organs), AL, AA, ATTR (hereditary and wild-type), Aβ2-microglobulin, localized/endocrine forms, diagnosis and typing ⚠.

### III. Organ systems

**o16 Blood vessels** — normal vessel wall; hemostasis and endothelium; atherosclerosis (lesion evolution, risk factors, familial hypercholesterolemia, complications, restenosis); hypertensive vascular disease (essential, secondary, malignant); Mönckeberg sclerosis; Raynaud phenomenon; fibromuscular dysplasia; vasculitis ⚠ (nomenclature: large-vessel GCA, Takayasu; medium-vessel PAN, Kawasaki; small-vessel GPA, EGPA, MPA, IgA vasculitis, hypersensitivity; Buerger disease, Behçet; infectious) (P: vasculitis across organs); aneurysms (abdominal aortic, berry → o32, dissection, syphilitic, mycotic); veins (varicose veins, DVT, thrombophlebitis); lymphatics (lymphangitis, lymphedema); vascular tumors (hemangiomas, glomus tumor, hemangioendotheliomas, angiosarcoma, Kaposi sarcoma, lymphangiomas, lymphangiosarcoma).

**o17 Heart** — myocyte and conduction basics; hypertrophy and heart failure; congenital heart disease (ASD, VSD, PDA, AV canal, truncus, HLHS, anomalous venous return, tetralogy of Fallot, tricuspid atresia, transposition, coarctation, Ebstein, congenital heart block); ischemic heart disease (angina, myocardial infarction with time-dated morphology and complications, reperfusion, chronic ischemic cardiomyopathy); hypertensive heart disease; cor pulmonale; valvular disease (rheumatic fever and chronic rheumatic disease, infective endocarditis, NBTE, Libman–Sacks, calcific aortic stenosis, mitral annular calcification, mitral valve prolapse, carcinoid heart disease); myocarditis (viral, other infections, granulomatous/sarcoid, hypersensitivity, giant-cell); metabolic heart disease (thyroid, beriberi); cardiomyopathies ⚠ (dilated, hypertrophic, arrhythmogenic, restrictive incl. amyloid, noncompaction, storage diseases); sudden cardiac death; tumors (myxoma, rhabdomyoma, papillary fibroelastoma, others); pericardium (effusion/tamponade, acute and constrictive pericarditis); pathology of interventions (stents, bypass grafts, prosthetic valves, transplantation).

**o18 Respiratory system** — defenses and anatomy; congenital anomalies; airways (bronchitis/bronchiolitis, constrictive bronchiolitis, atelectasis, bronchiectasis); infections (bacterial pneumonia patterns, atypical pneumonia, tuberculosis, fungal, viral, abscess); diffuse alveolar damage/ARDS; rare alveolar diseases (alveolar proteinosis, diffuse alveolar hemorrhage, eosinophilic pneumonia, lipoid pneumonia); obstructive disease (chronic bronchitis, emphysema types, asthma); pneumoconioses (silicosis, coal workers', asbestosis and asbestos-related disease, berylliosis, talcosis); interstitial lung disease ⚠ (hypersensitivity pneumonitis, sarcoidosis, UIP/IPF, NSIP, DIP, RB-ILD, organizing pneumonia, AIP, LIP, pulmonary Langerhans cell histiocytosis, lymphangioleiomyomatosis); transplantation; vasculitis and granulomatosis; pulmonary hypertension ⚠ (classification), veno-occlusive disease; tumors ⚠ (hamartoma, lung carcinoma types incl. adenocarcinoma spectrum, squamous, small cell, large cell, carcinoids, lymphomas, metastases); pleura (pneumothorax, effusions, pleuritis, solitary fibrous tumor, mesothelioma).

**o19 Gastrointestinal tract**
- *Esophagus* — atresia/fistula, rings and webs, diverticula, achalasia, scleroderma esophagus, hiatal hernia, reflux esophagitis, Barrett esophagus, eosinophilic esophagitis, infectious and chemical esophagitis, varices, Mallory–Weiss/perforation, squamous cell carcinoma, adenocarcinoma.
- *Stomach* — pyloric stenosis, acute gastritis/erosions, H. pylori gastritis, autoimmune gastritis, reactive gastropathy, peptic ulcer, Ménétrier disease, Zollinger–Ellison, polyps (fundic gland, hyperplastic, adenoma), adenocarcinoma ⚠, MALT lymphoma, GIST, neuroendocrine tumors ⚠.
- *Small and large intestine* — Meckel diverticulum, necrotizing enterocolitis, meconium ileus, Hirschsprung disease, malabsorption (lactase deficiency, celiac disease, tropical sprue, autoimmune enteropathy, Whipple disease, bacterial overgrowth), obstruction (intussusception, volvulus, pseudo-obstruction), ischemic bowel disease, angiodysplasia, radiation enterocolitis, infectious enterocolitis, pseudomembranous colitis, diverticular disease, solitary rectal ulcer, Crohn disease, ulcerative colitis, microscopic colitis, pneumatosis.
- *Polyps and tumors* ⚠ — inflammatory, hamartomatous (juvenile, Peutz–Jeghers), serrated lesions, adenomas, polyposis syndromes (FAP, Lynch, serrated polyposis), colorectal adenocarcinoma, small-bowel adenocarcinoma, neuroendocrine tumors, mesenchymal tumors, lymphomas.
- *Appendix, anus, peritoneum* — appendicitis, appendiceal neoplasms ⚠, hemorrhoids, condyloma, anal squamous carcinoma, peritonitis, peritoneal cysts and tumors (→ o24).

**o20 Liver and biliary system**
- *Liver* — lobule/acinus; bilirubin metabolism and jaundice (Gilbert, Crigler–Najjar, Dubin–Johnson, Rotor, neonatal jaundice, cholestasis); cirrhosis; hepatic failure; portal hypertension (pre-, intra-, post-sinusoidal; Budd–Chiari; spontaneous bacterial peritonitis); viral hepatitis A–E and their morphology (acute, confluent necrosis, chronic hepatitis grading/staging ⚠); autoimmune hepatitis; alcohol-related liver disease; fatty liver disease ⚠ (nomenclature change to MASLD — verify); primary biliary cholangitis; primary sclerosing cholangitis; hemochromatosis and secondary iron overload; Wilson disease; α1-antitrypsin deficiency; cystic fibrosis liver disease; drug-induced liver injury patterns; porphyrias; vascular disorders (congestion, shock liver, infarction); infections and parasites; neonatal cholestasis and biliary atresia; benign lesions (hepatocellular adenoma ⚠ subtypes, focal nodular hyperplasia, nodular regenerative hyperplasia, hemangioma, cysts, angiomyolipoma, infantile hemangioma, mesenchymal hamartoma); malignant tumors (hepatocellular carcinoma, cholangiocarcinoma, hepatoblastoma, epithelioid hemangioendothelioma, angiosarcoma, metastases); transplantation.
- *Gallbladder and extrahepatic ducts* — anomalies, cholelithiasis (cholesterol, pigment stones), acute and chronic cholecystitis, cholesterolosis, gallbladder carcinoma, bile-duct and ampullary carcinoma.

**o21 Pancreas** — anomalies (annular, divisum, ectopic); acute pancreatitis; chronic pancreatitis ⚠ (incl. autoimmune); ductal adenocarcinoma and precursors (PanIN); acinar cell carcinoma; pancreatoblastoma; cystic neoplasms (serous, mucinous, IPMN, solid pseudopapillary); pancreatic neuroendocrine tumors ⚠ and functioning syndromes. (Diabetes → s13.)

**o22 Kidney**
- *Developmental and cystic* — Potter sequence, agenesis, hypoplasia, ectopia, horseshoe kidney, renal dysplasia, ADPKD, ARPKD, glomerulocystic disease, nephronophthisis/medullary cystic disease, medullary sponge kidney, simple and acquired cysts.
- *Glomerular* — nephrotic vs nephritic syndrome; minimal change, FSGS ⚠, HIV nephropathy, membranous nephropathy, diabetic nephropathy, amyloid, monoclonal immunoglobulin deposition, Alport, thin basement membrane, postinfectious GN, membranoproliferative GN ⚠, C3 glomerulopathy ⚠, lupus nephritis ⚠ (classification), IgA nephropathy, anti-GBM disease, ANCA GN (P: immune-complex patterns).
- *Vascular* — renal vasculitis, hypertensive nephrosclerosis, malignant hypertension, renal artery stenosis, atheroembolism, thrombotic microangiopathies, preeclampsia, sickle cell nephropathy, infarcts, cortical necrosis.
- *Tubulointerstitial* — acute tubular injury, pyelonephritis (acute, chronic, reflux), analgesic nephropathy, drug-induced interstitial nephritis, light-chain cast nephropathy, urate nephropathy, nephrocalcinosis; stones; obstruction/hydronephrosis; transplantation ⚠ (Banff).
- *Tumors* ⚠ — benign (papillary adenoma, oncocytoma, angiomyolipoma), Wilms tumor, renal cell carcinoma subtypes, urothelial carcinoma of the pelvis.

**o23 Lower urinary tract and male genital system** — anatomy; ureter (congenital, ureteritis, obstruction, tumors); bladder (exstrophy, diverticula, cystitis types, metaplastic lesions, urothelial papilloma, urothelial carcinoma spectrum ⚠, non-urothelial cancers); urethra (urethritis, caruncle, carcinoma); penis (congenital, balanitis, STI lesions, Peyronie, squamous carcinoma ⚠ HPV-related); scrotum (hydrocele and masses, scrotal carcinoma); testis (cryptorchidism, infertility, disorders of sex development, epididymitis, orchitis, torsion, germ cell neoplasia in situ, seminoma, non-seminomatous germ cell tumors ⚠, prepubertal tumors, sex cord–stromal tumors); prostate (prostatitis, nodular hyperplasia, adenocarcinoma ⚠ grading/grade groups).

**o24 Female genital system and peritoneum** — genital infections (STI and non-STI); vulva (developmental cysts, dermatoses incl. lichen sclerosus and lichen simplex chronicus, VIN ⚠ terminology, squamous carcinoma, verrucous carcinoma, extramammary Paget, benign tumors); vagina (adenosis/DES, atrophic vaginitis, squamous carcinoma, embryonal rhabdomyosarcoma); cervix (cervicitis, polyps, microglandular hyperplasia, squamous intraepithelial lesions ⚠, invasive squamous carcinoma, adenocarcinoma ⚠ HPV-associated vs independent); uterus (menstrual cycle, endometritis, adenomyosis, abnormal uterine bleeding, endometrial hyperplasia ⚠, polyps, endometrial carcinoma ⚠ molecular classification, stromal tumors, adenosarcoma, leiomyoma, leiomyosarcoma, intravenous leiomyomatosis); fallopian tube (salpingitis, ectopic pregnancy, tumors); ovary (functional cysts, polycystic ovary syndrome, stromal hyperthecosis, epithelial tumors ⚠ incl. borderline and high-grade serous origin, germ cell tumors, sex cord–stromal tumors, metastases); endometriosis; peritoneum (mesothelial tumors, serous tumors, pseudomyxoma peritonei).

**o25 Breast** — development and physiology; developmental anomalies; inflammatory lesions (acute mastitis, squamous metaplasia of lactiferous ducts, granulomatous mastitis, duct ectasia, fat necrosis, lymphocytic mastopathy); benign epithelial lesions (fibrocystic change, adenosis, radial scar, proliferative disease, intraductal papilloma, atypical hyperplasia); fibroepithelial lesions (fibroadenoma, phyllodes tumor); stromal lesions (PASH, fibromatosis, myofibroblastoma); carcinoma ⚠ (risk factors, DCIS, LCIS, Paget disease of the nipple, invasive carcinoma types, molecular subtypes, prognostic/predictive markers, staging); male breast (gynecomastia, carcinoma).

**o26 Hematopathology**
- *Marrow and myeloid* — hematopoiesis, marrow biopsy; neutrophil disorders (neutropenia, neutrophilia, functional defects), basophilia, monocytosis, mast-cell disorders; marrow failure (aplastic anemia, pure red cell aplasia, PNH).
- *Red cells* — anemia classification; production defects (iron deficiency, anemia of inflammation, megaloblastic, sideroblastic); hemolytic anemias (spherocytosis, elliptocytosis, G6PD and pyruvate kinase deficiency, sickle cell disease, thalassemias, immune and non-immune hemolysis); polycythemias.
- *Hemostasis* — vascular purpuras (HHT, IgA vasculitis), platelet disorders (ITP, TTP, HUS, functional defects), coagulopathies (hemophilia A and B, von Willebrand disease, DIC, liver disease, vitamin K), thrombophilias.
- *Myeloid neoplasms* ⚠ (WHO-HAEM5 vs ICC 2022 — "sources differ" likely) — CML, polycythemia vera, primary myelofibrosis, essential thrombocythemia, mastocytosis, myelodysplastic neoplasms, AML and its genetic subgroups.
- *Lymphoid* — reactive lymphadenopathies and patterns, plasmacytosis, lymphopenia; B- and T-lymphoblastic leukemia/lymphoma; mature B-cell neoplasms (CLL/SLL, follicular, mantle cell, marginal zone, lymphoplasmacytic, hairy cell, DLBCL, Burkitt, plasma cell neoplasms → o30); mature T/NK neoplasms (ATLL, mycosis fungoides/Sézary, ALCL, AITL, PTCL-NOS, extranodal NK/T); Hodgkin lymphoma (classic subtypes, nodular lymphocyte-predominant ⚠ renaming); immunodeficiency-associated lymphoproliferations.
- *Histiocytic* — reactive histiocytoses, histiocytic sarcoma, Langerhans cell histiocytosis.
- *Spleen and thymus* — splenomegaly, hypersplenism, asplenia, infarcts; thymic agenesis/hyperplasia, thymoma, thymic carcinoma ⚠.

**o27 Endocrine system**
- *Pituitary* — hypopituitarism (Sheehan, empty sella, others), pituitary hyperplasia, pituitary adenomas ⚠ (renamed PitNETs — verify) by lineage, pituitary carcinoma, diabetes insipidus, SIADH, hypothalamic disorders.
- *Thyroid* — development and anomalies (thyroglossal duct cyst), hypo- and hyperthyroidism, goiter (diffuse, multinodular, dyshormonogenetic), thyroiditis (acute, Hashimoto, subacute granulomatous, Riedel, painless/postpartum), Graves disease, toxic multinodular goiter, follicular adenoma, NIFTP ⚠, papillary, follicular, poorly differentiated, anaplastic and medullary carcinoma ⚠.
- *Parathyroid* — primary (adenoma, hyperplasia, carcinoma), secondary and tertiary hyperparathyroidism, PTHrP, hypoparathyroidism, pseudohypoparathyroidism.
- *Adrenal* — congenital adrenal hyperplasia, Cushing syndrome, hyperaldosteronism, virilizing tumors, adrenal insufficiency (acute, Addison, autoimmune polyendocrine syndromes, secondary/tertiary), cortical adenoma and carcinoma, myelolipoma; pheochromocytoma and paragangliomas ⚠; neuroblastoma and ganglioneuroma; MEN syndromes (cross-link).
- *Pineal* — pineal tumors (→ o32).

**o28 Skin** — structure and lesion terminology; epidermal disorders (ichthyoses, Darier disease, psoriasis, pemphigus); dermal–epidermal junction (epidermolysis bullosa, bullous pemphigoid, dermatitis herpetiformis, erythema multiforme/SJS–TEN, cutaneous lupus) (P: blistering by level); vascular-bed inflammation (urticaria/angioedema, lichen planus, leukocytoclastic vasculitis, contact dermatitis, granulomatous dermatitis, sarcoidosis, granuloma annulare); dermal connective tissue (scleroderma/morphea); panniculitis (erythema nodosum, erythema induratum); acne; infections and infestations (impetigo, superficial and deep fungi, viral lesions incl. warts and molluscum, scabies); melanocytic lesions (lentigo, nevi, dysplastic nevi, melanoma ⚠ staging); keratinocyte tumors (seborrheic and actinic keratosis, basal cell carcinoma, squamous cell carcinoma, keratoacanthoma); Merkel cell carcinoma; adnexal and fibrohistiocytic tumors; cutaneous lymphomas; HIV-related skin disease; paraneoplastic skin signs.

**o29 Head and neck** — oral cavity (developmental anomalies, infections, bullous lesions, benign tumors, leukoplakia/erythroplakia and oral epithelial dysplasia ⚠, squamous cell carcinoma, lip and tongue lesions); jaws (odontogenic cysts and tumors ⚠); nose and sinuses (rhinitis, inflammatory polyps, sinusitis, granulomatous infections, rhinoscleroma, fungal sinusitis, GPA, benign tumors incl. sinonasal papillomas, SCC, olfactory neuroblastoma, extranodal NK/T-cell lymphoma); nasopharynx and oropharynx (lymphoid hyperplasia, angiofibroma, HPV-associated oropharyngeal SCC ⚠, nasopharyngeal carcinoma, Waldeyer ring lymphomas, plasmacytoma, chordoma); larynx (laryngitis, vocal cord nodules/polyps, papillomatosis, squamous carcinoma); salivary glands (sialadenitis, Sjögren syndrome, pleomorphic adenoma, Warthin tumor, other adenomas, mucoepidermoid, adenoid cystic, acinic cell and secretory carcinoma ⚠); ear (external ear lesions, otitis media, cholesteatoma, paragangliomas, otosclerosis, Ménière disease, ototoxicity, labyrinthitis, vestibular schwannoma).

**o30 Bones, joints and soft tissue**
- *Bone basics* — structure, ossification, growth plate (prerequisite cards).
- *Developmental and metabolic* — achondroplasia, osteogenesis imperfecta, osteopetrosis, mucopolysaccharidoses, scurvy, cretinism effects, scoliosis/kyphosis, progressive diaphyseal dysplasia; osteoporosis (primary, secondary), osteomalacia and rickets, hyperparathyroid bone disease, renal osteodystrophy, Paget disease, Gaucher bone disease.
- *Injury and reaction* — fracture and healing, stress fracture, osteonecrosis, heterotopic ossification, myositis ossificans; osteomyelitis (pyogenic, tuberculous/Pott, syphilitic).
- *Tumor-like and tumors* ⚠ — Langerhans cell histiocytosis, fibrous dysplasia, non-ossifying fibroma, simple and aneurysmal bone cysts, osteoma, osteoid osteoma, osteoblastoma, osteochondroma, enchondroma/enchondromatosis, chondroblastoma, giant cell tumor, osteosarcoma, chondrosarcoma, Ewing sarcoma, plasma cell myeloma, metastases (P: bone-lesion location/age matrix).
- *Joints* — synovial joint structure, osteoarthritis, neuropathic joint, rheumatoid arthritis, spondyloarthropathies (ankylosing spondylitis, reactive, psoriatic, enteropathic), juvenile arthritis, Lyme arthritis, infectious arthritis, gout, CPPD, hydroxyapatite deposition, hemophilic arthropathy, ochronosis, ganglion, synovial chondromatosis, tenosynovial giant cell tumor.
- *Soft tissue* ⚠ — nodular fasciitis, fibromatoses, fibrosarcoma, undifferentiated pleomorphic sarcoma, lipoma, liposarcoma subtypes, rhabdomyosarcoma, smooth-muscle tumors, vascular tumors (→ o16), synovial sarcoma.

**o31 Skeletal muscle and peripheral nerve**
- *Muscle* — fiber types and general reactions; muscular dystrophies (Duchenne/Becker, limb-girdle, congenital, myotonic, oculopharyngeal, facioscapulohumeral); congenital myopathies (central core, nemaline, centronuclear/myotubular); inflammatory myopathies ⚠ (polymyositis, dermatomyositis, inclusion body myositis, immune-mediated necrotizing myopathy, vasculitic); myasthenia gravis, Lambert–Eaton; metabolic myopathies (Pompe, McArdle, lipid, mitochondrial, myoadenylate deaminase, periodic paralyses); rhabdomyolysis; type II atrophy, critical illness myopathy; denervation.
- *Peripheral nerve* — axonal degeneration vs segmental demyelination; neuropathies (diabetic, uremic, critical illness, alcoholic, nutritional, Guillain–Barré, CIDP, ganglionitis, vasculitic, paraproteinemic, amyloid, paraneoplastic, toxic, hereditary, HIV, idiopathic); trauma (traumatic neuroma, Morton neuroma); tumors (schwannoma, neurofibroma, MPNST); paraneoplastic neuromuscular syndromes.

**o32 Central nervous system** — cells and reactions; raised intracranial pressure, edema, herniation, hydrocephalus; trauma (epidural, subdural, contusion, diffuse axonal injury, chronic traumatic encephalopathy); cerebrovascular disease (hypoxic–ischemic encephalopathy, infarction, intracerebral hemorrhage, subarachnoid hemorrhage/berry aneurysm, vascular malformations, small-vessel disease, CADASIL); infections (bacterial meningitis, abscess, TB, fungal, viral encephalitis incl. HSV and arboviruses, SSPE, PML, HIV, parasites, prion diseases); demyelinating disease (multiple sclerosis, NMO spectrum, ADEM, CLIPPERS, leukodystrophies — metachromatic, Krabbe, adrenoleukodystrophy); toxic–metabolic (storage diseases, PKU, Wilson, hepatic and other metabolic encephalopathies, vitamin deficiencies, alcohol); neurodegeneration (Alzheimer disease, frontotemporal lobar degeneration, Lewy body disease, Parkinson disease, Huntington disease, spinocerebellar degenerations, Friedreich ataxia, ALS) (P: proteinopathies); malformations (neural tube defects, Chiari, holoprosencephaly, cortical malformations, perinatal injury, chromosomal); tumors ⚠ (WHO CNS5 — reference uses older grading: meningioma, diffuse gliomas incl. IDH status, pilocytic astrocytoma, PXA, oligodendroglioma, ependymoma, choroid plexus tumors, medulloblastoma, ETMR, AT/RT, craniopharyngioma, germ cell tumors, hemangioblastoma, neuronal/glioneuronal tumors, pineal tumors, primary CNS lymphoma, cysts, metastases, hereditary tumor syndromes).

**o33 Eye** — eyelids; physical and chemical injury; conjunctiva (hemorrhage, conjunctivitis, pinguecula/pterygium); orbit (proptosis, thyroid eye disease, idiopathic orbital inflammation); cornea (herpetic keratitis, onchocerciasis, arcus, degenerations, dystrophies); lens (cataract, presbyopia, phacoantigenic uveitis); uvea (uveitis, sympathetic ophthalmia, sarcoidosis); retina (hemorrhage, vascular occlusion, hypertensive and diabetic retinopathy, detachment, retinitis pigmentosa, age-related macular degeneration, cherry-red spot, angioid streaks, retinopathy of prematurity); optic nerve (papilledema, optic atrophy); glaucoma; myopia; phthisis bulbi; tumors (uveal melanoma, retinoblastoma, metastases).

**o34 Forensic pathology (optional)** — role of autopsy and death investigation systems (reference is US-centred; Italian medico-legal system differs — owner to decide whether to include), natural death, blunt and penetrating trauma, asphyxia, environmental deaths, intoxication.

## Pattern Pages (horizontal layer, ≥ the spec's minimum set)

| ID | Pattern | Main modules linked |
|---|---|---|
| p01 | Types of necrosis | g01, o17, o18, o20, o21, o25, o32, g09 |
| p02 | Acute vs chronic inflammation | g02, every organ module |
| p03 | Granulomatous diseases | g02, g09, o18, o19, o28, o30 |
| p04 | Amyloid across organs | s15, o17, o22, o27, o31 |
| p05 | Thrombosis → embolism → infarction | g07, o16, o17, o18, o22, o32 |
| p06 | Adaptation → metaplasia → dysplasia → carcinoma | g01, g05, o19, o24, o18, o23 |
| p07 | Neoplasia families (carcinoma, sarcoma, lymphoma, germ cell, neuroendocrine, embryonal "-blastoma") | g05, all organ modules |
| p08 | Calcification (dystrophic vs metastatic) | g01, o17, o22, o27 |
| p09 | Pigments and deposits (hemosiderin, lipofuscin, melanin, bilirubin, iron, copper) | g01, o20, o26 |
| p10 | Edema and effusions | g07, o17, o18, o20, o22, o32 |
| p11 | Vasculitis across organs | o16, o18, o22, o28, s11 |
| p12 | Hypersensitivity types I–IV across organs | g04, o18, o22, o28 |
| p13 | Fibrosis and end-stage organ (cirrhosis, pulmonary fibrosis, end-stage kidney) | g03, o18, o20, o22 |
| p14 | HPV-related lesions across sites | g05, g09, o24, o23, o29, o28 |
| p15 | EBV-related diseases across sites | g09, o26, o29 |
| p16 | Protein misfolding and neurodegeneration | g01, o32 |

## Recommended order

1. **Phase 2 vertical slice: g01 Cell injury, adaptation and death** + Pattern Page **p01 Types of necrosis** (+ p06 if time). Reason: it is the foundation every later module links to, it exercises all relation types, and p01 is the strongest demonstration of cross-organ learning. Links to organ entities not yet published render as plain text with a "planned" label (no dead links, no placeholder pages).
2. Phase 3 batches follow the table order: g02 → g09, then s10–s15, then o16–o33; o34 last or never.
3. Within each batch: core tier first; extended tier only after all core modules pass the gates (owner may decide to stop at core).

## Gaps the reference cannot fill (to source elsewhere)

- Content newer than late 2019: COVID-19, mpox nomenclature, WHO 5th-edition tumor classifications, MASLD nomenclature, WHO CNS5, WHO-HAEM5/ICC 2022, UICC TNM 9 — verify per item.
- Italian official terminology (no Italian reference supplied).
- Italian medico-legal framework (if o34 is kept).
