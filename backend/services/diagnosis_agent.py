"""
ReAct Diagnosis Agent
=====================
Uses Reason-Act-Observe loop:
  1. THINK — what do I need to know?
  2. ACT   — call a tool to get information
  3. OBSERVE — process the tool's result
  4. REPEAT until confident → produce FINAL ANSWER

The agent DECIDES which tools to call, in what order,
and how to interpret results — this is what makes it agentic.
"""
import json
import os
from groq import Groq
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from models.patient import Patient
from services.agent_tools import TOOL_REGISTRY, execute_tool

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"
MAX_ITERATIONS = 8


SYSTEM_PROMPT = """You are an expert clinical diagnosis AI agent. You have access to tools that query a hospital database.

## Your Process
You MUST follow the ReAct pattern:
1. THINK about what information you need
2. Call a TOOL to get that information
3. OBSERVE the result and update your reasoning
4. REPEAT until you have enough information for a confident diagnosis

## Available Tools
{tools}

## Response Format
On EACH step, respond with EXACTLY this JSON (no markdown, no explanation outside JSON):

When you need more information:
{{
  "thought": "your reasoning about what you need next and why",
  "action": "tool_name",
  "confidence": 0
}}

When you have enough information for a final diagnosis:
{{
  "thought": "your final reasoning summarizing all evidence",
  "action": "final_answer",
  "confidence": 85,
  "answer": {{
    "diagnosis_text": "clear diagnosis in 1-2 sentences",
    "icd_code": "ICD-10 code",
    "differentials": [
      {{"diagnosis": "name", "icd_code": "code", "confidence": 85, "reasoning": "why this fits"}},
      {{"diagnosis": "name2", "icd_code": "code2", "confidence": 60, "reasoning": "why this is possible"}},
      {{"diagnosis": "name3", "icd_code": "code3", "confidence": 30, "reasoning": "less likely but consider"}}
    ],
    "prescription": "medication with dosage and duration",
    "warnings": ["drug interaction warnings", "contraindication alerts"],
    "recommended_tests": ["confirmatory tests needed"],
    "follow_up": "follow-up plan with timeline",
    "lifestyle_advice": "diet, exercise, habits recommendations",
    "urgency": "routine | urgent | emergency",
    "watchlist": ["things to monitor over coming days/weeks"],
    "confidence_breakdown": {{
      "symptom_match": 90,
      "history_correlation": 75,
      "vitals_support": 80
    }},
    "clinical_notes": "summary of reasoning for the doctor"
  }}
}}

## Rules
- ALWAYS call detect_emergency FIRST
- ALWAYS check patient profile and medical history before diagnosing
- ALWAYS check current medications before prescribing
- If prescribing, check for drug interactions with existing medications
- If vitals are available, factor them into your diagnosis
- Look for similar past cases to learn from previous visits
- Your confidence must be at least 70 to give a final answer
- Provide exactly 3 differential diagnoses ranked by confidence
- Be specific with prescriptions: drug name, dose, frequency, duration"""


def _build_tools_description():
    lines = []
    for name, info in TOOL_REGISTRY.items():
        lines.append(f"- {name}: {info['description']} ({info['params']})")
    return "\n".join(lines)


def _call_llm(messages):
    resp = client.chat.completions.create(
        messages=messages,
        model=MODEL,
        temperature=0.2,
        max_tokens=1200
    )
    return resp.choices[0].message.content.strip()


def _parse_agent_response(raw):
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def run_agent(patient: Patient, symptoms: str, db: Session) -> dict:
    tools_desc = _build_tools_description()
    system = SYSTEM_PROMPT.format(tools=tools_desc)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Patient presenting with symptoms: \"{symptoms}\"\n\nBegin your investigation. Start by checking for emergencies, then gather patient data systematically."}
    ]

    reasoning_trace = []
    tools_called = []

    for iteration in range(MAX_ITERATIONS):
        raw = _call_llm(messages)

        try:
            step = _parse_agent_response(raw)
        except json.JSONDecodeError:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": "Your response was not valid JSON. Please respond with the exact JSON format specified."})
            continue

        thought = step.get("thought", "")
        action = step.get("action", "")

        trace_entry = {
            "step": iteration + 1,
            "thought": thought,
            "action": action
        }

        if action == "final_answer":
            trace_entry["type"] = "final"
            reasoning_trace.append(trace_entry)

            answer = step.get("answer", {})
            answer["reasoning_trace"] = reasoning_trace
            answer["tools_called"] = tools_called
            answer["total_steps"] = iteration + 1
            answer["model_used"] = MODEL
            return answer

        # Execute the tool
        observation = execute_tool(action, patient, symptoms, db)
        tools_called.append(action)

        trace_entry["type"] = "tool_call"
        trace_entry["observation_summary"] = _summarize_observation(action, observation)
        reasoning_trace.append(trace_entry)

        # Feed observation back to agent
        messages.append({"role": "assistant", "content": raw})
        messages.append({
            "role": "user",
            "content": f"OBSERVATION from {action}:\n{json.dumps(observation, indent=2, default=str)}\n\nContinue your investigation. Call another tool or provide your final_answer if confident enough."
        })

    # Max iterations reached — force a final answer
    messages.append({
        "role": "user",
        "content": "You've reached the maximum number of investigation steps. You MUST now provide your final_answer with whatever information you have. Respond with the final_answer JSON format."
    })

    raw = _call_llm(messages)
    try:
        step = _parse_agent_response(raw)
        answer = step.get("answer", {})
    except (json.JSONDecodeError, KeyError):
        answer = {
            "diagnosis_text": "Unable to complete AI analysis. Please diagnose manually.",
            "icd_code": "",
            "differentials": [],
            "prescription": "",
            "warnings": ["AI analysis incomplete — manual review required"],
            "recommended_tests": [],
            "follow_up": "",
            "lifestyle_advice": "",
            "urgency": "routine",
            "watchlist": [],
            "confidence_breakdown": {"symptom_match": 0, "history_correlation": 0, "vitals_support": 0},
            "clinical_notes": "Agent reached max iterations without sufficient confidence."
        }

    answer["reasoning_trace"] = reasoning_trace
    answer["tools_called"] = tools_called
    answer["total_steps"] = MAX_ITERATIONS
    answer["model_used"] = MODEL
    return answer


def _summarize_observation(tool_name, observation):
    if tool_name == "detect_emergency":
        if observation.get("is_emergency"):
            return f"EMERGENCY DETECTED: {', '.join(observation['red_flags'])}"
        return "No emergency red flags"
    elif tool_name == "get_patient_profile":
        return f"Patient: {observation.get('name')}, Age: {observation.get('age')}, {observation.get('gender')}"
    elif tool_name == "get_latest_vitals":
        anomalies = observation.get("anomalies", [])
        if anomalies:
            return f"Vitals anomalies: {', '.join(anomalies)}"
        return "Vitals within normal range"
    elif tool_name == "get_medical_history":
        return f"{len(observation)} past diagnoses found"
    elif tool_name == "get_current_medications":
        meds = observation.get("active_medications", [])
        return f"{len(meds)} active medications"
    elif tool_name == "find_similar_past_cases":
        return f"{len(observation)} similar past cases found"
    return str(observation)[:100]
