from __future__ import annotations

import re
import sqlite3
from pathlib import Path
from typing import Any


class MemoryStore:
    """Small, private, persistent memory for completed Geed agent tasks."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.path), timeout=20)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=20000")
        return connection

    def _init_db(self) -> None:
        with self._connect() as db:
            db.execute("""
                CREATE TABLE IF NOT EXISTS agent_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    thread_id TEXT NOT NULL,
                    task TEXT NOT NULL,
                    result TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_agent_memory_thread "
                "ON agent_memory(thread_id, created_at DESC)"
            )

    @staticmethod
    def _redact(text: str) -> str:
        value = str(text or "")
        value = re.sub(
            r"(?i)(api[_ -]?key|password|passwd|secret|access[_ -]?token|refresh[_ -]?token)"
            r"(\s*[:=]\s*)(['\"]?)[^\s,'\";]+",
            r"\1\2[REDACTED]",
            value,
        )
        value = re.sub(
            r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
            "[EMAIL]",
            value,
            flags=re.IGNORECASE,
        )
        return value[:5000]

    def remember_success(self, thread_id: str, task: str, result: str) -> None:
        clean_task = self._redact(task).strip()
        clean_result = self._redact(result).strip()
        if not clean_task or not clean_result:
            return
        with self._connect() as db:
            db.execute(
                "INSERT INTO agent_memory(thread_id, task, result) VALUES(?, ?, ?)",
                (thread_id[:120], clean_task[:1800], clean_result[:3000]),
            )

    def recall(self, thread_id: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
        words = [w for w in re.findall(r"[\wÀ-ỹ-]+", query.lower()) if len(w) >= 3]
        clauses: list[str] = []
        params: list[str] = [thread_id[:120]]
        for word in list(dict.fromkeys(words))[:8]:
            clauses.append("(lower(task) LIKE ? OR lower(result) LIKE ?)")
            params.extend([f"%{word}%", f"%{word}%"])
        sql = "SELECT task, result, created_at FROM agent_memory WHERE thread_id = ?"
        if clauses:
            sql += " AND (" + " OR ".join(clauses) + ")"
        sql += " ORDER BY id DESC LIMIT ?"
        params.append(max(1, min(10, limit)))
        with self._connect() as db:
            rows = db.execute(sql, params).fetchall()
        return [dict(row) for row in rows]

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT id, thread_id, task, result, created_at "
                "FROM agent_memory ORDER BY id DESC LIMIT ?",
                (max(1, min(100, limit)),),
            ).fetchall()
        return [dict(row) for row in rows]

    def count(self) -> int:
        with self._connect() as db:
            row = db.execute("SELECT COUNT(*) AS n FROM agent_memory").fetchone()
        return int(row["n"] if row else 0)

    def clear(self) -> int:
        with self._connect() as db:
            cursor = db.execute("DELETE FROM agent_memory")
            return int(cursor.rowcount or 0)
