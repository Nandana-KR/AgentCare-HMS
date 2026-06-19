import json
import os
import httpx
import chromadb

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CHROMA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")

_client = None
_icd_collection = None
_drug_collection = None
_survival_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
    return _client


def _ensure_collections():
    global _icd_collection, _drug_collection, _survival_collection
    if _icd_collection is not None and _drug_collection is not None and _survival_collection is not None:
        return

    client = _get_client()

    _icd_collection = client.get_or_create_collection("icd10_knowledge")
    _drug_collection = client.get_or_create_collection("drug_interactions")
    _survival_collection = client.get_or_create_collection("survival_statistics")

    if _icd_collection.count() == 0:
        _seed_icd10()
    if _drug_collection.count() == 0:
        _seed_drug_interactions()
    if _survival_collection.count() == 0:
        _seed_survival_statistics()


def _seed_icd10():
    path = os.path.join(DATA_DIR, "icd10_knowledge.json")
    with open(path, "r") as f:
        data = json.load(f)

    documents = []
    metadatas = []
    ids = []

    for i, entry in enumerate(data):
        doc = (
            f"{entry['code']} - {entry['title']}. "
            f"Category: {entry['category']}. "
            f"Symptoms: {', '.join(entry['common_symptoms'])}. "
            f"Treatment: {entry['standard_treatment']}. "
            f"Red flags: {', '.join(entry['red_flags'])}. "
            f"{entry.get('notes', '')}"
        )
        documents.append(doc)
        metadatas.append({
            "code": entry["code"],
            "title": entry["title"],
            "category": entry["category"],
            "type": "icd10"
        })
        ids.append(f"icd_{i}")

    _icd_collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"RAG: Seeded {len(documents)} ICD-10 entries")


def _seed_drug_interactions():
    path = os.path.join(DATA_DIR, "drug_interactions.json")
    with open(path, "r") as f:
        data = json.load(f)

    documents = []
    metadatas = []
    ids = []

    for i, entry in enumerate(data):
        doc = (
            f"Drug interaction: {entry['drug_a']} + {entry['drug_b']}. "
            f"Severity: {entry['severity']}. "
            f"Effect: {entry['effect']}. "
            f"Recommendation: {entry['recommendation']}."
        )
        documents.append(doc)
        metadatas.append({
            "drug_a": entry["drug_a"],
            "drug_b": entry["drug_b"],
            "severity": entry["severity"],
            "type": "drug_interaction"
        })
        ids.append(f"drug_{i}")

    _drug_collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"RAG: Seeded {len(documents)} drug interaction entries")


def _seed_survival_statistics():
    path = os.path.join(DATA_DIR, "survival_statistics.json")
    with open(path, "r") as f:
        data = json.load(f)

    documents = []
    metadatas = []
    ids = []

    for i, entry in enumerate(data):
        doc = (
            f"{entry['condition']} (ICD: {entry['icd']}). "
            f"1-year survival: {entry['one_year']}, 3-year: {entry['three_year']}, 5-year: {entry['five_year']}. "
            f"Recovery time: {entry['recovery_time']}. Recurrence: {entry['recurrence']}. "
            f"Mortality: {entry['mortality']}."
        )
        documents.append(doc)
        metadatas.append({
            "condition": entry["condition"],
            "icd": entry["icd"],
            "one_year": entry["one_year"],
            "three_year": entry["three_year"],
            "five_year": entry["five_year"],
            "type": "survival"
        })
        ids.append(f"surv_{i}")

    _survival_collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"RAG: Seeded {len(documents)} survival statistics entries")


from services import cache_service as cache

OPENFDA_BASE = "https://api.fda.gov/drug"


def _fetch_openfda_interactions(drug_name: str) -> list:
    cached = cache.get("openfda_interactions", drug_name)
    if cached is not None:
        return cached

    try:
        url = f"{OPENFDA_BASE}/label.json"
        params = {
            "search": f'drug_interactions:"{drug_name}"',
            "limit": 3
        }
        resp = httpx.get(url, params=params, timeout=8)
        if resp.status_code != 200:
            return []

        results = []
        for r in resp.json().get("results", []):
            brand = r.get("openfda", {}).get("brand_name", ["Unknown"])[0]
            interactions = r.get("drug_interactions", [""])[0][:500]
            warnings = r.get("warnings", [""])[0][:300]
            results.append({
                "source": "OpenFDA (live, cached)" if cached else "OpenFDA (live)",
                "drug": brand,
                "interactions": interactions,
                "warnings": warnings
            })
        cache.set("openfda_interactions", drug_name, results)
        return results
    except Exception as e:
        print(f"OpenFDA API failed: {e}")
        return []


def _fetch_openfda_adverse_events(drug_name: str) -> list:
    cached = cache.get("openfda_events", drug_name)
    if cached is not None:
        return cached

    try:
        url = f"{OPENFDA_BASE}/event.json"
        params = {
            "search": f'patient.drug.medicinalproduct:"{drug_name}"',
            "count": "patient.reaction.reactionmeddrapt.exact",
            "limit": 5
        }
        resp = httpx.get(url, params=params, timeout=8)
        if resp.status_code != 200:
            return []

        events = []
        for r in resp.json().get("results", []):
            events.append({
                "reaction": r.get("term", ""),
                "count": r.get("count", 0)
            })
        cache.set("openfda_events", drug_name, events)
        return events
    except Exception as e:
        print(f"OpenFDA events API failed: {e}")
        return []


def _offline_clinical_guidelines(query: str, n: int = 3) -> list:
    _ensure_collections()
    results = _icd_collection.query(query_texts=[query], n_results=n)

    entries = []
    for i in range(len(results["documents"][0])):
        entries.append({
            "document": results["documents"][0][i],
            "code": results["metadatas"][0][i].get("code", ""),
            "title": results["metadatas"][0][i].get("title", ""),
            "source": "WHO ICD-10 (offline)",
            "relevance_rank": i + 1
        })
    return entries


def _offline_drug_interactions(drug_name: str, n: int = 5) -> list:
    _ensure_collections()
    results = _drug_collection.query(query_texts=[drug_name], n_results=n)

    interactions = []
    for i in range(len(results["documents"][0])):
        meta = results["metadatas"][0][i]
        if drug_name.lower() in meta.get("drug_a", "").lower() or drug_name.lower() in meta.get("drug_b", "").lower():
            interactions.append({
                "document": results["documents"][0][i],
                "drug_a": meta.get("drug_a", ""),
                "drug_b": meta.get("drug_b", ""),
                "severity": meta.get("severity", ""),
                "source": "FDA (offline)"
            })

    if not interactions:
        for i in range(min(3, len(results["documents"][0]))):
            interactions.append({
                "document": results["documents"][0][i],
                "drug_a": results["metadatas"][0][i].get("drug_a", ""),
                "drug_b": results["metadatas"][0][i].get("drug_b", ""),
                "severity": results["metadatas"][0][i].get("severity", ""),
                "source": "FDA (offline)"
            })

    return interactions


def search_clinical_guidelines(query: str, n: int = 3) -> list:
    cached = cache.get("clinical_guidelines", query)
    if cached is not None:
        return cached
    offline = _offline_clinical_guidelines(query, n)
    result = {"guidelines": offline, "source": "WHO ICD-10 knowledge base"}
    cache.set("clinical_guidelines", query, result)
    return result


def search_survival_statistics(condition: str, n: int = 3) -> dict:
    cached = cache.get("survival_stats", condition)
    if cached is not None:
        return cached
    _ensure_collections()
    results = _survival_collection.query(query_texts=[condition], n_results=n)
    entries = []
    for i in range(len(results["documents"][0])):
        meta = results["metadatas"][0][i]
        entries.append({
            "condition": meta.get("condition", ""),
            "icd": meta.get("icd", ""),
            "one_year": meta.get("one_year", "N/A"),
            "three_year": meta.get("three_year", "N/A"),
            "five_year": meta.get("five_year", "N/A"),
            "document": results["documents"][0][i],
            "source": "Survival Statistics Database"
        })
    result = {"statistics": entries, "source": "Evidence-based survival statistics (RAG)"}
    cache.set("survival_stats", condition, result)
    return result


def search_drug_interactions(drug_name: str, n: int = 5) -> list:
    live = _fetch_openfda_interactions(drug_name)
    adverse = _fetch_openfda_adverse_events(drug_name)
    offline = _offline_drug_interactions(drug_name, n)

    return {
        "live_fda_data": live if live else "OpenFDA unavailable — using offline data",
        "common_adverse_reactions": adverse if adverse else [],
        "offline_interactions": offline,
        "source": "OpenFDA (live) + FDA knowledge base (offline)"
    }
