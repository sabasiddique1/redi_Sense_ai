from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Any


INSTRUCTION_PATTERNS = (
  "you are",
  "summarize",
  "summarise",
  "top risks",
  "patient context",
  "ignore previous",
  "act as",
  "dummy",
  "write a",
  "tell me",
  "what is",
)

SYMPTOM_KEYWORDS = (
  "pain",
  "ache",
  "pressure",
  "tightness",
  "shortness of breath",
  "breath",
  "cough",
  "fever",
  "weakness",
  "dizzy",
  "dizziness",
  "headache",
  "nausea",
  "vomiting",
  "diarrhea",
  "diarrhoea",
  "fatigue",
  "palpitations",
  "chest",
  "abdominal",
  "abdomen",
  "back pain",
  "rash",
  "swelling",
  "syncope",
  "faint",
  "numbness",
  "tingling",
  "bleeding",
  "confusion",
)

FEATURE_LABELS: tuple[tuple[str, tuple[str, ...]], ...] = (
  ("chest pain or pressure", ("chest pain", "chest pressure", "chest tightness")),
  ("shortness of breath", ("shortness of breath", "difficulty breathing", "dyspnea")),
  ("cough", ("cough", "wheeze", "sputum")),
  ("sore throat or congestion", ("sore throat", "throat pain", "runny nose", "congestion")),
  ("fever or chills", ("fever", "chills", "rigors")),
  ("headache", ("headache", "migraine")),
  ("nausea or vomiting", ("nausea", "vomiting")),
  ("diarrhea", ("diarrhea", "diarrhoea")),
  ("abdominal pain", ("abdominal pain", "stomach pain", "belly pain", "abdomen")),
  ("back pain", ("back pain",)),
  ("dizziness or lightheadedness", ("dizziness", "lightheaded")),
  ("palpitations", ("palpitations", "racing heart")),
  ("weakness or fatigue", ("weakness", "fatigue")),
  ("rash or swelling", ("rash", "swelling")),
  ("vision change", ("vision change", "blurred vision", "double vision")),
  ("confusion", ("confusion", "confused", "not acting right")),
  ("numbness or tingling", ("numbness", "tingling")),
  ("bleeding", ("bleeding", "black stool", "blood in stool")),
)

SEVERITY_ADJECTIVES: tuple[tuple[str, tuple[str, ...]], ...] = (
  ("severe", ("severe", "worst")),
  ("moderate", ("moderate",)),
  ("mild", ("mild",)),
)

LOCATION_LABELS = {
  "back": "back",
  "neck": "neck",
  "chest": "chest",
  "abdomen": "abdomen",
  "head": "head",
  "face_mouth": "face or mouth",
  "throat": "throat",
  "pelvis_flank": "pelvis or flank",
  "urinary_genital": "urinary or genital area",
  "arm_leg": "arm or leg",
  "joint": "joint",
  "skin": "skin or soft tissue",
  "generalized": "generalized body area",
  "other": "other location",
}

RADIATION_LABELS = {
  "neck": "neck",
  "arm": "arm",
  "jaw": "jaw",
  "shoulder": "shoulder",
  "leg": "leg",
  "groin": "groin",
  "abdomen": "abdomen",
  "other": "another area",
}

ASSOCIATED_SYMPTOM_LABELS = {
  "numbness_tingling": "numbness or tingling",
  "weakness": "weakness",
  "shortness_of_breath": "shortness of breath",
  "chest_pressure": "chest pressure",
  "fever": "fever",
  "chills": "chills",
  "nausea_vomiting": "nausea or vomiting",
  "cough": "cough",
  "sore_throat": "sore throat",
  "runny_nose": "runny nose or congestion",
  "diarrhea": "diarrhea",
  "urinary_symptoms": "urinary symptoms",
  "weight_loss": "weight loss",
  "headache": "headache",
  "dizziness": "dizziness",
  "palpitations": "palpitations",
  "fatigue": "fatigue",
  "rash": "rash",
  "swelling": "swelling",
  "vision_change": "vision change",
  "confusion": "confusion",
}

FACTOR_LABELS = {
  "movement": "movement",
  "exertion": "exertion",
  "sitting": "sitting",
  "standing": "standing",
  "walking": "walking",
  "lifting": "lifting",
  "deep_breathing": "deep breathing",
  "coughing": "coughing",
  "eating": "eating",
  "swallowing": "swallowing",
  "urination": "urination",
  "stress": "stress",
  "lying_flat": "lying flat",
  "rest": "rest",
  "stretching": "stretching",
  "heat_ice": "heat or ice",
  "otc_pain_meds": "over-the-counter pain medication",
  "position_change": "position changes",
  "hydration": "hydration or fluids",
  "inhaler": "inhaler use",
  "antacid": "antacid use",
  "nothing": "nothing helps",
}

RED_FLAG_LABELS = {
  "fainting": "Fainting or near-fainting was reported",
  "severe_breathing_trouble": "Severe breathing trouble was reported",
  "new_confusion": "New confusion or marked mental-status change was reported",
  "seizure_or_worst_headache": "A seizure or worst-headache-type red flag was reported",
  "speech_or_facial_change": "A new speech or facial neurologic change was reported",
  "new_weakness_or_numbness": "A new weakness or numbness red flag was reported",
  "bowel_bladder_change": "Loss of bowel or bladder control was reported",
  "saddle_anesthesia": "Saddle numbness was reported",
  "recent_major_trauma": "Recent major trauma was reported",
  "unable_to_walk": "Unable to walk or stand was reported",
  "persistent_vomiting": "Persistent vomiting or inability to keep fluids down was reported",
  "high_fever": "High fever was reported",
  "severe_allergic_swelling": "Severe swelling or allergic-reaction features were reported",
  "heavy_bleeding": "Heavy bleeding was reported",
}

HISTORY_LABELS = {
  "chronic_back_pain": "chronic back pain history",
  "recent_strain_or_lifting": "recent strain or lifting",
  "heart_disease": "heart disease",
  "hypertension": "hypertension",
  "blood_clot_history": "blood clot history",
  "asthma_lung_disease": "asthma or chronic lung disease",
  "cancer_history": "cancer history",
  "osteoporosis": "osteoporosis",
  "kidney_stone_history": "kidney stone history",
  "pregnancy": "pregnancy",
  "diabetes": "diabetes",
  "immunocompromised": "immunocompromised state",
  "recent_surgery_or_immobility": "recent surgery or immobility",
  "stroke_or_seizure_history": "stroke or seizure history",
  "smoker": "smoking history",
}

CARDIOPULMONARY_DIFFERENTIAL_TERMS = (
  "acute coronary",
  "cardiac",
  "pulmonary embol",
  "aortic",
  "heart failure",
)


@dataclass
class TriageValidationResult:
  is_valid: bool
  normalized_text: str
  message: str | None = None


def _dedupe(items: list[str]) -> list[str]:
  return list(dict.fromkeys(item for item in items if item))


def _clean_optional_text(value: Any) -> str | None:
  if not isinstance(value, str):
    return None
  cleaned = re.sub(r"\s+", " ", value).strip()
  return cleaned or None


def _strip_template_hints(text: str) -> str:
  sanitized = text
  sanitized = re.sub(r"(?i)red flags\s*\([^)]+\)", "Red flags", sanitized)
  sanitized = re.sub(r"(?i)vitals if known\s*\([^)]+\)", "Vitals if known", sanitized)
  return sanitized


def normalize_triage_input(text: str) -> str:
  return re.sub(r"\s+", " ", _strip_template_hints(text)).strip()


def validate_triage_input(text: str) -> TriageValidationResult:
  normalized = normalize_triage_input(text)
  lowered = normalized.lower()

  if len(normalized) < 8:
    return TriageValidationResult(
      is_valid=False,
      normalized_text=normalized,
      message=(
        "Please enter actual symptoms for triage, including what the patient is feeling, "
        "how long it has been happening, severity, and any warning signs."
      ),
    )

  if any(pattern in lowered for pattern in INSTRUCTION_PATTERNS):
    return TriageValidationResult(
      is_valid=False,
      normalized_text=normalized,
      message=(
        "This looks like an instruction rather than symptom input. Please describe the "
        "patient's symptoms, duration, severity, and associated red flags."
      ),
    )

  token_count = len(re.findall(r"[a-z0-9]+", lowered))
  contains_symptom_keyword = any(keyword in lowered for keyword in SYMPTOM_KEYWORDS)
  contains_duration_hint = bool(
    re.search(r"\b(?:x|for|since)\b", lowered)
    or re.search(r"\b\d+\s*(?:hour|hr|day|week|month|minute)s?\b", lowered)
  )

  if not contains_symptom_keyword and not contains_duration_hint:
    return TriageValidationResult(
      is_valid=False,
      normalized_text=normalized,
      message=(
        "I could not identify clinical symptoms in that text. Please enter symptom details "
        "such as location, duration, severity, associated symptoms, and any red flags."
      ),
    )

  if token_count < 3:
    return TriageValidationResult(
      is_valid=False,
      normalized_text=normalized,
      message=(
        "Please provide a bit more symptom detail, including duration, severity, and "
        "associated symptoms."
      ),
    )

  return TriageValidationResult(is_valid=True, normalized_text=normalized)


def _extract_phrase(text: str, phrases: tuple[str, ...]) -> bool:
  lowered = text.lower()
  return any(phrase in lowered for phrase in phrases)


def _extract_patient_context(text: str) -> str | None:
  lowered = text.lower()
  match = re.search(
    r"\b(?P<age>\d{1,3})\s*(?:yo|y/o|yr|yrs|year old|year-old)\s*(?P<sex>male|female|man|woman|m|f)?\b",
    lowered,
  )
  if not match:
    return None

  age = match.group("age")
  sex = match.group("sex")
  if not sex:
    return f"{age}-year-old patient"

  normalized_sex = {
    "m": "male",
    "male": "male",
    "man": "male",
    "f": "female",
    "female": "female",
    "woman": "female",
  }.get(sex, sex)
  return f"{age}-year-old {normalized_sex}"


def _extract_duration_phrase(text: str) -> str | None:
  patterns = (
    r"\bx\s*\d+\s*(?:minute|min|hour|hr|day|week|month|year)s?\b",
    r"\bfor\s+\d+\s*(?:minute|min|hour|hr|day|week|month|year)s?\b",
    r"\bsince\s+(?:yesterday|today|last night|this morning|this afternoon|this evening)\b",
    r"\bsince\s+\d+\s*(?:minute|min|hour|hr|day|week|month|year)s?\s+ago\b",
  )
  for pattern in patterns:
    match = re.search(pattern, text)
    if match:
      return match.group(0).replace("x ", "").replace("for ", "").strip()
  return None


def _extract_severity_phrase(text: str) -> str | None:
  numeric_match = re.search(r"\b(?:severity\s*)?(\d{1,2}/10)\b", text.lower())
  if numeric_match:
    return numeric_match.group(1)

  for label, phrases in SEVERITY_ADJECTIVES:
    if _extract_phrase(text, phrases):
      return label
  return None


def _extract_vitals_summary(text: str) -> str | None:
  lowered = text.lower()
  vitals: list[str] = []

  bp_match = re.search(r"\b(?:bp|blood pressure)\s*(\d{2,3}/\d{2,3})\b", lowered)
  if bp_match:
    vitals.append(f"BP {bp_match.group(1)}")

  heart_rate_match = re.search(r"\b(?:hr|heart rate|pulse)\s*(\d{2,3})\b", lowered)
  if heart_rate_match:
    vitals.append(f"HR {heart_rate_match.group(1)}")

  temp_match = re.search(r"\b(?:temp|temperature)\s*(\d{2,3}(?:\.\d+)?)\b", lowered)
  if temp_match:
    vitals.append(f"Temp {temp_match.group(1)}")

  oxygen_match = re.search(r"\b(?:spo2|o2 sat|oxygen saturation)\s*(\d{2,3})%?\b", lowered)
  if oxygen_match:
    vitals.append(f"SpO2 {oxygen_match.group(1)}%")

  if not vitals:
    return None
  return ", ".join(vitals)


def _extract_feature_labels(text: str) -> list[str]:
  return [
    label
    for label, phrases in FEATURE_LABELS
    if _extract_phrase(text, phrases)
  ]


def _duration_bucket(duration_value: int | None, duration_unit: str | None) -> str | None:
  if duration_value is None or duration_unit is None:
    return None

  if duration_unit == "minutes":
    return "acute"
  if duration_unit == "hours":
    return "acute"
  if duration_unit == "days":
    return "acute" if duration_value <= 14 else "subacute"
  if duration_unit == "weeks":
    return "subacute" if duration_value <= 6 else "chronic"
  return "chronic"


def normalize_structured_triage_input(
  structured_input: dict[str, Any],
  patient_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
  patient_context = patient_context or {}

  age = structured_input.get("age") or patient_context.get("age")
  sex = structured_input.get("sex") or patient_context.get("sex")
  main_symptom = _clean_optional_text(structured_input.get("main_symptom")) or "Symptom"
  duration_value = structured_input.get("duration_value")
  duration_unit = structured_input.get("duration_unit")
  duration_bucket = _duration_bucket(duration_value, duration_unit)
  severity = structured_input.get("severity")
  location = structured_input.get("location")
  location_detail = _clean_optional_text(structured_input.get("location_detail"))
  radiation = [item for item in structured_input.get("radiation", []) if item != "none"]
  radiation_detail = _clean_optional_text(structured_input.get("radiation_detail"))
  associated_symptoms = _dedupe(list(structured_input.get("associated_symptoms", [])))
  aggravating_factors = _dedupe(list(structured_input.get("aggravating_factors", [])))
  relieving_factors = _dedupe(list(structured_input.get("relieving_factors", [])))
  red_flags = [] if structured_input.get("no_red_flags") else _dedupe(list(structured_input.get("red_flags", [])))
  relevant_history = _dedupe(list(structured_input.get("relevant_history", [])))
  history_detail = _clean_optional_text(structured_input.get("history_detail"))
  additional_details = _clean_optional_text(structured_input.get("additional_details"))
  vitals = structured_input.get("vitals") or {}

  return {
    "age": age,
    "sex": sex,
    "main_symptom": main_symptom,
    "duration_value": duration_value,
    "duration_unit": duration_unit,
    "duration_bucket": duration_bucket,
    "severity": severity,
    "location": location,
    "location_label": LOCATION_LABELS.get(location, location_detail or "unspecified location"),
    "location_detail": location_detail,
    "radiation": radiation,
    "radiation_labels": [RADIATION_LABELS.get(item, item) for item in radiation],
    "radiation_detail": radiation_detail,
    "associated_symptoms": associated_symptoms,
    "associated_labels": [ASSOCIATED_SYMPTOM_LABELS.get(item, item) for item in associated_symptoms],
    "aggravating_factors": aggravating_factors,
    "aggravating_labels": [FACTOR_LABELS.get(item, item) for item in aggravating_factors],
    "relieving_factors": relieving_factors,
    "relieving_labels": [FACTOR_LABELS.get(item, item) for item in relieving_factors],
    "red_flags": red_flags,
    "red_flag_labels": [RED_FLAG_LABELS.get(item, item) for item in red_flags],
    "relevant_history": relevant_history,
    "history_labels": [HISTORY_LABELS.get(item, item) for item in relevant_history],
    "history_detail": history_detail,
    "additional_details": additional_details,
    "vitals": {
      "systolic_bp": vitals.get("systolic_bp"),
      "diastolic_bp": vitals.get("diastolic_bp"),
      "heart_rate": vitals.get("heart_rate"),
      "temperature_c": vitals.get("temperature_c"),
      "spo2": vitals.get("spo2"),
    },
    "patient_context": patient_context,
  }


def format_structured_triage_input(normalized_input: dict[str, Any]) -> str:
  segments: list[str] = []

  demographics: list[str] = []
  if normalized_input.get("age") is not None:
    demographics.append(f"{normalized_input['age']}yo")
  if normalized_input.get("sex"):
    demographics.append(str(normalized_input["sex"]))
  if demographics:
    segments.append(" ".join(demographics))

  segments.append(f"Main symptom: {normalized_input['main_symptom']}")

  if normalized_input.get("duration_value") and normalized_input.get("duration_unit"):
    segments.append(
      f"Duration: {normalized_input['duration_value']} {normalized_input['duration_unit']}"
    )

  if normalized_input.get("severity") is not None:
    segments.append(f"Severity: {normalized_input['severity']}/10")

  if normalized_input.get("location_label"):
    location = str(normalized_input["location_label"])
    if normalized_input.get("location_detail"):
      location = f"{location} ({normalized_input['location_detail']})"
    segments.append(f"Location: {location}")

  if normalized_input.get("radiation_labels"):
    segments.append(f"Radiation: {', '.join(normalized_input['radiation_labels'])}")

  if normalized_input.get("associated_labels"):
    segments.append(f"Associated symptoms: {', '.join(normalized_input['associated_labels'])}")

  if normalized_input.get("aggravating_labels"):
    segments.append(f"Worse with: {', '.join(normalized_input['aggravating_labels'])}")

  if normalized_input.get("relieving_labels"):
    segments.append(f"Better with: {', '.join(normalized_input['relieving_labels'])}")

  if normalized_input.get("red_flag_labels"):
    segments.append(f"Explicit red flags: {', '.join(normalized_input['red_flag_labels'])}")
  else:
    segments.append("Explicit red flags: none reported")

  if normalized_input.get("history_labels"):
    segments.append(f"Relevant history: {', '.join(normalized_input['history_labels'])}")
  if normalized_input.get("history_detail"):
    segments.append(f"History detail: {normalized_input['history_detail']}")
  if normalized_input.get("additional_details"):
    segments.append(f"Additional details: {normalized_input['additional_details']}")

  vitals = normalized_input.get("vitals") or {}
  vitals_summary = []
  if vitals.get("systolic_bp") and vitals.get("diastolic_bp"):
    vitals_summary.append(f"BP {vitals['systolic_bp']}/{vitals['diastolic_bp']}")
  if vitals.get("heart_rate"):
    vitals_summary.append(f"HR {vitals['heart_rate']}")
  if vitals.get("temperature_c"):
    vitals_summary.append(f"Temp {vitals['temperature_c']}C")
  if vitals.get("spo2"):
    vitals_summary.append(f"SpO2 {vitals['spo2']}%")
  if vitals_summary:
    segments.append(f"Vitals: {', '.join(vitals_summary)}")

  return ". ".join(segments)


def build_triage_model_input(
  normalized_input: dict[str, Any],
  grounded_assessment: dict[str, Any],
  patient_context_text: str | None = None,
) -> str:
  payload = {
    "patient_context": patient_context_text,
    "structured_input": {
      key: value
      for key, value in normalized_input.items()
      if key not in {"patient_context"}
    },
    "grounded_assessment": {
      "risk_level": grounded_assessment.get("risk_level"),
      "care_level": grounded_assessment.get("care_level"),
      "red_flags": grounded_assessment.get("red_flags", []),
      "recommended_action": grounded_assessment.get("recommended_action"),
      "reasoning": grounded_assessment.get("reasoning", []),
    },
  }
  return json.dumps(payload, ensure_ascii=True, sort_keys=True)


def _legacy_care_level(risk_level: str) -> str:
  if risk_level == "Critical":
    return "Emergency"
  if risk_level == "High":
    return "Urgent"
  if risk_level == "Moderate":
    return "Routine"
  return "Self-care"


def _legacy_reasoning(
  symptom_summary: list[str],
  red_flags: list[str],
  duration: str | None,
  severity: str | None,
) -> list[str]:
  reasons: list[str] = []
  if symptom_summary:
    reasons.append(f"Detected symptoms: {', '.join(symptom_summary[:3])}.")
  if duration:
    reasons.append(f"Duration entered: {duration}.")
  if severity:
    reasons.append(f"Reported severity: {severity}.")
  reasons.append(
    "Explicit red-flag style features were detected in the text."
    if red_flags
    else "No explicit red-flag style features were detected in the text."
  )
  return reasons[:4]


def _build_legacy_triage_assessment(symptoms: str) -> dict[str, Any]:
  normalized = normalize_triage_input(symptoms)
  lowered = normalized.lower()

  red_flags: list[str] = []
  differential: list[str] = []
  symptom_summary: list[str] = []
  supplemental_features = _extract_feature_labels(lowered)
  patient_context = _extract_patient_context(normalized)
  duration = _extract_duration_phrase(lowered)
  severity = _extract_severity_phrase(lowered)
  vitals = _extract_vitals_summary(normalized)

  has_chest_pain = _extract_phrase(lowered, ("chest pain", "chest pressure", "chest tightness"))
  has_shortness_breath = _extract_phrase(lowered, ("shortness of breath", "difficulty breathing", "dyspnea"))
  has_radiation = _extract_phrase(lowered, ("left arm", "jaw pain", "radiating", "radiates"))
  has_diaphoresis = _extract_phrase(lowered, ("diaphoresis", "sweating", "clammy"))
  has_syncope = _extract_phrase(lowered, ("syncope", "fainted", "fainting", "passed out"))
  has_neuro = _extract_phrase(lowered, ("facial droop", "slurred speech", "focal weakness", "one-sided weakness", "numbness", "vision loss"))
  has_infection = _extract_phrase(lowered, ("fever", "chills", "rigors"))
  has_sepsis_features = _extract_phrase(lowered, ("hypotension", "confusion", "tachycardia"))
  has_abdominal = _extract_phrase(lowered, ("abdominal pain", "severe abdominal pain", "vomiting", "black stool", "blood in stool"))
  has_headache = _extract_phrase(lowered, ("headache", "worst headache"))
  has_cough = _extract_phrase(lowered, ("cough", "sputum", "wheeze"))
  has_palpitations = _extract_phrase(lowered, ("palpitations", "racing heart"))
  has_dizziness = _extract_phrase(lowered, ("dizziness", "lightheaded"))

  if has_chest_pain:
    symptom_summary.append("chest pain or pressure")
    differential.extend(["Acute coronary syndrome", "Pulmonary embolism", "Aortic syndrome"])
  if has_shortness_breath:
    symptom_summary.append("shortness of breath")
    if "Pulmonary embolism" not in differential:
      differential.extend(["Pulmonary embolism", "Pneumonia", "Heart failure"])
  if has_radiation:
    red_flags.append("Pain radiation was described")
  if has_diaphoresis:
    red_flags.append("Sweating or diaphoresis was described")
  if has_syncope:
    red_flags.append("Syncope or near-syncope was described")
  if has_neuro:
    symptom_summary.append("focal neurologic symptoms")
    red_flags.append("Possible focal neurologic deficit was described")
    differential.extend(["Stroke", "Transient ischemic attack"])
  if has_infection:
    symptom_summary.append("fever or infectious symptoms")
    if "Pneumonia" not in differential:
      differential.extend(["Pneumonia", "Viral syndrome", "Urinary infection"])
  if has_sepsis_features:
    red_flags.append("Systemic instability features were described")
  if has_abdominal:
    symptom_summary.append("abdominal or gastrointestinal symptoms")
    differential.extend(["Abdominal pathology", "Gastroenteritis", "GI bleed"])
  if has_headache:
    symptom_summary.append("headache")
    differential.extend(["Primary headache disorder", "Secondary neurologic cause"])
  if has_cough and "Pneumonia" not in differential:
    symptom_summary.append("cough")
    differential.extend(["Upper respiratory infection", "Pneumonia", "Reactive airway disease"])
  if has_palpitations:
    symptom_summary.append("palpitations")
    differential.extend(["Arrhythmia", "Anxiety-related palpitations", "Electrolyte abnormality"])
  if has_dizziness:
    symptom_summary.append("dizziness or lightheadedness")
    differential.extend(["Volume depletion", "Vestibular cause", "Arrhythmia"])

  symptom_summary = _dedupe([*symptom_summary, *supplemental_features])
  red_flags = _dedupe(red_flags)
  differential = _dedupe(differential)[:4]

  if has_neuro or (has_chest_pain and (has_radiation or has_diaphoresis or has_shortness_breath or has_syncope)):
    risk_level = "Critical"
    recommended_action = "Seek emergency care now."
  elif has_shortness_breath or has_syncope or has_sepsis_features or (has_abdominal and _extract_phrase(lowered, ("severe", "worsening"))):
    risk_level = "High"
    recommended_action = "Seek urgent same-day clinical evaluation."
  elif symptom_summary:
    risk_level = "Moderate"
    recommended_action = "Arrange prompt clinician review and seek urgent care if symptoms worsen."
  else:
    risk_level = "Low"
    recommended_action = "Self-care may be reasonable if symptoms stay stable, with routine clinical review if symptoms persist."

  if symptom_summary:
    summary_parts = [f"Reported symptoms include {', '.join(symptom_summary)}"]
    if duration:
      summary_parts[-1] += f" for {duration}"
    if severity:
      summary_parts[-1] += f" with {severity} severity"
    summary_parts[-1] += "."
    if patient_context:
      summary_parts.append(f"Patient context: {patient_context}.")
    if vitals:
      summary_parts.append(f"Available vitals: {vitals}.")
    summary_parts.append(
      "Red flags were identified in the text."
      if red_flags
      else "No explicit red flags were identified in the text."
    )
    summary = " ".join(summary_parts)
  else:
    summary = "Symptoms were reported, but the description remains limited. Provide more detail for a more specific triage assessment."

  if not differential:
    differential = ["Further clinical evaluation needed"]

  return {
    "risk_level": risk_level,
    "care_level": _legacy_care_level(risk_level),
    "red_flags": red_flags,
    "recommended_action": recommended_action,
    "summary": summary,
    "differential": differential,
    "reasoning": _legacy_reasoning(symptom_summary, red_flags, duration, severity),
  }


def _build_vital_red_flags(vitals: dict[str, Any]) -> tuple[list[str], bool, bool]:
  flags: list[str] = []
  emergency = False
  urgent = False

  systolic = vitals.get("systolic_bp")
  heart_rate = vitals.get("heart_rate")
  temperature_c = vitals.get("temperature_c")
  spo2 = vitals.get("spo2")

  if isinstance(systolic, int) and systolic < 90:
    flags.append("Low blood pressure was entered")
    emergency = True
  if isinstance(spo2, int) and spo2 < 92:
    flags.append("Low oxygen saturation was entered")
    emergency = True
  if isinstance(heart_rate, int) and heart_rate >= 130:
    flags.append("Markedly fast heart rate was entered")
    urgent = True
  if isinstance(temperature_c, (int, float)) and temperature_c >= 39:
    flags.append("High fever was entered")
    urgent = True

  return flags, emergency, urgent


def _age_related_reasoning(age: int | None) -> str | None:
  if age is None:
    return None
  if age < 30:
    return "Younger age lowers the likelihood of cardiac or vascular emergencies without other high-risk findings."
  if age >= 60:
    return "Older age increases the value of in-person review if symptoms change or worsen."
  return None


def build_structured_triage_assessment(normalized_input: dict[str, Any]) -> dict[str, Any]:
  main_symptom_lower = normalized_input["main_symptom"].lower()
  location = normalized_input.get("location")
  severity = normalized_input.get("severity")
  age = normalized_input.get("age")
  duration_bucket = normalized_input.get("duration_bucket")
  radiation = set(normalized_input.get("radiation", []))
  associated = set(normalized_input.get("associated_symptoms", []))
  red_flag_codes = set(normalized_input.get("red_flags", []))
  history = set(normalized_input.get("relevant_history", []))
  aggravating = set(normalized_input.get("aggravating_factors", []))
  relieving = set(normalized_input.get("relieving_factors", []))
  vitals = normalized_input.get("vitals", {})

  is_back_pattern = location in {"back", "neck"} or "back" in main_symptom_lower or "neck" in main_symptom_lower
  is_chest_pattern = location == "chest" or "chest" in main_symptom_lower
  has_chest_pressure = "chest_pressure" in associated or "pressure" in main_symptom_lower and is_chest_pattern
  has_shortness_of_breath = "shortness_of_breath" in associated
  has_fever = "fever" in associated or "chills" in associated
  has_cough = "cough" in associated
  has_sore_throat = "sore_throat" in associated
  has_runny_nose = "runny_nose" in associated
  has_diarrhea = "diarrhea" in associated
  has_neuro_symptoms = "new_weakness_or_numbness" in red_flag_codes or "weakness" in associated or "numbness_tingling" in associated
  has_urinary_symptoms = "urinary_symptoms" in associated
  has_weight_loss = "weight_loss" in associated or "cancer_history" in history
  has_headache = "headache" in associated or "headache" in main_symptom_lower
  has_dizziness = "dizziness" in associated
  has_palpitations = "palpitations" in associated
  has_rash = "rash" in associated
  has_swelling = "swelling" in associated
  has_vision_change = "vision_change" in associated
  has_confusion = "confusion" in associated or "new_confusion" in red_flag_codes
  improves_with_movement = bool({"movement", "stretching", "position_change"} & relieving)
  worse_with_sitting = "sitting" in aggravating
  has_major_trauma = "recent_major_trauma" in red_flag_codes
  has_unable_to_walk = "unable_to_walk" in red_flag_codes
  has_bowel_bladder_change = "bowel_bladder_change" in red_flag_codes
  has_saddle_anesthesia = "saddle_anesthesia" in red_flag_codes
  has_speech_change = "speech_or_facial_change" in red_flag_codes
  has_heavy_bleeding = "heavy_bleeding" in red_flag_codes
  has_fainting = "fainting" in red_flag_codes
  has_severe_breathing = "severe_breathing_trouble" in red_flag_codes
  has_seizure_or_worst_headache = "seizure_or_worst_headache" in red_flag_codes
  has_persistent_vomiting = "persistent_vomiting" in red_flag_codes
  has_high_fever_red_flag = "high_fever" in red_flag_codes
  has_allergic_swelling = "severe_allergic_swelling" in red_flag_codes
  has_arm_or_jaw_radiation = bool({"arm", "jaw"} & radiation)
  has_leg_radiation = "leg" in radiation
  has_respiratory_history = "asthma_lung_disease" in history
  has_recent_immobility = "recent_surgery_or_immobility" in history
  has_immunocompromised = "immunocompromised" in history

  explicit_red_flags = [RED_FLAG_LABELS[code] for code in normalized_input.get("red_flags", [])]
  vital_red_flags, has_emergency_vitals, has_urgent_vitals = _build_vital_red_flags(vitals)
  red_flags = _dedupe([*explicit_red_flags, *vital_red_flags])

  care_level = "Routine"
  risk_level = "Moderate"
  differential: list[str] = []
  reasoning: list[str] = []

  if red_flags:
    reasoning.append("Explicit high-risk findings were provided.")
  else:
    reasoning.append("No explicit red flags were selected.")

  if duration_bucket == "chronic":
    reasoning.append("The symptom duration is chronic rather than sudden.")
  elif duration_bucket == "acute":
    reasoning.append("The symptom duration is relatively acute.")

  age_reason = _age_related_reasoning(age)
  if age_reason:
    reasoning.append(age_reason)

  if is_back_pattern:
    reasoning.append("The symptom pattern is centered in the back or neck.")
  elif is_chest_pattern:
    reasoning.append("The symptom pattern is centered in the chest.")

  if improves_with_movement:
    reasoning.append("Improvement with movement or stretching fits a mechanical pain pattern.")
  elif worse_with_sitting:
    reasoning.append("Worse pain with sitting can fit a musculoskeletal or postural back-pain pattern.")
  elif duration_bucket == "acute" and not red_flags:
    reasoning.append("The structured inputs describe an acute symptom without explicit emergency flags.")

  if (
    has_emergency_vitals
    or has_bowel_bladder_change
    or has_saddle_anesthesia
    or has_speech_change
    or has_heavy_bleeding
    or has_severe_breathing
    or has_confusion
    or has_seizure_or_worst_headache
    or has_allergic_swelling
  ):
    care_level = "Emergency"
    risk_level = "Critical"
  elif (
    is_chest_pattern
    and (has_chest_pressure or "pain" in main_symptom_lower or "tightness" in main_symptom_lower)
    and (has_shortness_of_breath or has_fainting or has_arm_or_jaw_radiation)
    and duration_bucket == "acute"
    and (age is None or age >= 30 or has_urgent_vitals or has_recent_immobility)
  ):
    care_level = "Emergency"
    risk_level = "Critical"
  elif (
    has_major_trauma
    or has_unable_to_walk
    or has_urgent_vitals
    or has_persistent_vomiting
    or has_high_fever_red_flag
    or (has_fever and (has_weight_loss or "diabetes" in history or has_immunocompromised))
    or (has_shortness_of_breath and has_respiratory_history)
    or (has_palpitations and duration_bucket == "acute" and (has_dizziness or has_fainting))
  ):
    care_level = "Urgent"
    risk_level = "High"
  elif is_back_pattern and duration_bucket == "chronic" and not red_flags and not has_shortness_of_breath and not has_chest_pressure:
    if severity is not None and severity <= 4 and improves_with_movement:
      care_level = "Self-care"
      risk_level = "Low"
    else:
      care_level = "Routine"
      risk_level = "Low" if severity is None or severity <= 6 else "Moderate"
  elif severity is not None and severity >= 8 and not red_flags:
    care_level = "Urgent"
    risk_level = "High"
  elif not red_flags and duration_bucket != "acute":
    care_level = "Routine"
    risk_level = "Low"

  if is_back_pattern and duration_bucket == "chronic" and not red_flags and not has_shortness_of_breath and not has_chest_pressure:
    care_level = "Self-care" if severity is not None and severity <= 4 and improves_with_movement else "Routine"
    risk_level = "Low" if care_level == "Self-care" or severity is None or severity <= 6 else "Moderate"

  if care_level == "Emergency":
    if is_back_pattern and not red_flags and not has_emergency_vitals and not has_shortness_of_breath and not has_chest_pressure:
      care_level = "Routine"
      risk_level = "Low"

  if is_back_pattern:
    if has_leg_radiation or has_neuro_symptoms:
      differential.append("Lumbar or cervical radicular pain")
    if duration_bucket == "chronic":
      differential.extend(["Mechanical back pain", "Myofascial pain", "Degenerative spine pain"])
    else:
      differential.extend(["Mechanical back pain", "Muscle strain"])
    if has_urinary_symptoms and location == "pelvis_flank":
      differential.append("Kidney stone or urinary cause")
    if has_fever and care_level in {"Urgent", "Emergency"}:
      differential.append("Infectious or inflammatory cause")
  elif is_chest_pattern:
    if care_level == "Emergency":
      differential.extend(["Acute coronary syndrome", "Pulmonary embolism", "Aortic syndrome"])
    else:
      differential.extend(["Musculoskeletal chest wall pain", "Gastroesophageal reflux", "Anxiety-related symptoms"])
  elif has_sore_throat or has_runny_nose or has_cough:
    differential.extend(["Upper respiratory infection", "Viral syndrome", "Throat or sinus-related illness"])
    if has_fever or has_shortness_of_breath:
      differential.append("Lower respiratory infection or airway flare")
  elif location == "abdomen" or has_diarrhea or ("nausea_vomiting" in associated):
    differential.extend(["Viral gastroenteritis", "Functional or inflammatory GI cause", "Abdominal evaluation needed"])
  elif location in {"pelvis_flank", "urinary_genital"} or has_urinary_symptoms:
    differential.extend(["Urinary tract infection", "Kidney stone or renal cause", "Pelvic or reproductive cause"])
  elif location in {"head", "face_mouth"} or has_headache or has_dizziness or has_vision_change:
    differential.extend(["Primary headache disorder", "Vestibular cause", "Sinus, eye, or neurologic cause"])
  elif location == "skin" or has_rash or has_swelling:
    differential.extend(["Dermatologic or allergic condition", "Local skin or soft-tissue process", "Further clinical evaluation needed"])
  elif has_palpitations:
    differential.extend(["Benign palpitations or anxiety-related symptoms", "Arrhythmia", "Dehydration or stimulant effect"])
  elif location in {"arm_leg", "joint"}:
    differential.extend(["Muscle or joint strain", "Inflammatory or overuse condition", "Nerve irritation"])
  else:
    differential.extend(["Common benign cause", "Localized inflammatory or musculoskeletal cause", "Further clinical evaluation needed"])

  differential = _dedupe(differential)[:4]

  if is_back_pattern and duration_bucket == "chronic" and care_level in {"Self-care", "Routine"}:
    summary = (
      "The entered facts fit chronic back or neck pain more than a cardiac or vascular emergency. "
      "The symptoms are chronic, centered in the back or neck, and no explicit emergency red flags were reported."
    )
  elif care_level == "Emergency":
    summary = (
      "The entered facts include high-risk findings that justify emergency evaluation. "
      "This recommendation is being driven by the structured inputs rather than by AI alone."
    )
  elif care_level == "Urgent":
    summary = (
      "The entered facts do not clearly support an immediate emergency, but they do justify urgent same-day clinical evaluation."
    )
  else:
    summary = (
      "The entered facts do not show clear emergency features. "
      "A routine clinical review is more appropriate unless new red flags appear."
    )

  if care_level == "Self-care":
    recommended_action = (
      "Self-care is reasonable if symptoms stay stable. Arrange routine follow-up if the pain persists, "
      "and seek care sooner if new weakness, bowel or bladder changes, fever, or worsening symptoms develop."
    )
  elif care_level == "Routine":
    recommended_action = (
      "Schedule a routine outpatient review. Seek urgent care sooner if new neurologic symptoms, fever, shortness of breath, or worsening pain appear."
    )
  elif care_level == "Urgent":
    recommended_action = "Seek urgent same-day clinical evaluation."
  else:
    recommended_action = "Seek emergency care now."

  return {
    "risk_level": risk_level,
    "care_level": care_level,
    "red_flags": red_flags,
    "recommended_action": recommended_action,
    "summary": summary,
    "differential": differential,
    "reasoning": reasoning[:4],
  }


def build_grounded_triage_assessment(
  symptoms: str,
  structured_input: dict[str, Any] | None = None,
  patient_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
  if structured_input is not None:
    normalized = normalize_structured_triage_input(structured_input, patient_context)
    return build_structured_triage_assessment(normalized)
  return _build_legacy_triage_assessment(symptoms)


def _summary_is_consistent(
  summary: str,
  grounded: dict[str, Any],
  normalized_input: dict[str, Any] | None,
) -> bool:
  lowered = summary.lower()

  if grounded.get("care_level") in {"Self-care", "Routine"} and normalized_input is not None:
    main_symptom = normalized_input.get("main_symptom", "").lower()
    location = normalized_input.get("location")
    associated = set(normalized_input.get("associated_symptoms", []))
    if location not in {"chest"} and "chest" not in main_symptom and "chest_pressure" not in associated:
      if any(term in lowered for term in ("chest pain", "acute coronary", "cardiac", "pulmonary embol", "aortic", "syncope")):
        return False

  return True


def _filter_differential(
  candidates: list[str],
  grounded: dict[str, Any],
  normalized_input: dict[str, Any] | None,
) -> list[str]:
  if normalized_input is None:
    return _dedupe([item.strip() for item in candidates if isinstance(item, str) and item.strip()])[:4]

  is_back_pattern = normalized_input.get("location") in {"back", "neck"} or "back" in normalized_input.get("main_symptom", "").lower()
  if grounded.get("care_level") in {"Self-care", "Routine"} and is_back_pattern:
    filtered = []
    for item in candidates:
      if not isinstance(item, str):
        continue
      cleaned = item.strip()
      lowered = cleaned.lower()
      if any(term in lowered for term in CARDIOPULMONARY_DIFFERENTIAL_TERMS):
        continue
      filtered.append(cleaned)
    return _dedupe(filtered)[:4]

  return _dedupe([item.strip() for item in candidates if isinstance(item, str) and item.strip()])[:4]


def merge_triage_with_model(
  grounded: dict[str, Any],
  model_result: dict[str, Any],
  normalized_input: dict[str, Any] | None = None,
) -> dict[str, Any]:
  summary = grounded["summary"]
  model_summary = model_result.get("summary")
  if isinstance(model_summary, str) and model_summary.strip():
    if _summary_is_consistent(model_summary.strip(), grounded, normalized_input):
      summary = model_summary.strip()

  differential = _filter_differential(
    model_result.get("differential", []),
    grounded,
    normalized_input,
  )
  if not differential:
    differential = grounded["differential"]

  return {
    **grounded,
    "summary": summary,
    "differential": differential[:4],
  }
