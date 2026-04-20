# ReportIQ Manual E2E Validation Pack

Use this pack to test the main connected flows with the seeded patient and local evidence index.

## Seeded Patient To Use

- Name: Lien Nguyen
- MRN: 184920
- DOB: 1968-03-15
- Sex: Female
- Primary clinician: Dr. A. Hernandez
- Conditions: Hypertension, Type 2 diabetes mellitus
- Medications: Lisinopril 10mg daily, Metformin 500mg BID, Atorvastatin 20mg nightly
- Allergies: Latex, Penicillin
- History summary: Right upper lobe pulmonary nodule under surveillance

## Known Seed Data Note

The seeded history summary currently says "62-year-old patient" even though the DOB corresponds to age 58 on 2026-03-24. Treat DOB and visible profile fields as the source of truth if you are checking age-dependent behavior.

## Uploadable Report File

Upload this file in Report Analyzer:

- `test-assets/lien-nguyen-2026-03-08-ct-chest-report.txt`

## 1. Patient Profile / Timeline Checks

Open the patient profile for Lien Nguyen and confirm:

- MRN shows `184920`
- DOB shows `1968-03-15`
- Gender shows `Female`
- Conditions include hypertension and type 2 diabetes
- Medications include lisinopril, metformin, and atorvastatin
- Allergies include latex and penicillin
- Recent reports include a CT chest and a chest radiograph

Open the timeline and confirm seeded items similar to:

- `CT chest w/ contrast uploaded`
- `Medication change`
- `Symptom check - cough`
- `CXR follow-up reviewed`

## 2. Report Upload Test

### File to upload

- `test-assets/lien-nguyen-2026-03-08-ct-chest-report.txt`

### Steps

1. Select patient `Lien Nguyen`
2. Open Report Analyzer
3. Upload the file above

### Expected result

- Upload succeeds without hanging
- Filename is shown after upload
- Summary mentions interval enlargement of the right upper lobe nodule
- Key findings mention `12 mm`, prior `8 mm`, and `spiculation`
- Recommended follow-up mentions `PET-CT` and `thoracic surgery consultation`
- Classification should read like CT chest / pulmonary nodule follow-up rather than a generic error
- A timeline item should be created or updated

## 3. Symptom Triage Test Cases

These are structured-form cases. Enter the fields directly in the triage UI.

### Case A: Low-risk chronic back pain

Use this to confirm the app does not hallucinate chest pain, syncope, PE, or ACS.

- Age: `27`
- Gender / sex: `Female`
- Main symptom: `chronic low back pain`
- Duration: `8`
- Duration unit: `months`
- Severity: `4`
- Location: `Back`
- Location detail: `lower back`
- Radiation: `None`
- Associated symptoms: none
- What makes it worse: `Sitting`
- What makes it better: `Movement`, `Stretching`
- Explicit red flags: `None reported`
- Relevant history: `Chronic back pain history`
- Additional details: `No fever, no weakness, no urinary symptoms, no trauma.`

Expected:

- Care level is `Self-care` or `Routine`
- Reasoning mentions chronic duration and no explicit red flags
- Differential includes mechanical or musculoskeletal back pain
- Result must not mention chest pain, pulmonary embolism, aortic syndrome, or syncope unless you explicitly entered those facts

### Case B: Routine upper respiratory illness

Use this to test a general non-back complaint.

- Age: `22`
- Gender / sex: `Male`
- Main symptom: `sore throat`
- Duration: `2`
- Duration unit: `days`
- Severity: `3`
- Location: `Throat`
- Radiation: `None`
- Associated symptoms: `Cough`, `Runny nose`
- What makes it worse: `Swallowing`
- What makes it better: `Hydration/fluids`
- Explicit red flags: `None reported`
- Relevant history: none
- Additional details: `No shortness of breath, no fever, still tolerating fluids.`

Expected:

- Care level is usually `Routine`
- Differential should look like URI / viral / throat-related rather than back pain
- No red-flag card should appear

### Case C: Urgent pneumonia-style respiratory case

Use this to test a higher-risk but not necessarily emergency respiratory scenario.

- Age: `63`
- Gender / sex: `Female`
- Main symptom: `cough and fever`
- Duration: `3`
- Duration unit: `days`
- Severity: `7`
- Location: `Chest`
- Radiation: `None`
- Associated symptoms: `Cough`, `Fever`, `Chills`, `Shortness of breath`
- What makes it worse: `Walking`
- What makes it better: `Rest`
- Explicit red flags: `High fever`
- Relevant history: `Diabetes`, `Asthma/lung disease`
- Additional details: `Breathing is harder than usual with exertion.`
- Temperature C: `39.2`
- SpO2: `94`

Expected:

- Care level is `Urgent` or higher
- Differential should mention infection / pneumonia / respiratory cause
- Recommendation should favor same-day or urgent in-person evaluation

### Case D: Emergency chest pain with minutes-based duration

Use this to verify that `minutes` duration works and emergency escalation is justified only with explicit high-risk facts.

- Age: `54`
- Gender / sex: `Male`
- Main symptom: `sudden chest tightness`
- Duration: `20`
- Duration unit: `minutes`
- Severity: `8`
- Location: `Chest`
- Radiation: `Arm`
- Associated symptoms: `Chest pressure`, `Shortness of breath`
- What makes it worse: `Exertion`
- What makes it better: `Rest`
- Explicit red flags: `Fainting or near-fainting`
- Relevant history: `Hypertension`, `Smoker`
- Additional details: `Pain started suddenly and feels heavy.`

Expected:

- Care level is `Emergency`
- Differential should mention ACS / PE / aortic syndrome or other acute chest causes
- Recommendation should clearly say emergency evaluation

### Case E: Headache / neurologic-style non-back test

- Age: `31`
- Gender / sex: `Other`
- Main symptom: `headache`
- Duration: `6`
- Duration unit: `hours`
- Severity: `6`
- Location: `Head`
- Radiation: `None`
- Associated symptoms: `Dizziness`, `Vision change`
- What makes it worse: `Stress`
- What makes it better: `Rest`
- Explicit red flags: `None reported`
- Relevant history: `Hypertension`
- Additional details: `No fainting, no speech change, no weakness.`

Expected:

- Result should stay focused on headache / neurologic / vestibular reasoning
- It should not drift into chest pain or back-pain logic
- Without explicit neuro red flags, the result should avoid alarmist emergency wording

## 4. Knowledge Center Search Queries

These queries should match the local evidence set that is currently bundled with the repo.

### Query 1

`pulmonary nodule follow up spiculation 12 mm PET CT`

Expected strong match:

- `Pulmonary Nodule Follow-up Primer`

### Query 2

`acute chest pain arm radiation dyspnea syncope`

Expected strong match:

- `Chest Pain Escalation Checklist`

### Query 3

`pneumonia hypoxemia confusion hemodynamic stability`

Expected strong match:

- `Pneumonia Initial Evaluation Notes`

### Query 4

`clinical decision support safety conservative recommendation uncertainty`

Expected strong match:

- `Clinical Decision Support Safety Notes`

## 5. Optional Copilot Prompts

Use these if you also want to test Copilot context grounding.

### Prompt 1

`Summarize Lien Nguyen's recent imaging and the next recommended step.`

Expected:

- Mentions enlarging right upper lobe nodule
- Mentions PET-CT and thoracic surgery consultation

### Prompt 2

`What evidence in the local knowledge base supports escalation for acute chest pain with arm radiation and shortness of breath?`

Expected:

- Mentions chest-pain escalation evidence
- Returns citations if that flow is available

### Prompt 3

`What should I watch for when a clinical decision support tool has incomplete patient context?`

Expected:

- Mentions uncertainty, red flags, confirmation with patient record, and conservative phrasing

## 6. Quick Pass / Fail Checklist

Mark the session as good only if all of the following are true:

- Report upload finishes and returns a usable summary
- Uploaded report findings are specific and not empty
- Triage low-risk back pain does not hallucinate chest-pain emergencies
- Triage can handle non-back cases like throat, chest, and headache complaints
- Minutes-based duration works in the form and affects urgency correctly
- Knowledge Center returns local evidence results for the queries above
- Patient profile and timeline show seeded patient context correctly
- Copilot, if tested, stays grounded in patient and evidence context rather than generic filler
