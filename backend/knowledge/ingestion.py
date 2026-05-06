from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database_pg import engine
from knowledge.schema import KnowledgeSourceType
from knowledge.embedder import embed_text


async def chunk_text(text_content: str, chunk_size: int = 512, overlap: int = 64) -> list:
    separators = [". ", "\n"]
    sentences = []
    remaining = text_content
    while remaining:
        best_pos = -1
        for sep in separators:
            pos = remaining.find(sep)
            if pos != -1 and (best_pos == -1 or pos < best_pos):
                best_pos = pos
                best_sep = sep
        if best_pos == -1:
            sentences.append(remaining)
            break
        sentences.append(remaining[: best_pos + len(best_sep)])
        remaining = remaining[best_pos + len(best_sep) :]

    chunks = []
    current = ""
    for sentence in sentences:
        if len(current) + len(sentence) <= chunk_size:
            current += sentence
        else:
            if current:
                chunks.append(current)
            if len(sentence) > chunk_size:
                for i in range(0, len(sentence), chunk_size - overlap):
                    chunks.append(sentence[i : i + chunk_size])
                current = sentence[max(0, len(sentence) - overlap) :]
            else:
                current = current[-overlap:] + sentence if current else sentence
    if current:
        chunks.append(current)
    return [c for c in chunks if c.strip()]


async def ingest_source(
    tenant_id: str,
    source_id: str,
    source_type: KnowledgeSourceType,
    content_items: list,
) -> int:
    count = 0
    async with AsyncSession(engine) as db:
        for item in content_items:
            raw_text = item.get("text", "")
            metadata = item.get("metadata", {})
            if not raw_text.strip():
                continue
            embedding = await embed_text(raw_text)
            chunk_id = str(uuid.uuid4())
            stmt = text(
                """
                INSERT INTO knowledge_chunks
                    (id, source_id, tenant_id, content, embedding, metadata, created_at)
                VALUES
                    (:id, :source_id, :tenant_id, :content, :embedding::vector, :metadata::jsonb, :created_at)
                ON CONFLICT (source_id, tenant_id, md5(content))
                DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    metadata  = EXCLUDED.metadata
                """
            )
            await db.execute(
                stmt,
                {
                    "id": chunk_id,
                    "source_id": source_id,
                    "tenant_id": tenant_id,
                    "content": raw_text,
                    "embedding": str(embedding),
                    "metadata": __import__("json").dumps(metadata),
                    "created_at": datetime.now(timezone.utc),
                },
            )
            count += 1

        await db.execute(
            text(
                """
                UPDATE knowledge_sources
                SET last_synced_at = NOW(), status = 'active'
                WHERE id = :source_id AND tenant_id = :tenant_id
                """
            ),
            {"source_id": source_id, "tenant_id": tenant_id},
        )
        await db.commit()
    return count
