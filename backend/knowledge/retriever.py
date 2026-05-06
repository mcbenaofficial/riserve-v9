from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from database_pg import engine
from knowledge.embedder import embed_text


@dataclass
class KBChunk:
    chunk_id: str
    content: str
    source_type: str
    metadata: dict
    similarity: float


async def search_kb(
    tenant_id: str,
    query: str,
    source_types: Optional[list] = None,
    top_k: int = 5,
) -> list:
    try:
        q_vec = await embed_text(query)
        async with AsyncSession(engine) as db:
            if source_types:
                stmt = text(
                    """
                    SELECT
                        kc.id,
                        kc.content,
                        ks.type AS source_type,
                        kc.metadata,
                        1 - (kc.embedding <=> cast(:q_vec AS vector)) AS similarity
                    FROM knowledge_chunks kc
                    JOIN knowledge_sources ks ON kc.source_id = ks.id
                    WHERE kc.tenant_id = :tid
                      AND ks.type = ANY(:types)
                    ORDER BY kc.embedding <=> cast(:q_vec AS vector)
                    LIMIT :k
                    """
                )
                result = await db.execute(
                    stmt,
                    {
                        "q_vec": str(q_vec),
                        "tid": tenant_id,
                        "types": source_types,
                        "k": top_k,
                    },
                )
            else:
                stmt = text(
                    """
                    SELECT
                        kc.id,
                        kc.content,
                        ks.type AS source_type,
                        kc.metadata,
                        1 - (kc.embedding <=> cast(:q_vec AS vector)) AS similarity
                    FROM knowledge_chunks kc
                    JOIN knowledge_sources ks ON kc.source_id = ks.id
                    WHERE kc.tenant_id = :tid
                    ORDER BY kc.embedding <=> cast(:q_vec AS vector)
                    LIMIT :k
                    """
                )
                result = await db.execute(
                    stmt,
                    {
                        "q_vec": str(q_vec),
                        "tid": tenant_id,
                        "k": top_k,
                    },
                )
            rows = result.fetchall()
            return [
                KBChunk(
                    chunk_id=row[0],
                    content=row[1],
                    source_type=row[2],
                    metadata=row[3] or {},
                    similarity=float(row[4]),
                )
                for row in rows
            ]
    except ProgrammingError:
        return []
