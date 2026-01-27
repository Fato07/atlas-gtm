"""Qdrant MCP tools for Knowledge Base operations.

This module implements the MCP tools for the Atlas GTM Knowledge Base:
- query_icp_rules: Semantic search for ICP scoring rules
- get_response_template: Retrieve response templates by reply type
- find_objection_handler: Find objection handlers with confidence threshold
- search_market_research: Search market research documents
- add_insight: Add insights with quality gate validation
- get_brain / list_brains: Brain management tools
"""

from __future__ import annotations

import os
import re
import time
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue, PointStruct

from .embeddings import EmbeddingError, embed_batch, embed_document, embed_query
from .logging import log_tool_error, log_tool_result
from .models import (
    VALID_TRANSITIONS,
    BrainStatus,
    ContentType,
    ICPCategory,
    Importance,
    InsightCategory,
    ReplyType,
    SeedingError,
    SeedingResult,
    SourceMetadata,
    ValidationStatus,
    generate_point_id,
    validate_brain_id,
    validate_status_transition,
)
from .quality_gates import run_quality_gate

if TYPE_CHECKING:
    pass


# Thresholds per spec
OBJECTION_CONFIDENCE_THRESHOLD = 0.70  # FR-012


def _get_qdrant_client() -> QdrantClient:
    """Get Qdrant client instance."""
    host = os.getenv("QDRANT_HOST", "localhost")
    port = os.getenv("QDRANT_PORT", "6333")
    api_key = os.getenv("QDRANT_API_KEY")

    # Use url parameter to explicitly specify HTTP (not HTTPS)
    return QdrantClient(
        url=f"http://{host}:{port}",
        api_key=api_key,
    )


def _handle_qdrant_error(e: Exception) -> None:
    """Convert Qdrant errors to ToolError."""
    error_type = type(e).__name__
    if "Connection" in error_type or "Timeout" in error_type:
        raise ToolError("Knowledge base unavailable, retry later") from e
    raise ToolError(f"Knowledge base error: {e}") from e


def _serialize_value(value):
    """Recursively serialize a value to ensure JSON compatibility.

    Handles Pydantic models, dicts, lists, and primitive types.
    """
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "model_dump"):
        # Pydantic model (including RootModel) - convert to dict/list
        return _serialize_value(value.model_dump())
    if hasattr(value, "root"):
        # Pydantic RootModel that hasn't been dumped
        return _serialize_value(value.root)
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_value(item) for item in value]
    # For any other type, try to convert to string
    try:
        # Check if it's JSON serializable
        import json

        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def _serialize_payload(payload: dict) -> dict:
    """Recursively serialize payload, converting Pydantic models to dicts.

    This is needed because Qdrant payloads can contain Pydantic model instances
    (like RootModel or other nested models) that are not JSON-serializable.
    The REST API needs plain dicts for JSON serialization.

    Args:
        payload: Dictionary that may contain Pydantic model instances.

    Returns:
        A new dictionary with all Pydantic models converted to plain dicts.
    """
    return _serialize_value(payload)


def _normalize_condition(payload: dict) -> dict:
    """Ensure condition has required operator and value fields.

    The UI expects condition to always have 'operator' and 'value' fields.
    This helper provides defaults when data is missing or malformed.

    Args:
        payload: The point payload containing condition data.

    Returns:
        A condition dict with at least 'operator' and 'value' keys.
    """
    condition = payload.get("condition") or payload.get("match_condition") or {}

    # Handle legacy string format for match_condition (e.g., "has_government_contracts = true")
    if isinstance(condition, str):
        return {
            "operator": "eq",
            "value": condition,  # Store the raw condition string as the value
        }

    # If condition is empty or missing required fields, provide defaults
    if not condition or "operator" not in condition or "value" not in condition:
        return {
            "operator": condition.get("operator", "eq") if isinstance(condition, dict) else "eq",
            "value": condition.get("value", "") if isinstance(condition, dict) else "",
        }

    return condition


def _get_triggers(payload: dict) -> list[str]:
    """Extract triggers array from payload for objection handlers.

    The UI expects 'triggers' as an array of strings. Qdrant may store
    either 'triggers' directly or 'objection_text' as a single string.

    Args:
        payload: The point payload containing trigger data.

    Returns:
        A list of trigger strings (at least empty list, never None).
    """
    # First try to get triggers directly
    triggers = payload.get("triggers", [])
    if triggers and isinstance(triggers, list):
        return triggers

    # Fallback: use objection_text as single trigger
    objection_text = payload.get("objection_text", "")
    if objection_text:
        return [objection_text]

    return []


def _derive_attribute(name: str) -> str:
    """Derive an attribute identifier from a display name.

    Converts display names like "Government Contractor Status" to
    snake_case identifiers like "government_contractor_status".

    Args:
        name: The display name to convert.

    Returns:
        A snake_case attribute identifier, or empty string if name is empty.
    """
    if not name:
        return ""
    # Remove non-alphanumeric characters except spaces
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', name)
    # Convert to snake_case
    return '_'.join(cleaned.lower().split())


def _normalize_source(source) -> str | None:
    """Normalize source field to string format.

    Qdrant may store source as:
    - A string: "TechCrunch"
    - An object: {"name": "TechCrunch", "url": "...", "publish_date": "..."}
    - None

    The UI expects source to be a string or null, not an object.
    React throws "Objects are not valid as React child" if we pass an object.

    Args:
        source: The source value from Qdrant payload (any type).

    Returns:
        String representation or None.
    """
    if source is None:
        return None
    if isinstance(source, str):
        return source
    if isinstance(source, dict):
        # Extract name if available, otherwise format as string
        return source.get("name") or str(source)
    return str(source)


# ==========================================================================
# Phase 2: Foundational Helpers for Brain Lifecycle (003-brain-lifecycle)
# ==========================================================================


async def _validate_brain_exists(brain_id: str) -> dict:
    """Validate that a brain exists and return its data.

    Args:
        brain_id: The brain ID to validate.

    Returns:
        Brain payload data if found.

    Raises:
        ToolError: If brain_id is invalid or brain not found.
    """
    if not validate_brain_id(brain_id):
        raise ToolError(f"Invalid brain_id format: {brain_id}")

    qdrant = _get_qdrant_client()

    try:
        results, _ = qdrant.scroll(
            collection_name="brains",
            scroll_filter=Filter(
                must=[FieldCondition(key="id", match=MatchValue(value=brain_id))]
            ),
            limit=1,
            with_payload=True,
        )

        if not results:
            raise ToolError(f"Brain not found: {brain_id}")

        return results[0].payload

    except ToolError:
        raise
    except Exception as e:
        _handle_qdrant_error(e)


async def _calculate_brain_stats_internal(brain_id: str) -> dict:
    """Calculate stats for a brain by counting items in each collection.

    This is an internal helper that calculates dynamic stats without validation
    overhead. Used by get_brain and list_brains to return accurate counts.

    Args:
        brain_id: Brain ID to calculate stats for.

    Returns:
        Dict with icp_rules_count, templates_count, handlers_count,
        research_docs_count, insights_count.
    """
    qdrant = _get_qdrant_client()

    collections = [
        ("icp_rules", "icp_rules_count"),
        ("response_templates", "templates_count"),
        ("objection_handlers", "handlers_count"),
        ("market_research", "research_docs_count"),
        ("insights", "insights_count"),
    ]

    counts = {}
    for collection, count_key in collections:
        try:
            results, _ = qdrant.scroll(
                collection_name=collection,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="brain_id", match=MatchValue(value=brain_id)
                        )
                    ]
                ),
                limit=1000,  # Count up to 1000 items
                with_payload=False,
            )
            counts[count_key] = len(results)
        except Exception:
            # Collection may not exist or other error, default to 0
            counts[count_key] = 0

    return counts


async def _validate_brain_seedable(brain_id: str) -> dict:
    """Validate that a brain exists and can receive seeded content.

    Per FR-004.1, only brains with status "draft" or "active" can be seeded.
    Archived brains cannot receive new content.

    Args:
        brain_id: The brain ID to validate.

    Returns:
        Brain payload data if valid and seedable.

    Raises:
        ToolError: If brain not found or not seedable (archived).
    """
    brain_data = await _validate_brain_exists(brain_id)

    status = brain_data.get("status", "")
    if status == BrainStatus.ARCHIVED.value:
        raise ToolError(
            f"Cannot seed to archived brain: {brain_id}. "
            "Only draft or active brains can receive content."
        )

    return brain_data


async def _seed_items_to_collection(
    brain_id: str,
    items: list[dict],
    collection: str,
    embed_field: str,
    key_field: str,
) -> SeedingResult:
    """Seed multiple items to a Qdrant collection with partial failure handling.

    Implements upsert behavior using deterministic point IDs based on brain_id + key_field.
    Per FR-008, handles partial failures - seeds valid items and reports errors for invalid ones.

    Args:
        brain_id: Target brain ID for scoping.
        items: List of item dicts to seed.
        collection: Target Qdrant collection name.
        embed_field: Field name containing text to embed.
        key_field: Field name used for upsert key (combined with brain_id).

    Returns:
        SeedingResult with seeded_count and any errors.
    """
    if not items:
        return SeedingResult(
            brain_id=brain_id,
            collection=collection,
            seeded_count=0,
            errors=[],
            message="No items to seed",
        )

    # Validate brain is seedable first
    await _validate_brain_seedable(brain_id)

    errors: list[SeedingError] = []
    valid_items: list[tuple[int, dict, str]] = []  # (index, item, text_to_embed)

    # Validate items and extract text to embed
    for idx, item in enumerate(items):
        item_name = item.get("name", item.get("topic", item.get("objection_text", f"item_{idx}")))

        # Check for required embed field
        text_to_embed = item.get(embed_field)
        if not text_to_embed:
            errors.append(
                SeedingError(
                    index=idx,
                    name=str(item_name),
                    error=f"Missing required field: {embed_field}",
                )
            )
            continue

        # Check for key field
        key_value = item.get(key_field)
        if not key_value:
            errors.append(
                SeedingError(
                    index=idx,
                    name=str(item_name),
                    error=f"Missing required field: {key_field}",
                )
            )
            continue

        valid_items.append((idx, item, str(text_to_embed)))

    if not valid_items:
        return SeedingResult(
            brain_id=brain_id,
            collection=collection,
            seeded_count=0,
            errors=errors,
            message=f"No valid items to seed. {len(errors)} errors.",
        )

    # Batch embed all valid items
    texts_to_embed = [text for _, _, text in valid_items]

    try:
        # Process in batches of 100 (Voyage AI limit)
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts_to_embed), 100):
            batch = texts_to_embed[i : i + 100]
            batch_embeddings = embed_batch(batch, input_type="document")
            all_embeddings.extend(batch_embeddings)
    except EmbeddingError as e:
        raise ToolError(f"Embedding failed: {e}") from e

    # Build points for upsert
    points: list[PointStruct] = []
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for embedding_idx, (item_idx, item, _) in enumerate(valid_items):
        key_value = item.get(key_field)
        point_id = generate_point_id(brain_id, str(key_value))

        # Build payload with brain_id scope
        payload = {
            "brain_id": brain_id,
            **item,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        points.append(
            PointStruct(
                id=point_id,
                vector=all_embeddings[embedding_idx],
                payload=payload,
            )
        )

    # Upsert to Qdrant
    try:
        qdrant = _get_qdrant_client()
        qdrant.upsert(collection_name=collection, points=points)
    except Exception as e:
        _handle_qdrant_error(e)

    seeded_count = len(points)
    error_count = len(errors)

    if error_count > 0:
        message = f"Seeded {seeded_count} items with {error_count} errors"
    else:
        message = f"Successfully seeded {seeded_count} items"

    return SeedingResult(
        brain_id=brain_id,
        collection=collection,
        seeded_count=seeded_count,
        errors=errors,
        message=message,
    )


def register_qdrant_tools(mcp: FastMCP) -> None:
    """Register all Qdrant/KB tools with the MCP server."""

    # ==========================================================================
    # US1: Query ICP Rules (P1)
    # ==========================================================================

    @mcp.tool()
    async def query_icp_rules(
        brain_id: str,
        query: str,
        category: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Query ICP scoring rules from the Knowledge Base using semantic search.

        Used by the Lead Scorer agent to score incoming leads based on the
        current vertical's criteria.

        Args:
            brain_id: Brain ID for vertical isolation (pattern: brain_{vertical}_v{version})
            query: Semantic search query to match against ICP rules (1-1000 chars)
            category: Optional filter by ICP category (firmographic, technographic, behavioral, intent)
            limit: Maximum number of rules to return (1-50, default: 10)

        Returns:
            List of matching ICP rules sorted by relevance score, each containing:
            id, score, category, attribute, display_name, condition, score_weight,
            is_knockout, reasoning
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "query": query, "category": category, "limit": limit}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if not query or len(query) < 1:
                raise ToolError("Query cannot be empty")

            if len(query) > 1000:
                raise ToolError("Query exceeds 1000 characters")

            if limit < 1 or limit > 50:
                raise ToolError("Limit must be between 1 and 50")

            if category is not None:
                try:
                    ICPCategory(category)
                except ValueError:
                    valid_categories = ", ".join([c.value for c in ICPCategory])
                    raise ToolError(f"Invalid category: {category}. Valid: {valid_categories}")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if category is not None:
                must_conditions.append(
                    FieldCondition(key="category", match=MatchValue(value=category))
                )

            # Generate embedding and search
            query_vector = embed_query(query)
            qdrant = _get_qdrant_client()

            results = qdrant.query_points(
                collection_name="icp_rules",
                query=query_vector,
                query_filter=Filter(must=must_conditions),
                limit=limit,
            ).points

            # Map to result format (with fallbacks for legacy data formats)
            output = [
                {
                    "id": str(hit.id),
                    "score": round(hit.score, 3),
                    "category": hit.payload.get("category"),
                    # Fallback: use name (snake_cased) if attribute is missing
                    "attribute": hit.payload.get("attribute") or _derive_attribute(hit.payload.get("name", "")),
                    "display_name": hit.payload.get("display_name", hit.payload.get("name")),
                    "condition": _normalize_condition(hit.payload),
                    "score_weight": hit.payload.get("score_weight", hit.payload.get("weight", 0)),
                    "is_knockout": hit.payload.get("is_knockout", False),
                    # Fallback: use criteria if reasoning is missing
                    "reasoning": hit.payload.get("reasoning") or hit.payload.get("criteria", ""),
                }
                for hit in results
            ]

            log_tool_result("query_icp_rules", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("query_icp_rules", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # US2: Get Response Template (P1)
    # ==========================================================================

    @mcp.tool()
    async def get_response_template(
        brain_id: str,
        reply_type: str,
        tier: int | None = None,
        auto_send_only: bool = False,
    ) -> list[dict]:
        """
        Get response templates from the Knowledge Base by reply type.

        Used by the Reply Handler agent to draft appropriate responses
        to lead communications.

        Args:
            brain_id: Brain ID for vertical isolation
            reply_type: Type of reply to get templates for (positive_interest, pricing_question, etc.)
            tier: Optional tier filter (1=auto-send, 2=draft, 3=human only)
            auto_send_only: Shortcut filter for tier=1 templates only (overrides tier param)

        Returns:
            List of matching templates, each containing:
            id, reply_type, tier, template_text, variables, personalization_instructions
        """
        start = time.perf_counter()
        params = {
            "brain_id": brain_id,
            "reply_type": reply_type,
            "tier": tier,
            "auto_send_only": auto_send_only,
        }

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            try:
                ReplyType(reply_type)
            except ValueError:
                valid_types = ", ".join([r.value for r in ReplyType])
                raise ToolError(f"Invalid reply_type: {reply_type}. Valid: {valid_types}")

            if tier is not None and (tier < 1 or tier > 3):
                raise ToolError("Tier must be 1, 2, or 3")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id)),
                FieldCondition(key="reply_type", match=MatchValue(value=reply_type)),
            ]

            # auto_send_only overrides tier parameter
            effective_tier = 1 if auto_send_only else tier

            if effective_tier is not None:
                must_conditions.append(
                    FieldCondition(key="tier", match=MatchValue(value=effective_tier))
                )

            # Query
            qdrant = _get_qdrant_client()
            results, _ = qdrant.scroll(
                collection_name="response_templates",
                scroll_filter=Filter(must=must_conditions),
                limit=10,
                with_payload=True,
            )

            # Map to result format
            output = [
                {
                    "id": str(point.id),
                    "reply_type": point.payload.get("reply_type"),
                    "tier": point.payload.get("tier"),
                    "template_text": point.payload.get("template_text", ""),
                    "variables": point.payload.get("variables", []),
                    "personalization_instructions": point.payload.get(
                        "personalization_instructions"
                    ),
                }
                for point in results
            ]

            log_tool_result("get_response_template", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("get_response_template", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # US3: Find Objection Handler (P1)
    # ==========================================================================

    @mcp.tool()
    async def find_objection_handler(
        brain_id: str,
        objection_text: str,
    ) -> dict | None:
        """
        Find the best matching objection handler using semantic search.

        Returns the best matching handler if confidence >= 0.70, otherwise None.
        Used by the Reply Handler agent to respond to objections.

        Args:
            brain_id: Brain ID for vertical isolation
            objection_text: The objection text to match against (1-2000 chars)

        Returns:
            Best matching handler with confidence score, or None if no match meets threshold.
            Contains: id, confidence, objection_type, handler_strategy, handler_response,
            variables, follow_up_actions
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "objection_text": objection_text}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if not objection_text or len(objection_text) < 1:
                raise ToolError("Objection text cannot be empty")

            if len(objection_text) > 2000:
                raise ToolError("Objection text exceeds 2000 characters")

            # Generate embedding and search with threshold
            query_vector = embed_query(objection_text)
            qdrant = _get_qdrant_client()

            results = qdrant.query_points(
                collection_name="objection_handlers",
                query=query_vector,
                query_filter=Filter(
                    must=[FieldCondition(key="brain_id", match=MatchValue(value=brain_id))]
                ),
                limit=1,
                score_threshold=OBJECTION_CONFIDENCE_THRESHOLD,  # FR-012
            ).points

            # Return None if no match meets threshold
            if not results:
                log_tool_result("find_objection_handler", params, None, start)
                return None

            hit = results[0]
            output = {
                "id": str(hit.id),
                "confidence": round(hit.score, 3),
                "objection_type": hit.payload.get("objection_type"),
                "handler_strategy": hit.payload.get("handler_strategy", ""),
                "handler_response": hit.payload.get(
                    "handler_response", hit.payload.get("handler_template", "")
                ),
                "variables": hit.payload.get("variables", []),
                "follow_up_actions": hit.payload.get("follow_up_actions", []),
            }

            log_tool_result("find_objection_handler", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("find_objection_handler", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # US4: Search Market Research (P2)
    # ==========================================================================

    @mcp.tool()
    async def search_market_research(
        brain_id: str,
        query: str,
        content_type: str | None = None,
        limit: int = 5,
    ) -> list[dict]:
        """
        Search market research documents in the Knowledge Base using semantic search.

        Used by the Meeting Prep agent to gather background information.

        Args:
            brain_id: Brain ID for vertical isolation
            query: Semantic search query (1-1000 chars)
            content_type: Optional filter (market_overview, competitor_analysis, buyer_persona, pain_points, trends, case_study)
            limit: Maximum documents to return (1-20, default: 5)

        Returns:
            List of relevant research documents sorted by relevance, each containing:
            id, score, content_type, title, content, key_facts, source_url
        """
        start = time.perf_counter()
        params = {
            "brain_id": brain_id,
            "query": query,
            "content_type": content_type,
            "limit": limit,
        }

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if not query or len(query) < 1:
                raise ToolError("Query cannot be empty")

            if len(query) > 1000:
                raise ToolError("Query exceeds 1000 characters")

            if limit < 1 or limit > 20:
                raise ToolError("Limit must be between 1 and 20")

            if content_type is not None:
                try:
                    ContentType(content_type)
                except ValueError:
                    valid_types = ", ".join([c.value for c in ContentType])
                    raise ToolError(f"Invalid content_type: {content_type}. Valid: {valid_types}")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if content_type is not None:
                must_conditions.append(
                    FieldCondition(key="content_type", match=MatchValue(value=content_type))
                )

            # Generate embedding and search
            query_vector = embed_query(query)
            qdrant = _get_qdrant_client()

            results = qdrant.query_points(
                collection_name="market_research",
                query=query_vector,
                query_filter=Filter(must=must_conditions),
                limit=limit,
            ).points

            # Map to result format
            output = [
                {
                    "id": str(hit.id),
                    "score": round(hit.score, 3),
                    "content_type": hit.payload.get("content_type"),
                    "title": hit.payload.get("title", ""),
                    "content": hit.payload.get("content", ""),
                    "key_facts": hit.payload.get("key_facts", []),
                    "source_url": hit.payload.get("source_url"),
                }
                for hit in results
            ]

            log_tool_result("search_market_research", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("search_market_research", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # Dashboard List Tools - Simple list operations without semantic search
    # ==========================================================================

    @mcp.tool()
    async def list_icp_rules(
        brain_id: str,
        category: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """
        List all ICP rules for a brain without semantic search.

        Used by the Dashboard UI to display brain content.
        Output schema matches UI ICPRuleSchema contract.

        Args:
            brain_id: Brain ID for vertical isolation
            category: Optional filter by category (firmographic, technographic, behavioral, intent)
            limit: Maximum rules to return (1-1000, default: 100)

        Returns:
            List of ICP rules, each containing:
            id, brain_id, category, attribute, display_name, condition,
            score_weight, is_knockout, reasoning, created_at, updated_at
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "category": category, "limit": limit}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if limit < 1 or limit > 1000:
                raise ToolError("Limit must be between 1 and 1000")

            if category is not None:
                try:
                    ICPCategory(category)
                except ValueError:
                    valid_categories = ", ".join([c.value for c in ICPCategory])
                    raise ToolError(f"Invalid category: {category}. Valid: {valid_categories}")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if category is not None:
                must_conditions.append(
                    FieldCondition(key="category", match=MatchValue(value=category))
                )

            # Scroll through collection (no semantic search)
            qdrant = _get_qdrant_client()
            results, _ = qdrant.scroll(
                collection_name="icp_rules",
                scroll_filter=Filter(must=must_conditions),
                limit=limit,
                with_payload=True,
            )

            # Map to result format - field names match UI contract (ICPRuleSchema)
            now_iso = datetime.now().isoformat()
            output = [
                {
                    "id": str(point.id),
                    "brain_id": brain_id,
                    "category": point.payload.get("category"),
                    # Fallback: use name (snake_cased) if attribute is missing
                    "attribute": point.payload.get("attribute") or _derive_attribute(point.payload.get("name", "")),
                    "display_name": point.payload.get("display_name", point.payload.get("name")),
                    "condition": _normalize_condition(point.payload),
                    "score_weight": point.payload.get("score_weight", point.payload.get("weight", 0)),
                    "is_knockout": point.payload.get("is_knockout", False),
                    # Fallback: use criteria if reasoning is missing
                    "reasoning": point.payload.get("reasoning") or point.payload.get("criteria", ""),
                    "created_at": point.payload.get("created_at", now_iso),
                    "updated_at": point.payload.get("updated_at", now_iso),
                }
                for point in results
            ]

            log_tool_result("list_icp_rules", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("list_icp_rules", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def list_response_templates(
        brain_id: str,
        reply_type: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """
        List all response templates for a brain without semantic search.

        Used by the Dashboard UI to display brain content.
        Output schema matches UI ResponseTemplateSchema contract.

        Args:
            brain_id: Brain ID for vertical isolation
            reply_type: Optional filter by reply type
            limit: Maximum templates to return (1-1000, default: 100)

        Returns:
            List of templates, each containing:
            id, brain_id, reply_type, tier, template_text, variables,
            personalization, metrics, created_at, updated_at
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "reply_type": reply_type, "limit": limit}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if limit < 1 or limit > 1000:
                raise ToolError("Limit must be between 1 and 1000")

            if reply_type is not None:
                try:
                    ReplyType(reply_type)
                except ValueError:
                    valid_types = ", ".join([r.value for r in ReplyType])
                    raise ToolError(f"Invalid reply_type: {reply_type}. Valid: {valid_types}")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if reply_type is not None:
                must_conditions.append(
                    FieldCondition(key="reply_type", match=MatchValue(value=reply_type))
                )

            # Scroll through collection
            qdrant = _get_qdrant_client()
            results, _ = qdrant.scroll(
                collection_name="response_templates",
                scroll_filter=Filter(must=must_conditions),
                limit=limit,
                with_payload=True,
            )

            # Map to result format - field names match UI contract (ResponseTemplateSchema)
            now_iso = datetime.now().isoformat()
            output = [
                {
                    "id": str(point.id),
                    "brain_id": brain_id,
                    "reply_type": point.payload.get("reply_type", point.payload.get("intent")),
                    "tier": point.payload.get("tier", 1),
                    "template_text": point.payload.get("template_text", ""),
                    "variables": point.payload.get("variables", []),
                    "personalization": point.payload.get(
                        "personalization", point.payload.get("personalization_instructions", {})
                    ),
                    "metrics": None,
                    "created_at": point.payload.get("created_at", now_iso),
                    "updated_at": point.payload.get("updated_at", now_iso),
                }
                for point in results
            ]

            log_tool_result("list_response_templates", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("list_response_templates", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def list_objection_handlers(
        brain_id: str,
        objection_type: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """
        List all objection handlers for a brain without semantic search.

        Used by the Dashboard UI to display brain content.
        Output schema matches UI ObjectionHandlerSchema contract.

        Args:
            brain_id: Brain ID for vertical isolation
            objection_type: Optional filter by objection type
            limit: Maximum handlers to return (1-1000, default: 100)

        Returns:
            List of handlers, each containing:
            id, brain_id, objection_type, triggers, handler_strategy,
            response, variables, follow_ups, usage_stats, created_at, updated_at
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "objection_type": objection_type, "limit": limit}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if limit < 1 or limit > 1000:
                raise ToolError("Limit must be between 1 and 1000")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if objection_type is not None:
                must_conditions.append(
                    FieldCondition(key="objection_type", match=MatchValue(value=objection_type))
                )

            # Scroll through collection
            qdrant = _get_qdrant_client()
            results, _ = qdrant.scroll(
                collection_name="objection_handlers",
                scroll_filter=Filter(must=must_conditions),
                limit=limit,
                with_payload=True,
            )

            # Map to result format - field names match UI contract (ObjectionHandlerSchema)
            now_iso = datetime.now().isoformat()
            output = [
                {
                    "id": str(point.id),
                    "brain_id": brain_id,
                    "objection_type": point.payload.get("objection_type"),
                    "triggers": _get_triggers(point.payload),
                    "handler_strategy": point.payload.get("handler_strategy", ""),
                    "response": point.payload.get(
                        "handler_response", point.payload.get("response", "")
                    ),
                    "variables": point.payload.get("variables", []),
                    "follow_ups": point.payload.get("follow_up_actions", []),
                    "usage_stats": None,
                    "created_at": point.payload.get("created_at", now_iso),
                    "updated_at": point.payload.get("updated_at", now_iso),
                }
                for point in results
            ]

            log_tool_result("list_objection_handlers", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("list_objection_handlers", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def list_market_research(
        brain_id: str,
        content_type: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """
        List all market research documents for a brain without semantic search.

        Used by the Dashboard UI to display brain content.
        Output schema matches UI MarketResearchSchema contract.

        Args:
            brain_id: Brain ID for vertical isolation
            content_type: Optional filter by content type
            limit: Maximum documents to return (1-1000, default: 100)

        Returns:
            List of research documents, each containing:
            id, brain_id, content_type, title, content, key_facts,
            source, source_url, tags, status, created_at
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "content_type": content_type, "limit": limit}

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if limit < 1 or limit > 1000:
                raise ToolError("Limit must be between 1 and 1000")

            if content_type is not None:
                try:
                    ContentType(content_type)
                except ValueError:
                    valid_types = ", ".join([c.value for c in ContentType])
                    raise ToolError(f"Invalid content_type: {content_type}. Valid: {valid_types}")

            # Build filter
            must_conditions = [
                FieldCondition(key="brain_id", match=MatchValue(value=brain_id))
            ]

            if content_type is not None:
                must_conditions.append(
                    FieldCondition(key="content_type", match=MatchValue(value=content_type))
                )

            # Scroll through collection
            qdrant = _get_qdrant_client()
            results, _ = qdrant.scroll(
                collection_name="market_research",
                scroll_filter=Filter(must=must_conditions),
                limit=limit,
                with_payload=True,
            )

            # Map to result format - field names match UI contract (MarketResearchSchema)
            now_iso = datetime.now().isoformat()
            output = [
                {
                    "id": str(point.id),
                    "brain_id": brain_id,
                    "content_type": point.payload.get("content_type"),
                    "title": point.payload.get("title", point.payload.get("topic", "")),
                    "content": point.payload.get("content", ""),
                    "key_facts": point.payload.get("key_facts", []),
                    "source": _normalize_source(point.payload.get("source")),
                    "source_url": point.payload.get("source_url"),
                    "tags": point.payload.get("tags", []),
                    "status": point.payload.get("status", "active"),
                    "created_at": point.payload.get("created_at", now_iso),
                }
                for point in results
            ]

            log_tool_result("list_market_research", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("list_market_research", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # US5: Add Insight (P2)
    # ==========================================================================

    @mcp.tool()
    async def add_insight(
        brain_id: str,
        content: str,
        category: str,
        importance: str = "medium",
        source: dict | None = None,
    ) -> dict:
        """
        Add a new insight to the Knowledge Base with quality gate validation.

        Includes quality gates for:
        - Confidence calculation based on source reliability
        - Duplicate detection (>85% similarity = duplicate)
        - Validation flag for high-importance or uncertain insights

        Args:
            brain_id: Brain ID to add the insight to
            content: The insight content (10-5000 chars)
            category: Insight category (buying_process, pain_point, objection, competitive_intel, messaging_effectiveness, icp_signal)
            importance: Importance level (low, medium, high)
            source: Source provenance metadata with fields:
                - type: Source type (call_transcript, email_reply, linkedin_message, manual_entry)
                - id: Source ID
                - lead_id: Optional lead ID
                - company_name: Optional company name
                - extracted_quote: Optional direct quote

        Returns:
            Result with status (created, duplicate, rejected) and relevant details
        """
        start = time.perf_counter()
        params = {
            "brain_id": brain_id,
            "category": category,
            "importance": importance,
        }

        try:
            # Input validation
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            if not content or len(content) < 10:
                raise ToolError("Insight content too short (minimum 10 characters)")

            if len(content) > 5000:
                raise ToolError("Insight content exceeds 5000 characters")

            try:
                InsightCategory(category)
            except ValueError:
                valid_categories = ", ".join([c.value for c in InsightCategory])
                raise ToolError(f"Invalid category: {category}. Valid: {valid_categories}")

            try:
                Importance(importance)
            except ValueError:
                raise ToolError("Importance must be: low, medium, or high")

            # Validate source
            if source is None:
                raise ToolError("Source metadata is required")

            if not source.get("type"):
                raise ToolError("Source type is required")

            if not source.get("id"):
                raise ToolError("Source ID is required")

            # Convert source dict to SourceMetadata
            source_metadata = SourceMetadata(
                type=source["type"],
                id=source["id"],
                lead_id=source.get("lead_id"),
                company_name=source.get("company_name"),
                extracted_quote=source.get("extracted_quote"),
            )

            # Run quality gates
            gate_result = run_quality_gate(
                brain_id=brain_id,
                content=content,
                category=InsightCategory(category),
                importance=Importance(importance),
                source=source_metadata,
            )

            # Handle rejection
            if not gate_result.passed:
                if gate_result.is_duplicate:
                    output = {
                        "status": "duplicate",
                        "existing_id": gate_result.duplicate_id,
                        "reason": f"Similar insight already exists (similarity: {gate_result.similarity_score})",
                    }
                else:
                    output = {
                        "status": "rejected",
                        "reason": gate_result.rejection_reason,
                    }
                log_tool_result("add_insight", params, output, start)
                return output

            # Create the insight
            insight_id = str(uuid.uuid4())
            content_vector = embed_document(content)
            qdrant = _get_qdrant_client()

            payload = {
                "brain_id": brain_id,
                "content": content,
                "category": category,
                "importance": importance,
                "source": source,
                "confidence": gate_result.confidence_score,
                "validation": {
                    "status": ValidationStatus.PENDING.value,
                    "needs_validation": gate_result.requires_validation,
                },
            }

            qdrant.upsert(
                collection_name="insights",
                points=[
                    PointStruct(
                        id=insight_id,
                        vector=content_vector,
                        payload=payload,
                    )
                ],
            )

            output = {
                "status": "created",
                "id": insight_id,
                "confidence": gate_result.confidence_score,
                "needs_validation": gate_result.requires_validation,
            }

            log_tool_result("add_insight", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("add_insight", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # US6: Brain Management (P2)
    # ==========================================================================

    @mcp.tool()
    async def get_brain(
        brain_id: str | None = None,
        vertical: str | None = None,
    ) -> dict | None:
        """
        Get a brain configuration from the Knowledge Base.

        Args:
            brain_id: Specific brain ID to fetch
            vertical: Or fetch active brain by vertical name

        Returns:
            Brain configuration with id, name, vertical, version, status, description,
            config, stats, created_at, updated_at. Returns None if not found.

        Note:
            If neither brain_id nor vertical provided, returns the default active brain.
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "vertical": vertical}

        try:
            qdrant = _get_qdrant_client()

            if brain_id:
                # Fetch by exact brain_id
                results, _ = qdrant.scroll(
                    collection_name="brains",
                    scroll_filter=Filter(
                        must=[FieldCondition(key="brain_id", match=MatchValue(value=brain_id))]
                    ),
                    limit=1,
                    with_payload=True,
                )
            elif vertical:
                # Fetch active brain for vertical
                results, _ = qdrant.scroll(
                    collection_name="brains",
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(key="vertical", match=MatchValue(value=vertical)),
                            FieldCondition(key="status", match=MatchValue(value="active")),
                        ]
                    ),
                    limit=1,
                    with_payload=True,
                )
            else:
                # Get default active brain
                results, _ = qdrant.scroll(
                    collection_name="brains",
                    scroll_filter=Filter(
                        must=[FieldCondition(key="status", match=MatchValue(value="active"))]
                    ),
                    limit=1,
                    with_payload=True,
                )

            if not results:
                log_tool_result("get_brain", params, None, start)
                return None

            point = results[0]
            payload_data = _serialize_payload(dict(point.payload))
            # Map payload "id" to "brain_id" for dashboard compatibility
            resolved_brain_id = payload_data.pop("id", None) or str(point.id)

            # Calculate dynamic stats instead of using stale stored stats
            dynamic_stats = await _calculate_brain_stats_internal(resolved_brain_id)

            output = {
                "brain_id": resolved_brain_id,
                **payload_data,
                "stats": dynamic_stats,  # Override stored stats with calculated
            }

            log_tool_result("get_brain", params, output, start)
            return output

        except Exception as e:
            log_tool_error("get_brain", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def list_brains() -> list[dict]:
        """
        List all available brains from the Knowledge Base.

        Returns:
            List of all brain configurations, each containing:
            id, name, vertical, version, status, description, config, stats,
            created_at, updated_at
        """
        start = time.perf_counter()
        params = {}

        try:
            qdrant = _get_qdrant_client()

            results, _ = qdrant.scroll(
                collection_name="brains",
                limit=100,
                with_payload=True,
            )

            output = []
            for point in results:
                payload_data = _serialize_payload(dict(point.payload))
                # Map payload "id" to "brain_id" for dashboard compatibility
                # Payload stores brain_id under "id" key, but dashboard expects "brain_id"
                brain_id = payload_data.pop("id", None) or str(point.id)

                # Calculate dynamic stats for each brain
                dynamic_stats = await _calculate_brain_stats_internal(brain_id)

                output.append({
                    "brain_id": brain_id,
                    **payload_data,
                    "stats": dynamic_stats,  # Override stored stats with calculated
                })

            log_tool_result("list_brains", params, output, start)
            return output

        except Exception as e:
            log_tool_error("list_brains", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # Brain Lifecycle Tools (003-brain-lifecycle)
    # ==========================================================================

    @mcp.tool()
    async def create_brain(
        vertical: str,
        name: str,
        description: str,
        config: dict | None = None,
    ) -> dict:
        """
        Create a new brain for a vertical with status "draft".

        Args:
            vertical: Vertical identifier (lowercase, alphanumeric with hyphens/underscores)
            name: Human-readable brain name (3-100 chars)
            description: Brain description explaining its purpose (10-500 chars)
            config: Optional configuration (uses defaults if not provided)
                - default_tier_thresholds: Score thresholds for response tiers
                - auto_response_enabled: Enable automatic responses for tier 1
                - learning_enabled: Enable insight learning from conversations
                - quality_gate_threshold: Minimum confidence for auto-responses

        Returns:
            Result with brain_id, status, and message
        """
        from .models import generate_brain_id

        start = time.perf_counter()
        params = {"vertical": vertical, "name": name}

        try:
            # Validate vertical format
            import re
            if not re.match(r"^[a-z][a-z0-9_-]*$", vertical):
                raise ToolError(
                    f"Invalid vertical format: {vertical}. "
                    "Must be lowercase, start with letter, alphanumeric with hyphens/underscores."
                )

            if len(vertical) < 2 or len(vertical) > 50:
                raise ToolError("Vertical must be 2-50 characters")

            if len(name) < 3 or len(name) > 100:
                raise ToolError("Name must be 3-100 characters")

            if len(description) < 10 or len(description) > 500:
                raise ToolError("Description must be 10-500 characters")

            # Generate brain ID
            brain_id = generate_brain_id(vertical)

            # Default config
            default_config = {
                "default_tier_thresholds": {"tier1": 90, "tier2": 70, "tier3": 50},
                "auto_response_enabled": False,
                "learning_enabled": True,
                "quality_gate_threshold": 0.7,
            }

            # Merge with provided config
            final_config = {**default_config, **(config or {})}

            timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            payload = {
                "id": brain_id,
                "name": name,
                "vertical": vertical,
                "version": "1.0",
                "status": "draft",
                "description": description,
                "config": final_config,
                "stats": {
                    "icp_rules_count": 0,
                    "templates_count": 0,
                    "handlers_count": 0,
                    "research_docs_count": 0,
                    "insights_count": 0,
                },
                "created_at": timestamp,
                "updated_at": timestamp,
            }

            # Create embedding for brain
            brain_vector = embed_document(f"brain {vertical} {name} {description}")
            qdrant = _get_qdrant_client()

            # Generate UUID-format point ID for Qdrant (brain_id stored in payload)
            point_id = generate_point_id(brain_id, brain_id)

            qdrant.upsert(
                collection_name="brains",
                points=[
                    PointStruct(
                        id=point_id,
                        vector=brain_vector,
                        payload=payload,
                    )
                ],
            )

            output = {
                "brain_id": brain_id,
                "status": "draft",
                "message": f"Brain '{name}' created for vertical '{vertical}'",
            }

            log_tool_result("create_brain", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("create_brain", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def seed_icp_rules(
        brain_id: str,
        rules: list[dict],
    ) -> dict:
        """
        Seed ICP (Ideal Customer Profile) rules to a brain.

        Args:
            brain_id: Target brain ID (must be draft or active)
            rules: List of ICP rule definitions, each containing:
                - name: Rule display name
                - category: Rule category (firmographic, technographic, behavioral, intent)
                - attribute: Attribute being evaluated
                - criteria: Rule criteria description for semantic matching
                - weight: Score weight (1-100)
                - match_condition: Structured condition for rule matching
                - is_knockout: Whether this rule is a knockout criterion
                - reasoning: Explanation of why this rule matters

        Returns:
            SeedingResult with brain_id, collection, seeded_count, errors, message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "rules_count": len(rules)}

        try:
            result = await _seed_items_to_collection(
                brain_id=brain_id,
                items=rules,
                collection="icp_rules",
                embed_field="criteria",
                key_field="name",
            )

            output = {
                "brain_id": result.brain_id,
                "collection": result.collection,
                "seeded_count": result.seeded_count,
                "errors": [e.model_dump() for e in result.errors],
                "message": result.message,
            }

            log_tool_result("seed_icp_rules", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("seed_icp_rules", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def seed_templates(
        brain_id: str,
        templates: list[dict],
    ) -> dict:
        """
        Seed response templates to a brain.

        Args:
            brain_id: Target brain ID (must be draft or active)
            templates: List of template definitions, each containing:
                - name: Template name
                - intent: Reply type this template handles
                - template_text: Template text with {{variable}} placeholders
                - variables: List of variable names used in template
                - tier: Response tier (1=auto-send, 2=draft, 3=human only)
                - personalization_instructions: Instructions for personalizing

        Returns:
            SeedingResult with brain_id, collection, seeded_count, errors, message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "templates_count": len(templates)}

        try:
            result = await _seed_items_to_collection(
                brain_id=brain_id,
                items=templates,
                collection="response_templates",
                embed_field="template_text",
                key_field="name",
            )

            output = {
                "brain_id": result.brain_id,
                "collection": result.collection,
                "seeded_count": result.seeded_count,
                "errors": [e.model_dump() for e in result.errors],
                "message": result.message,
            }

            log_tool_result("seed_templates", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("seed_templates", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def seed_handlers(
        brain_id: str,
        handlers: list[dict],
    ) -> dict:
        """
        Seed objection handlers to a brain.

        Args:
            brain_id: Target brain ID (must be draft or active)
            handlers: List of handler definitions, each containing:
                - objection_text: Example objection text for semantic matching
                - objection_type: Objection category
                - category: Subcategory within objection type
                - response: Handler response text
                - handler_strategy: Strategy description for this handler
                - variables: Variable placeholders in response
                - follow_up_actions: Recommended follow-up actions

        Returns:
            SeedingResult with brain_id, collection, seeded_count, errors, message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "handlers_count": len(handlers)}

        try:
            result = await _seed_items_to_collection(
                brain_id=brain_id,
                items=handlers,
                collection="objection_handlers",
                embed_field="objection_text",
                key_field="objection_text",
            )

            output = {
                "brain_id": result.brain_id,
                "collection": result.collection,
                "seeded_count": result.seeded_count,
                "errors": [e.model_dump() for e in result.errors],
                "message": result.message,
            }

            log_tool_result("seed_handlers", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("seed_handlers", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def seed_research(
        brain_id: str,
        documents: list[dict],
    ) -> dict:
        """
        Seed market research documents to a brain.

        Args:
            brain_id: Target brain ID (must be draft or active)
            documents: List of research document definitions, each containing:
                - topic: Research topic/title
                - content: Research content
                - content_type: Type of research content
                - source: Source attribution
                - date: Research date (YYYY-MM-DD)
                - key_facts: Key facts extracted from research
                - source_url: Optional source URL

        Returns:
            SeedingResult with brain_id, collection, seeded_count, errors, message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "documents_count": len(documents)}

        try:
            result = await _seed_items_to_collection(
                brain_id=brain_id,
                items=documents,
                collection="market_research",
                embed_field="content",
                key_field="topic",
            )

            output = {
                "brain_id": result.brain_id,
                "collection": result.collection,
                "seeded_count": result.seeded_count,
                "errors": [e.model_dump() for e in result.errors],
                "message": result.message,
            }

            log_tool_result("seed_research", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("seed_research", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # Brain Lifecycle Management - Status Transitions (003-brain-lifecycle US2)
    # ==========================================================================

    @mcp.tool()
    async def update_brain_status(
        brain_id: str,
        status: str,
    ) -> dict:
        """
        Update the status of a brain with transition validation.

        Valid transitions per FR-013:
        - draft → active
        - active → archived
        - archived → active

        When activating a brain (FR-014, FR-015):
        - Only one brain per vertical can be active at a time
        - Any currently active brain in the same vertical is automatically archived

        Args:
            brain_id: Brain ID to update
            status: New status ("draft", "active", or "archived")

        Returns:
            Result with brain_id, previous_status, new_status, deactivated_brain_id (if any), message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "status": status}

        try:
            # Validate brain_id format
            if not validate_brain_id(brain_id):
                raise ToolError(f"Invalid brain_id format: {brain_id}")

            # Validate status value
            try:
                new_status = BrainStatus(status)
            except ValueError:
                valid_statuses = [s.value for s in BrainStatus]
                raise ToolError(
                    f"Invalid status '{status}'. Must be one of: {valid_statuses}"
                )

            # Get current brain state
            brain_data = await _validate_brain_exists(brain_id)
            current_status = BrainStatus(brain_data.get("status", "draft"))
            vertical = brain_data.get("vertical")

            # Validate transition
            if not validate_status_transition(current_status, new_status):
                valid_targets = [s.value for s in VALID_TRANSITIONS.get(current_status, [])]
                raise ToolError(
                    f"Invalid transition from '{current_status.value}' to '{new_status.value}'. "
                    f"Valid transitions from '{current_status.value}': {valid_targets}"
                )

            qdrant = _get_qdrant_client()
            deactivated_brain_id = None

            # If activating, archive any currently active brain in the same vertical
            if new_status == BrainStatus.ACTIVE:
                results, _ = qdrant.scroll(
                    collection_name="brains",
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(key="vertical", match=MatchValue(value=vertical)),
                            FieldCondition(key="status", match=MatchValue(value="active")),
                        ]
                    ),
                    limit=10,
                    with_payload=True,
                )

                # Archive any active brains (should be at most one, but handle multiples)
                for point in results:
                    other_brain_id = point.payload.get("id")
                    if other_brain_id and other_brain_id != brain_id:
                        # Update the other brain to archived
                        updated_payload = {**point.payload}
                        updated_payload["status"] = BrainStatus.ARCHIVED.value
                        updated_payload["updated_at"] = time.strftime(
                            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                        )

                        # Get point_id for the other brain
                        other_point_id = generate_point_id(other_brain_id, other_brain_id)
                        other_vector = embed_document(
                            f"brain {updated_payload.get('vertical')} "
                            f"{updated_payload.get('name')} {updated_payload.get('description')}"
                        )

                        qdrant.upsert(
                            collection_name="brains",
                            points=[
                                PointStruct(
                                    id=other_point_id,
                                    vector=other_vector,
                                    payload=updated_payload,
                                )
                            ],
                        )
                        deactivated_brain_id = other_brain_id

            # Update the target brain status
            updated_payload = {**brain_data}
            updated_payload["status"] = new_status.value
            updated_payload["updated_at"] = time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
            )

            point_id = generate_point_id(brain_id, brain_id)
            brain_vector = embed_document(
                f"brain {updated_payload.get('vertical')} "
                f"{updated_payload.get('name')} {updated_payload.get('description')}"
            )

            qdrant.upsert(
                collection_name="brains",
                points=[
                    PointStruct(
                        id=point_id,
                        vector=brain_vector,
                        payload=updated_payload,
                    )
                ],
            )

            output = {
                "brain_id": brain_id,
                "previous_status": current_status.value,
                "new_status": new_status.value,
                "deactivated_brain_id": deactivated_brain_id,
                "message": f"Brain '{brain_id}' status updated from '{current_status.value}' to '{new_status.value}'",
            }

            log_tool_result("update_brain_status", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("update_brain_status", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # Brain Analytics Tools (003-brain-lifecycle US3)
    # ==========================================================================

    @mcp.tool()
    async def get_brain_stats(brain_id: str) -> dict:
        """
        Get content statistics for a brain.

        Returns counts of all content types stored in the brain.

        Args:
            brain_id: Brain ID to get stats for

        Returns:
            Stats with brain_id, icp_rules_count, templates_count,
            handlers_count, research_docs_count, insights_count
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id}

        try:
            # Validate brain exists
            await _validate_brain_exists(brain_id)

            qdrant = _get_qdrant_client()

            # Count items in each collection for this brain
            collections = [
                ("icp_rules", "icp_rules_count"),
                ("response_templates", "templates_count"),
                ("objection_handlers", "handlers_count"),
                ("market_research", "research_docs_count"),
                ("insights", "insights_count"),
            ]

            counts = {}
            for collection, count_key in collections:
                try:
                    results, _ = qdrant.scroll(
                        collection_name=collection,
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="brain_id", match=MatchValue(value=brain_id)
                                )
                            ]
                        ),
                        limit=1000,  # Count up to 1000 items
                        with_payload=False,
                    )
                    counts[count_key] = len(results)
                except Exception:
                    # Collection may not exist or other error, default to 0
                    counts[count_key] = 0

            output = {
                "brain_id": brain_id,
                **counts,
            }

            log_tool_result("get_brain_stats", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("get_brain_stats", params, e, start)
            _handle_qdrant_error(e)

    @mcp.tool()
    async def get_brain_report(brain_id: str) -> dict:
        """
        Get a detailed report for a brain including completeness and content details.

        Completeness is calculated as the percentage of content types present
        (0.0 = no content, 1.0 = all 4 content types have at least 1 item).

        Args:
            brain_id: Brain ID to generate report for

        Returns:
            Report with brain_id, name, vertical, status, completeness,
            content_details (per-collection stats with last_updated),
            created_at, updated_at, message
        """
        from .models import BrainStatsResult, calculate_completeness

        start = time.perf_counter()
        params = {"brain_id": brain_id}

        try:
            # Get brain data
            brain_data = await _validate_brain_exists(brain_id)

            qdrant = _get_qdrant_client()

            # Get content details for each collection
            content_collections = [
                ("icp_rules", "icp_rules"),
                ("response_templates", "response_templates"),
                ("objection_handlers", "objection_handlers"),
                ("market_research", "market_research"),
            ]

            content_details = []
            stats_for_completeness = {
                "icp_rules_count": 0,
                "templates_count": 0,
                "handlers_count": 0,
                "research_docs_count": 0,
                "insights_count": 0,
            }

            stats_key_map = {
                "icp_rules": "icp_rules_count",
                "response_templates": "templates_count",
                "objection_handlers": "handlers_count",
                "market_research": "research_docs_count",
            }

            for collection, display_name in content_collections:
                try:
                    results, _ = qdrant.scroll(
                        collection_name=collection,
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="brain_id", match=MatchValue(value=brain_id)
                                )
                            ]
                        ),
                        limit=1000,
                        with_payload=True,
                    )

                    count = len(results)

                    # Find most recent updated_at
                    last_updated = None
                    for result in results:
                        item_updated = result.payload.get("updated_at")
                        if item_updated:
                            if last_updated is None or item_updated > last_updated:
                                last_updated = item_updated

                    content_details.append({
                        "collection": display_name,
                        "last_updated": last_updated,
                        "count": count,
                    })

                    # Update stats for completeness calculation
                    if collection in stats_key_map:
                        stats_for_completeness[stats_key_map[collection]] = count

                except Exception:
                    content_details.append({
                        "collection": display_name,
                        "last_updated": None,
                        "count": 0,
                    })

            # Calculate completeness
            stats_result = BrainStatsResult(
                brain_id=brain_id,
                **stats_for_completeness,
            )
            completeness = calculate_completeness(stats_result)

            output = {
                "brain_id": brain_id,
                "name": brain_data.get("name"),
                "vertical": brain_data.get("vertical"),
                "status": brain_data.get("status"),
                "completeness": completeness,
                "content_details": content_details,
                "created_at": brain_data.get("created_at"),
                "updated_at": brain_data.get("updated_at"),
                "message": f"Brain report generated with {completeness * 100:.0f}% content completeness",
            }

            log_tool_result("get_brain_report", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("get_brain_report", params, e, start)
            _handle_qdrant_error(e)

    # ==========================================================================
    # Brain Deletion Tool (003-brain-lifecycle US4)
    # ==========================================================================

    @mcp.tool()
    async def delete_brain(
        brain_id: str,
        confirm: bool = False,
    ) -> dict:
        """
        Delete a brain and all its associated content (cascade delete).

        Constraints per FR-016 and FR-017:
        - Active brains CANNOT be deleted (archive first)
        - Only draft or archived brains can be deleted
        - Requires confirm=True to prevent accidental deletion
        - Cascades to delete all content (ICP rules, templates, handlers, research)

        Args:
            brain_id: Brain ID to delete (must be draft or archived)
            confirm: Confirmation flag (must be True to proceed)

        Returns:
            Result with brain_id, deleted_content (counts per collection), message
        """
        start = time.perf_counter()
        params = {"brain_id": brain_id, "confirm": confirm}

        try:
            # Require confirmation
            if not confirm:
                raise ToolError(
                    "Deletion requires confirm=True. This action cannot be undone."
                )

            # Get brain data and validate existence
            brain_data = await _validate_brain_exists(brain_id)
            status = brain_data.get("status", "")

            # Prevent deletion of active brains
            if status == BrainStatus.ACTIVE.value:
                raise ToolError(
                    f"Cannot delete active brain '{brain_id}'. "
                    "Archive the brain first before deletion."
                )

            qdrant = _get_qdrant_client()

            # Collections to cascade delete
            content_collections = [
                ("icp_rules", "icp_rules"),
                ("response_templates", "response_templates"),
                ("objection_handlers", "objection_handlers"),
                ("market_research", "market_research"),
                ("insights", "insights"),
            ]

            deleted_counts = {}

            # Delete content from each collection
            for collection, display_name in content_collections:
                try:
                    # First, get the point IDs for this brain
                    results, _ = qdrant.scroll(
                        collection_name=collection,
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="brain_id", match=MatchValue(value=brain_id)
                                )
                            ]
                        ),
                        limit=10000,
                        with_payload=False,
                    )

                    count = len(results)
                    deleted_counts[display_name] = count

                    if count > 0:
                        point_ids = [str(r.id) for r in results]
                        qdrant.delete(
                            collection_name=collection,
                            points_selector=point_ids,
                        )

                except Exception:
                    # Collection may not exist, default to 0
                    deleted_counts[display_name] = 0

            # Delete the brain itself by querying for actual point ID
            try:
                brain_results, _ = qdrant.scroll(
                    collection_name="brains",
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(key="id", match=MatchValue(value=brain_id))
                        ]
                    ),
                    limit=1,
                    with_payload=False,
                )

                if brain_results:
                    actual_point_id = str(brain_results[0].id)
                    qdrant.delete(
                        collection_name="brains",
                        points_selector=[actual_point_id],
                    )
            except Exception as e:
                raise ToolError(f"Failed to delete brain record: {e}")

            total_deleted = sum(deleted_counts.values())

            output = {
                "brain_id": brain_id,
                "deleted_content": deleted_counts,
                "message": f"Brain '{brain_id}' and {total_deleted} content items deleted successfully",
            }

            log_tool_result("delete_brain", params, output, start)
            return output

        except ToolError:
            raise
        except Exception as e:
            log_tool_error("delete_brain", params, e, start)
            _handle_qdrant_error(e)
