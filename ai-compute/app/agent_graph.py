import time
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from .schemas import AgentPlanRequest, AgentPlanResponse, AgentToolPlan


class AgentGraphState(TypedDict):
    candidate_queries: list[str]
    context_titles: list[str]
    current_query: str | None
    errors: list[str]
    iterations: int
    max_iterations: int
    preference_tags: list[str]
    recommendations: list[dict[str, object]]
    request_id: str
    search_queries: list[str]
    started_at: float
    stopped_reason: Literal["completed", "max_iterations", "timeout"]
    timeout_ms: int
    tool_results: list[dict[str, object]]
    user_id: str


def build_agent_plan(request: AgentPlanRequest) -> AgentPlanResponse:
    graph = StateGraph(AgentGraphState)
    graph.add_node("load_rag_context", load_rag_context)
    graph.add_node("decide_tool", decide_tool)
    graph.add_node("call_mcp_tool", call_mcp_tool)
    graph.add_node("merge_candidates", merge_candidates)
    graph.add_node("stop_or_continue", stop_or_continue)

    graph.set_entry_point("load_rag_context")
    graph.add_edge("load_rag_context", "decide_tool")
    graph.add_edge("decide_tool", "call_mcp_tool")
    graph.add_edge("call_mcp_tool", "merge_candidates")
    graph.add_conditional_edges(
        "merge_candidates",
        route_after_merge,
        {"continue": "decide_tool", "stop": "stop_or_continue"},
    )
    graph.add_edge("stop_or_continue", END)

    compiled_graph = graph.compile()
    final_state = compiled_graph.invoke(initial_state(request))

    return AgentPlanResponse(
        errors=final_state["errors"],
        iterations=final_state["iterations"],
        maxIterations=final_state["max_iterations"],
        provider="langgraph",
        searchQueries=final_state["search_queries"],
        stoppedReason=final_state["stopped_reason"],
        toolPlan=[
            AgentToolPlan(
                arguments={
                    "limit": 8,
                    "preferenceTags": final_state["preference_tags"],
                    "query": query,
                },
                name="search_games",
            )
            for query in final_state["search_queries"]
        ],
    )


def initial_state(request: AgentPlanRequest) -> AgentGraphState:
    state: AgentGraphState = {
        "candidate_queries": [],
        "context_titles": [],
        "current_query": None,
        "errors": [],
        "iterations": 0,
        "max_iterations": request.maxIterations,
        "preference_tags": [],
        "recommendations": [],
        "request_id": request.requestId,
        "search_queries": [],
        "started_at": time.time(),
        "stopped_reason": "completed",
        "timeout_ms": request.timeoutMs,
        "tool_results": [],
        "user_id": request.userId,
    }

    return request_to_state_context(request, state)


def load_rag_context(state: AgentGraphState) -> AgentGraphState:
    queries = unique_non_empty(
        [
            *state["context_titles"],
            *[tag.replace("_", " ") for tag in state["preference_tags"][:3]],
            "story rich RPG",
        ],
    )

    return {
        **state,
        "candidate_queries": queries,
    }


def decide_tool(state: AgentGraphState) -> AgentGraphState:
    used_queries = {query.lower() for query in state["search_queries"]}
    next_query = next(
        (
            query
            for query in state["candidate_queries"]
            if query.lower() not in used_queries
        ),
        None,
    )

    return {
        **state,
        "current_query": next_query,
    }


def call_mcp_tool(state: AgentGraphState) -> AgentGraphState:
    if not state["current_query"]:
        return state

    tool_result = {
        "arguments": {
            "limit": 8,
            "preferenceTags": state["preference_tags"],
            "query": state["current_query"],
        },
        "name": "search_games",
        "planned": True,
    }

    return {
        **state,
        "iterations": state["iterations"] + 1,
        "search_queries": [*state["search_queries"], state["current_query"]],
        "tool_results": [*state["tool_results"], tool_result],
    }


def merge_candidates(state: AgentGraphState) -> AgentGraphState:
    if not state["current_query"]:
        return state

    return {
        **state,
        "current_query": None,
        "recommendations": [
            *state["recommendations"],
            {
                "arguments": {
                    "limit": 8,
                    "preferenceTags": state["preference_tags"],
                    "query": state["current_query"],
                },
                "name": "search_games",
            },
        ],
    }


def route_after_merge(state: AgentGraphState) -> Literal["continue", "stop"]:
    if is_timed_out(state):
        return "stop"

    if state["iterations"] >= state["max_iterations"]:
        return "stop"

    if len(state["search_queries"]) >= len(state["candidate_queries"]):
        return "stop"

    return "continue"


def stop_or_continue(state: AgentGraphState) -> AgentGraphState:
    if is_timed_out(state):
        stopped_reason: Literal["completed", "max_iterations", "timeout"] = "timeout"
    elif state["iterations"] >= state["max_iterations"] and len(
        state["search_queries"],
    ) < len(state["candidate_queries"]):
        stopped_reason = "max_iterations"
    else:
        stopped_reason = "completed"

    return {
        **state,
        "stopped_reason": stopped_reason,
    }


def is_timed_out(state: AgentGraphState) -> bool:
    elapsed_ms = (time.time() - state["started_at"]) * 1000

    return elapsed_ms > state["timeout_ms"]


def unique_non_empty(values: list[str | None]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        normalized = value.strip() if value else ""
        key = normalized.lower()

        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)

    return result


def request_to_state_context(
    request: AgentPlanRequest,
    state: AgentGraphState,
) -> AgentGraphState:
    titles = [
        source.gameTitle
        for source in request.contextSources
        if source.gameTitle and source.gameTitle.strip()
    ]
    preference_tags = [tag.label for tag in request.preferenceTags if tag.label.strip()]

    return {
        **state,
        "context_titles": unique_non_empty(titles),
        "preference_tags": unique_non_empty(preference_tags),
    }
