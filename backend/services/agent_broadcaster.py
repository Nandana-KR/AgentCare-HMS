"""
Agent status broadcaster for real-time WebSocket updates.
Each agent posts status here, WebSocket reads and sends to frontend.
"""
import asyncio
import threading
from collections import defaultdict

_sessions = defaultdict(list)
_events = defaultdict(threading.Event)


def broadcast(session_id: str, agent: str, status: str, sources: list = None):
    _sessions[session_id].append({
        "agent": agent,
        "status": status,
        "sources": sources or []
    })
    if session_id in _events:
        _events[session_id].set()


def get_updates(session_id: str) -> list:
    updates = _sessions.get(session_id, [])
    return updates


def wait_for_update(session_id: str, timeout: float = 30):
    _events[session_id] = threading.Event()
    _events[session_id].wait(timeout=timeout)


def cleanup(session_id: str):
    _sessions.pop(session_id, None)
    _events.pop(session_id, None)
