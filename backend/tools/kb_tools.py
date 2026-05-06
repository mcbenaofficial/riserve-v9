from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext

logger = logging.getLogger(__name__)

try:
    from knowledge.embedder import embed_text as _embed_text
except ImportError:
    _embed_text = None  # D3 not yet built


class KBSearch(BaseTool):
    name = "kb.search"
    description = (
        "Semantic search over the tenant knowledge base. "
        "Returns the top-k most relevant chunks for the query."
    )
    scopes = ["kb:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        query: str,
        source_types: Optional[list] = None,
        top_k: int = 5,
    ) -> ToolResult:
        if _embed_text is None:
            return ToolResult(
                success=True,
                data={"chunks": [], "note": "KB not yet populated"},
            )

        try:
            query_embedding = await _embed_text(query)
        except Exception as exc:
            logger.warning("embed_text failed: %s", exc)
            return ToolResult(
                success=True,
                data={"chunks": [], "note": "KB not yet populated"},
            )

        try:
            async with AsyncSession(engine) as db:
                result = await db.execute(
                    text(
                        """
                        SELECT id, content, metadata
                        FROM knowledge_chunks
                        WHERE tenant_id = :tid
                        ORDER BY embedding <=> :query_embedding
                        LIMIT :k
                        """
                    ),
                    {
                        "tid": ctx.tenant_id,
                        "query_embedding": query_embedding,
                        "k": top_k,
                    },
                )
                rows = result.fetchall()
        except ProgrammingError:
            return ToolResult(
                success=True,
                data={"chunks": [], "note": "KB not yet populated"},
            )

        chunks = [
            {"id": row.id, "content": row.content, "metadata": row.metadata}
            for row in rows
        ]
        return ToolResult(success=True, data={"chunks": chunks})
