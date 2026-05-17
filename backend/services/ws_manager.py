"""
Shared WebSocket connection manager for floor-plan realtime push.

Usage:
    from services.ws_manager import floor_ws_manager
    await floor_ws_manager.connect(ws, company_id)
    await floor_ws_manager.broadcast(company_id, payload)
    floor_ws_manager.disconnect(ws, company_id)
"""
from __future__ import annotations

from fastapi import WebSocket


class FloorWSManager:
    def __init__(self) -> None:
        self._pool: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, company_id: str) -> None:
        await ws.accept()
        self._pool.setdefault(company_id, []).append(ws)

    def disconnect(self, ws: WebSocket, company_id: str) -> None:
        bucket = self._pool.get(company_id, [])
        if ws in bucket:
            bucket.remove(ws)

    async def broadcast(self, company_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._pool.get(company_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, company_id)


# Module-level singleton — never instantiated per-request
floor_ws_manager = FloorWSManager()
