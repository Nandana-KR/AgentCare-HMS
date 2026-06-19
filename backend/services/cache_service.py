"""
In-memory LLM response cache.
Saves tokens by caching RAG searches and drug safety lookups.
Structured to swap to Redis later with minimal changes.
"""
import hashlib
import json
import time

_cache = {}
DEFAULT_TTL = 86400  # 24 hours


def _make_key(prefix: str, data: str) -> str:
    h = hashlib.md5(data.encode()).hexdigest()
    return f"{prefix}:{h}"


def get(prefix: str, data: str):
    key = _make_key(prefix, data)
    entry = _cache.get(key)
    if entry is None:
        return None
    if time.time() > entry["expires"]:
        del _cache[key]
        return None
    return entry["value"]


def set(prefix: str, data: str, value, ttl: int = DEFAULT_TTL):
    key = _make_key(prefix, data)
    _cache[key] = {"value": value, "expires": time.time() + ttl}


def stats():
    now = time.time()
    active = sum(1 for v in _cache.values() if now < v["expires"])
    return {"total_entries": len(_cache), "active": active, "expired": len(_cache) - active}
