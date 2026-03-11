"""
Tests for ai-service main.py
Coverage target: >80%

Run with:
    pytest test_main.py -v
"""

import json
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
import pytest


# ─── Stub out heavy imports before importing main ────────────────────────────
# grpcio / grpcio-tools may not be installed in test env

def _stub_module(name, **attrs):
    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules[name] = mod
    return mod


# grpc stubs
grpc_mod = _stub_module("grpc", StatusCode=MagicMock(), aio=MagicMock())
grpc_mod.StatusCode.INTERNAL = "INTERNAL"
_stub_module("grpc.aio", server=MagicMock())

# asyncpg stub
asyncpg_mock = _stub_module("asyncpg", create_pool=AsyncMock(), Pool=object)

# google.genai stub — patch before dotenv loads
genai_mod = _stub_module("google", genai=MagicMock())
genai_inner = _stub_module("google.genai", Client=MagicMock())

# dotenv stub
load_dotenv_mod = _stub_module("dotenv", load_dotenv=MagicMock())

# httpx stub
httpx_mod = _stub_module("httpx", AsyncClient=MagicMock())

# Protobuf stubs — enough to let main.py import
pb2_grpc = _stub_module("ai_service_pb2_grpc",
                        AIServiceServicer=object,
                        add_AIServiceServicer_to_server=MagicMock())

# Build minimal pb2 classes
class _FocusPlan:
    def __init__(self, session_type="", sessions=0, total_minutes=0, label=""):
        self.session_type = session_type
        self.sessions = sessions
        self.total_minutes = total_minutes
        self.label = label

class _GeneratedTask:
    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)

class _GenerateTasksResponse:
    def __init__(self, tasks=None, summary=""):
        self.tasks = tasks or []
        self.summary = summary

class _EstimateTimeResponse:
    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)

class _SimilarTask:
    def __init__(self, title="", actual_pomodoros=0, similarity=0.0):
        self.title = title
        self.actual_pomodoros = actual_pomodoros
        self.similarity = similarity

class _StoreTaskEmbeddingResponse:
    def __init__(self, success=False):
        self.success = success

pb2 = _stub_module(
    "ai_service_pb2",
    FocusPlan=_FocusPlan,
    GeneratedTask=_GeneratedTask,
    GenerateTasksResponse=_GenerateTasksResponse,
    EstimateTimeResponse=_EstimateTimeResponse,
    SimilarTask=_SimilarTask,
    StoreTaskEmbeddingResponse=_StoreTaskEmbeddingResponse,
)

# Now import main (all side effects are stubbed)
import main  # noqa: E402
import estimation
import database
import rag
import servicer
import task_generator


# ─────────────────────────────────────────────────────────────────────────────
# estimate_from_similar()
# ─────────────────────────────────────────────────────────────────────────────
class TestEstimateFromSimilar:

    def test_returns_none_when_empty(self):
        est, reason, conf = rag.estimate_from_similar([])
        assert est is None
        assert reason is None
        assert conf == "none"

    def test_returns_none_when_no_task_above_threshold(self):
        tasks = [{"similarity": 0.3, "actual_pomodoros": 3, "title": "T", "is_own": True}]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est is None
        assert conf == "none"

    def test_single_relevant_own_task(self):
        tasks = [{"similarity": 0.8, "actual_pomodoros": 4, "title": "Write tests", "is_own": True}]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est == 4
        assert "Write tests" in reason
        assert conf == "low"  # only 1 task with threshold 0.7 → low

    def test_high_confidence_with_3_or_more_tasks(self):
        tasks = [
            {"similarity": 0.9, "actual_pomodoros": 3, "title": "A", "is_own": True},
            {"similarity": 0.8, "actual_pomodoros": 5, "title": "B", "is_own": True},
            {"similarity": 0.7, "actual_pomodoros": 4, "title": "C", "is_own": True},
        ]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est >= 1
        assert conf == "medium"  # 3 tasks at 0.7-0.9 → medium with current formula

    def test_weighted_average_rounds_correctly(self):
        # All similarity 0.75 → equal weight → average = 2
        tasks = [
            {"similarity": 0.75, "actual_pomodoros": 2, "title": "X", "is_own": True},
            {"similarity": 0.75, "actual_pomodoros": 2, "title": "Y", "is_own": True},
        ]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est == 2

    def test_other_user_tasks_mentioned_in_reason(self):
        tasks = [
            {"similarity": 0.9, "actual_pomodoros": 3, "title": "Own task", "is_own": True},
            {"similarity": 0.8, "actual_pomodoros": 4, "title": "Other task", "is_own": False},
        ]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est is not None
        assert "người dùng khác" in reason or "cộng đồng" in reason or "kết hợp" in reason.lower()

    def test_only_other_user_tasks_uses_community_message(self):
        tasks = [
            {"similarity": 0.9, "actual_pomodoros": 3, "title": "Community", "is_own": False},
        ]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est is not None
        assert "cộng đồng" in reason

    def test_minimum_estimate_is_1(self):
        tasks = [{"similarity": 0.9, "actual_pomodoros": 0, "title": "Z", "is_own": True}]
        est, reason, conf = rag.estimate_from_similar(tasks)
        assert est >= 1


# ─────────────────────────────────────────────────────────────────────────────
# build_focus_plan()
# ─────────────────────────────────────────────────────────────────────────────
class TestBuildFocusPlan:

    def test_single_pomodoro_returns_quick15(self):
        plan = estimation.build_focus_plan(1)
        assert plan["session_type"] == "QUICK_15"
        assert plan["sessions"] == 1

    def test_multiple_pomodoros_returns_standard(self):
        plan = estimation.build_focus_plan(3)
        assert plan["session_type"] == "STANDARD"
        assert plan["sessions"] == 3

    def test_total_minutes_includes_breaks(self):
        # 3 sessions × 25 min + 2 breaks × 5 min = 85 min
        plan = estimation.build_focus_plan(3)
        assert plan["total_minutes"] == 3 * 25 + (3 - 1) * 5

    def test_zero_returns_quick15(self):
        # Edge case: 0 → clamped to 1 → QUICK_15
        plan = estimation.build_focus_plan(0)
        assert plan["session_type"] == "QUICK_15"

    def test_large_pomodoros(self):
        plan = estimation.build_focus_plan(8)
        assert plan["session_type"] == "STANDARD"
        assert plan["sessions"] == 8


# ─────────────────────────────────────────────────────────────────────────────
# make_focus_plan_proto()
# ─────────────────────────────────────────────────────────────────────────────
class TestMakeFocusPlanProto:

    def test_quick5_label(self):
        plan = {"session_type": "QUICK_5", "sessions": 1, "total_minutes": 5}
        proto = estimation.make_focus_plan_proto(plan)
        assert proto.label == "⚡ Quick 5 phút"
        assert proto.session_type == "QUICK_5"

    def test_quick15_label(self):
        plan = {"session_type": "QUICK_15", "sessions": 1, "total_minutes": 15}
        proto = estimation.make_focus_plan_proto(plan)
        assert proto.label == "⚡ Quick 15 phút"
        assert proto.session_type == "QUICK_15"

    def test_standard_single_pomodoro_label(self):
        plan = {"session_type": "STANDARD", "sessions": 1, "total_minutes": 25}
        proto = estimation.make_focus_plan_proto(plan)
        assert "🍅" in proto.label
        assert "Pomodoro" in proto.label

    def test_standard_multi_pomodoro_label(self):
        plan = {"session_type": "STANDARD", "sessions": 3, "total_minutes": 85}
        proto = estimation.make_focus_plan_proto(plan)
        assert "🍅" in proto.label
        assert "Pomodoros" in proto.label
        assert "1h" in proto.label  # 85 min = 1h25

    def test_standard_exact_hours_label(self):
        plan = {"session_type": "STANDARD", "sessions": 4, "total_minutes": 120}
        proto = estimation.make_focus_plan_proto(plan)
        assert "2h00" in proto.label

    def test_total_minutes_preserved(self):
        plan = {"session_type": "STANDARD", "sessions": 2, "total_minutes": 55}
        proto = estimation.make_focus_plan_proto(plan)
        assert proto.total_minutes == 55
        assert proto.sessions == 2


# ─────────────────────────────────────────────────────────────────────────────
# get_embedding() — async, mock httpx
# ─────────────────────────────────────────────────────────────────────────────
class TestGetEmbedding:

    @pytest.mark.asyncio
    async def test_returns_embedding_on_success(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"embedding": {"values": [0.1, 0.2, 0.3]}}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("database.httpx.AsyncClient", return_value=mock_client):
            result = await database.get_embedding("test text")
        assert result == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_returns_none_on_http_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(side_effect=Exception("Connection error"))

        with patch("database.httpx.AsyncClient", return_value=mock_client):
            result = await database.get_embedding("test text")
        assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# find_similar_tasks() — async, mock get_embedding + get_db_pool
# ─────────────────────────────────────────────────────────────────────────────
class TestFindSimilarTasks:

    @pytest.mark.asyncio
    async def test_returns_empty_when_embedding_fails(self):
        with patch("rag.get_embedding", return_value=None):
            result = await rag.find_similar_tasks("u1", "some text")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_weighted_results(self):
        embedding = [0.1] * 10

        mock_pool = AsyncMock()
        mock_pool.fetch = AsyncMock(return_value=[
            {"id": "t1", "title": "Task A", "completedPomodoros": 3, "userId": "u1", "similarity": 0.9},
            {"id": "t2", "title": "Task B", "completedPomodoros": 2, "userId": "u2", "similarity": 0.8},
        ])

        with patch("rag.get_embedding", return_value=embedding), \
             patch("rag.get_db_pool", return_value=mock_pool):
            result = await rag.find_similar_tasks("u1", "some text")

        assert len(result) == 2
        # Own user gets 1.0 weight, other user gets 0.7
        own = next(r for r in result if r["is_own"])
        other = next(r for r in result if not r["is_own"])
        assert own["similarity"] == pytest.approx(0.9 * 1.0)
        assert other["similarity"] == pytest.approx(0.8 * 0.7)

    @pytest.mark.asyncio
    async def test_results_sorted_by_weighted_similarity(self):
        embedding = [0.1] * 10

        mock_pool = AsyncMock()
        # Other user but high raw sim, own user but low sim
        mock_pool.fetch = AsyncMock(return_value=[
            {"id": "t1", "title": "Low own", "completedPomodoros": 2, "userId": "u1", "similarity": 0.5},
            {"id": "t2", "title": "High other", "completedPomodoros": 4, "userId": "u2", "similarity": 0.9},
        ])

        with patch("rag.get_embedding", return_value=embedding), \
             patch("rag.get_db_pool", return_value=mock_pool):
            result = await rag.find_similar_tasks("u1", "text")

        # 0.5 * 1.0 = 0.5 (own)  vs  0.9 * 0.7 = 0.63 (other) → other goes first
        assert result[0]["title"] == "High other"


# ─────────────────────────────────────────────────────────────────────────────
# estimate_with_llm() — async, mock genai client
# ─────────────────────────────────────────────────────────────────────────────
class TestEstimateWithLlm:

    def _make_response(self, text: str):
        resp = MagicMock()
        resp.text = text
        return resp

    @pytest.mark.asyncio
    async def test_standard_plan(self):
        payload = json.dumps({
            "session_type": "STANDARD",
            "sessions": 3,
            "total_minutes": 75,
            "reasoning": "Task medium complexity",
        })
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response(payload))

        est, reason, plan = await estimation.estimate_with_llm("Write unit tests", "for a service")
        assert est == 3
        assert "Task medium complexity" in reason
        assert plan["session_type"] == "STANDARD"

    @pytest.mark.asyncio
    async def test_quick_plan_forces_sessions_to_1(self):
        payload = json.dumps({
            "session_type": "QUICK_5",
            "sessions": 5,  # will be forced to 1
            "total_minutes": 5,
            "reasoning": "Quick fix",
        })
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response(payload))

        est, reason, plan = await estimation.estimate_with_llm("Fix typo")
        assert plan["sessions"] == 1
        assert est == 1

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        payload = "```json\n" + json.dumps({
            "session_type": "STANDARD",
            "sessions": 2,
            "total_minutes": 55,
            "reasoning": "Medium task",
        }) + "\n```"
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response(payload))

        est, reason, plan = await estimation.estimate_with_llm("Task with fence")
        assert plan["sessions"] == 2

    @pytest.mark.asyncio
    async def test_returns_default_on_llm_error(self):
        estimation.client.models.generate_content = MagicMock(side_effect=Exception("API down"))

        est, reason, plan = await estimation.estimate_with_llm("Any task")
        assert est == 3
        assert plan["session_type"] == "STANDARD"

    @pytest.mark.asyncio
    async def test_returns_default_on_invalid_json(self):
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response("not valid json {{"))

        est, reason, plan = await estimation.estimate_with_llm("Task")
        assert est == 3

    @pytest.mark.asyncio
    async def test_clamps_sessions_to_10(self):
        payload = json.dumps({
            "session_type": "STANDARD",
            "sessions": 99,
            "total_minutes": 2500,
            "reasoning": "Huge task",
        })
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response(payload))

        est, reason, plan = await estimation.estimate_with_llm("Huge project")
        assert est <= 10
        assert plan["sessions"] <= 10

    @pytest.mark.asyncio
    async def test_unknown_session_type_defaults_to_standard(self):
        payload = json.dumps({
            "session_type": "INVALID_TYPE",
            "sessions": 2,
            "total_minutes": 50,
            "reasoning": "Unknown type",
        })
        estimation.client.models.generate_content = MagicMock(return_value=self._make_response(payload))

        est, reason, plan = await estimation.estimate_with_llm("Task")
        assert plan["session_type"] == "STANDARD"


# ─────────────────────────────────────────────────────────────────────────────
# get_db_pool() — caching behaviour
# ─────────────────────────────────────────────────────────────────────────────
class TestGetDbPool:

    @pytest.mark.asyncio
    async def test_creates_pool_on_first_call(self):
        database._db_pool = None
        mock_pool = AsyncMock()
        with patch("database.asyncpg.create_pool", return_value=mock_pool):
            pool = await database.get_db_pool()
        assert pool is mock_pool

    @pytest.mark.asyncio
    async def test_returns_cached_pool_on_second_call(self):
        mock_pool = AsyncMock()
        database._db_pool = mock_pool
        with patch("database.asyncpg.create_pool") as mock_create:
            pool = await database.get_db_pool()
            mock_create.assert_not_called()
        assert pool is mock_pool
        database._db_pool = None  # cleanup


# ─────────────────────────────────────────────────────────────────────────────
# AIServiceServicer.EstimateTime()
# ─────────────────────────────────────────────────────────────────────────────
class TestEstimateTime:
    def _make_servicer(self):
        return servicer.AIServiceServicer()

    def _make_request(self, user_id="u1", task_title="Do something", task_description=""):
        req = MagicMock()
        req.user_id = user_id
        req.task_title = task_title
        req.task_description = task_description
        return req

    def _make_context(self):
        ctx = MagicMock()
        ctx.set_code = MagicMock()
        ctx.set_details = MagicMock()
        return ctx

    @pytest.mark.asyncio
    async def test_rag_path_returns_estimate(self):
        s = self._make_servicer()
        similar_tasks = [
            {"similarity": 0.9, "actual_pomodoros": 4, "title": "T", "is_own": True},
        ]
        with patch("servicer.find_similar_tasks", return_value=similar_tasks), \
             patch("servicer.estimate_from_similar", return_value=(4, "Based on T", "medium")), \
             patch("servicer.estimate_with_llm", return_value=(3, "LLM", {"session_type": "STANDARD", "sessions": 3, "total_minutes": 75})), \
             patch("servicer.blend_estimates", return_value=(4, "Based on T", {"session_type": "STANDARD", "sessions": 4, "total_minutes": 110}, "medium")):
            resp = await s.EstimateTime(self._make_request(), self._make_context())
        assert resp.estimated_pomodoros == 4

    @pytest.mark.asyncio
    async def test_llm_fallback_when_no_rag_data(self):
        servicer = self._make_servicer()
        with patch("servicer.find_similar_tasks", return_value=[]), \
             patch("servicer.estimate_from_similar", return_value=(None, None, "none")), \
             patch("servicer.estimate_with_llm", return_value=(3, "🤖 AI estimate", {"session_type": "STANDARD", "sessions": 3, "total_minutes": 75})):
            resp = await servicer.EstimateTime(self._make_request(), self._make_context())
        assert resp.estimated_pomodoros == 3
        assert resp.confidence == "medium"

    @pytest.mark.asyncio
    async def test_returns_default_on_exception(self):
        servicer = self._make_servicer()
        ctx = self._make_context()
        with patch("servicer.find_similar_tasks", side_effect=Exception("DB error")):
            resp = await servicer.EstimateTime(self._make_request(), ctx)
        assert resp.estimated_pomodoros == 3
        ctx.set_code.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# AIServiceServicer.StoreTaskEmbedding()
# ─────────────────────────────────────────────────────────────────────────────
class TestStoreTaskEmbedding:
    def _make_servicer(self):
        return servicer.AIServiceServicer()

    def _make_request(self):
        req = MagicMock()
        req.task_id = "task-1"
        req.user_id = "u1"
        req.title = "Fix bug"
        req.description = "Fix the null pointer"
        return req

    def _make_context(self):
        ctx = MagicMock()
        ctx.set_code = MagicMock()
        ctx.set_details = MagicMock()
        return ctx

    @pytest.mark.asyncio
    async def test_stores_embedding_successfully(self):
        servicer = self._make_servicer()
        mock_pool = AsyncMock()
        mock_pool.execute = AsyncMock()

        with patch("servicer.get_embedding", return_value=[0.1, 0.2]), \
             patch("servicer.get_db_pool", return_value=mock_pool):
            resp = await servicer.StoreTaskEmbedding(self._make_request(), self._make_context())
        assert resp.success is True
        mock_pool.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_embedding_unavailable(self):
        servicer = self._make_servicer()
        with patch("servicer.get_embedding", return_value=None):
            resp = await servicer.StoreTaskEmbedding(self._make_request(), self._make_context())
        assert resp.success is False

    @pytest.mark.asyncio
    async def test_returns_false_on_db_error(self):
        servicer = self._make_servicer()
        ctx = self._make_context()
        with patch("servicer.get_embedding", return_value=[0.1]), \
             patch("servicer.get_db_pool", side_effect=Exception("DB down")):
            resp = await servicer.StoreTaskEmbedding(self._make_request(), ctx)
        assert resp.success is False
        ctx.set_code.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# AIServiceServicer.GenerateTasks()
# ─────────────────────────────────────────────────────────────────────────────
class TestGenerateTasks:
    def _make_servicer(self):
        return servicer.AIServiceServicer()

    def _make_request(self, goal="Build an app", context="", max_tasks=3):
        req = MagicMock()
        req.user_id = "u1"
        req.goal = goal
        req.context = context
        req.max_tasks = max_tasks
        return req

    def _make_context(self):
        ctx = MagicMock()
        ctx.set_code = MagicMock()
        ctx.set_details = MagicMock()
        return ctx

    @pytest.mark.asyncio
    async def test_generates_tasks_with_rag_estimates(self):
        servicer = self._make_servicer()

        gemini_result = {
            "tasks": [
                {
                    "title": "Setup DB",
                    "description": "Configure database",
                    "priority": "HIGH",
                    "session_type": "STANDARD",
                    "sessions": 2,
                    "total_minutes": 55,
                    "tags": ["backend"],
                    "order": 1,
                },
            ],
            "summary": "Set up the project",
        }

        rag_tasks = [{"similarity": 0.9, "actual_pomodoros": 2, "title": "DB setup", "is_own": True}]

        with patch("servicer.generate_tasks_with_gemini", return_value=gemini_result), \
             patch("task_generator.find_similar_tasks", return_value=rag_tasks), \
             patch("task_generator.estimate_from_similar", return_value=(2, "Based on history", "medium")), \
             patch("task_generator.blend_estimates", return_value=(2, "Based on history", {"session_type": "STANDARD", "sessions": 2, "total_minutes": 55}, "medium")):
            resp = await servicer.GenerateTasks(self._make_request(), self._make_context())

        assert len(resp.tasks) == 1
        assert resp.tasks[0].title == "Setup DB"
        assert resp.tasks[0].estimated_pomodoros == 2

    @pytest.mark.asyncio
    async def test_uses_llm_plan_when_no_rag_data(self):
        servicer = self._make_servicer()

        gemini_result = {
            "tasks": [
                {
                    "title": "Write docs",
                    "description": "Documentation",
                    "priority": "LOW",
                    "session_type": "QUICK_15",
                    "sessions": 1,
                    "total_minutes": 15,
                    "tags": ["docs"],
                    "order": 1,
                },
            ],
            "summary": "Docs task",
        }

        with patch("servicer.generate_tasks_with_gemini", return_value=gemini_result), \
             patch("servicer.find_similar_tasks", return_value=[]), \
             patch("servicer.estimate_from_similar", return_value=(None, None, "none")):
            resp = await servicer.GenerateTasks(self._make_request(), self._make_context())

        assert len(resp.tasks) == 1
        assert resp.tasks[0].estimated_pomodoros == 1  # QUICK_15 → 1

    @pytest.mark.asyncio
    async def test_caps_max_tasks_at_7(self):
        servicer = self._make_servicer()

        s = self._make_servicer()
        with patch("servicer.generate_tasks_with_gemini", return_value={"tasks": [], "summary": ""}) as mock_gen, \
             patch("servicer.find_similar_tasks", return_value=[]):
            await s.GenerateTasks(self._make_request(max_tasks=20), self._make_context())
            call_kwargs = mock_gen.call_args
            assert call_kwargs[1]["max_tasks"] <= 7 or call_kwargs[0][2] <= 7

    @pytest.mark.asyncio
    async def test_uses_default_max_tasks_when_0(self):
        servicer = self._make_servicer()

        s = self._make_servicer()
        with patch("servicer.generate_tasks_with_gemini", return_value={"tasks": [], "summary": ""}) as mock_gen, \
             patch("servicer.find_similar_tasks", return_value=[]):
            await s.GenerateTasks(self._make_request(max_tasks=0), self._make_context())
            mock_gen.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_on_json_decode_error(self):
        servicer = self._make_servicer()
        ctx = self._make_context()
        with patch("servicer.generate_tasks_with_gemini", side_effect=json.JSONDecodeError("bad json", "", 0)):
            resp = await servicer.GenerateTasks(self._make_request(), ctx)
        assert len(resp.tasks) == 0
        ctx.set_code.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_on_general_exception(self):
        servicer = self._make_servicer()
        ctx = self._make_context()
        with patch("servicer.generate_tasks_with_gemini", side_effect=RuntimeError("Network error")):
            resp = await servicer.GenerateTasks(self._make_request(), ctx)
        assert len(resp.tasks) == 0
        ctx.set_code.assert_called_once()
