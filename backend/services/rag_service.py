import json
import os
import chromadb

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CHROMA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")

_client = None
_icd_collection = None
_drug_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
    return _client


def _ensure_collections():
    global _icd_collection, _drug_collection
    if _icd_collection is not None and _drug_collection is not None:
        return

    client = _get_client()

    _icd_collection = client.get_or_create_collection("icd10_knowledge")
    _drug_collection = client.get_or_create_collection("drug_interactions")

    if _icd_collection.count() == 0:
        _seed_icd10()
    if _drug_collection.count() == 0:
        _seed_drug_interactions()


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


def search_clinical_guidelines(query: str, n: int = 3) -> list:
    _ensure_collections()
    results = _icd_collection.query(query_texts=[query], n_results=n)

    entries = []
    for i in range(len(results["documents"][0])):
        entries.append({
            "document": results["documents"][0][i],
            "code": results["metadatas"][0][i].get("code", ""),
            "title": results["metadatas"][0][i].get("title", ""),
            "relevance_rank": i + 1
        })
    return entries


def search_drug_interactions(drug_name: str, n: int = 5) -> list:
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
                "severity": meta.get("severity", "")
            })

    if not interactions:
        for i in range(min(3, len(results["documents"][0]))):
            interactions.append({
                "document": results["documents"][0][i],
                "drug_a": results["metadatas"][0][i].get("drug_a", ""),
                "drug_b": results["metadatas"][0][i].get("drug_b", ""),
                "severity": results["metadatas"][0][i].get("severity", "")
            })

    return interactions
