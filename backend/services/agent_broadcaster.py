"""
Agent status broadcaster for real-time WebSocket updates.
Each agent posts status here, WebSocket reads and sends to frontend.
"""
import time
import threading
from collections import defaultdict

_sessions = defaultdict(list)
_events = defaultdict(threading.Event)
_timestamps = {}
MAX_SESSION_AGE = 600


def broadcast(session_id: str, agent: str, status: str, sources: list = None):
    _sessions[session_id].append({
        "agent": agent,
        "status": status,
        "sources": sources or []
    })
    _timestamps[session_id] = time.time()
    if session_id in _events:
        _events[session_id].set()
    _cleanup_old_sessions()


def get_updates(session_id: str) -> list:
    return _sessions.get(session_id, [])


def cleanup(session_id: str):
    _sessions.pop(session_id, None)
    _events.pop(session_id, None)
    _timestamps.pop(session_id, None)


def _cleanup_old_sessions():
    now = time.time()
    expired = [sid for sid, ts in _timestamps.items() if now - ts > MAX_SESSION_AGE]
    for sid in expired:
        cleanup(sid)
