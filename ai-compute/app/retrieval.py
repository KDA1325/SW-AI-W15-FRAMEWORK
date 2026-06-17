import json
import os
from typing import Any

from langchain_core.callbacks.manager import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from .env import load_local_env
from .schemas import RagSearchRow

load_local_env()


class PgvectorArchiveRetriever(BaseRetriever):
    """LangChain retriever for the existing TypeORM EmbeddingDocument table."""

    connection_string: str
    query_embedding: list[float]
    top_k: int
    user_id: str

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> list[Document]:
        del query, run_manager

        rows = query_embedding_documents(
            self.connection_string,
            self.user_id,
            self.query_embedding,
            self.top_k,
        )

        documents: list[Document] = []
        for row in rows:
            metadata = {
                **row.metadata,
                "similarity": row.similarity,
                "sourceId": row.sourceId,
                "sourceType": row.sourceType,
            }
            documents.append(Document(page_content=row.content, metadata=metadata))

        return documents


def search_archive_context(
    user_id: str,
    query_embedding: list[float],
    top_k: int,
) -> list[RagSearchRow]:
    retriever = PgvectorArchiveRetriever(
        connection_string=postgres_connection_string(),
        query_embedding=query_embedding,
        top_k=top_k,
        user_id=user_id,
    )
    documents = retriever.invoke("user-scoped archive post preference context")

    return [document_to_row(document) for document in documents]


def query_embedding_documents(
    connection_string: str,
    user_id: str,
    query_embedding: list[float],
    top_k: int,
) -> list[RagSearchRow]:
    import psycopg

    with psycopg.connect(connection_string) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                  ed."sourceType",
                  ed."sourceId",
                  ed.content,
                  ed.metadata,
                  1 - (ed.embedding <=> %s::vector) AS similarity
                FROM "EmbeddingDocument" ed
                INNER JOIN "ArchivePost" post
                  ON ed."sourceType" = 'ARCHIVE_POST'
                  AND ed."sourceId" = post.id
                WHERE post."userId" = %s
                  AND ed.embedding IS NOT NULL
                ORDER BY ed.embedding <=> %s::vector ASC
                LIMIT %s
                """,
                (
                    to_pgvector_literal(query_embedding),
                    user_id,
                    to_pgvector_literal(query_embedding),
                    top_k,
                ),
            )
            rows = cursor.fetchall()

    return [
        RagSearchRow(
            sourceType=str(row[0]),
            sourceId=str(row[1]),
            content=str(row[2]),
            metadata=normalize_metadata(row[3]),
            similarity=float(row[4]),
        )
        for row in rows
    ]


def document_to_row(document: Document) -> RagSearchRow:
    metadata = dict(document.metadata)
    source_type = str(metadata.pop("sourceType"))
    source_id = str(metadata.pop("sourceId"))
    similarity = float(metadata.pop("similarity"))

    return RagSearchRow(
        sourceType=source_type,
        sourceId=source_id,
        content=document.page_content,
        metadata=metadata,
        similarity=similarity,
    )


def normalize_metadata(value: Any) -> dict[str, object]:
    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}

        return parsed if isinstance(parsed, dict) else {}

    return {}


def postgres_connection_string() -> str:
    configured = os.getenv("PGVECTOR_CONNECTION_STRING")

    if configured:
        return configured

    host = os.getenv("DATABASE_HOST", "localhost")
    if host.startswith("postgresql://") or host.startswith("postgres://"):
        return host

    port = os.getenv("DATABASE_PORT", "5432")
    user = os.getenv("DATABASE_USER", "game_archive_user")
    password = os.getenv("DATABASE_PASSWORD", "game_archive_password")
    database = os.getenv("DATABASE_NAME", "game_archive")
    ssl_mode = "require" if os.getenv("DATABASE_SSL", "").lower() == "true" else ""
    ssl_query = f"?sslmode={ssl_mode}" if ssl_mode else ""

    return f"postgresql://{user}:{password}@{host}:{port}/{database}{ssl_query}"


def to_pgvector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in values) + "]"
