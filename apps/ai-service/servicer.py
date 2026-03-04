import asyncio

import grpc
import ai_service_pb2
import ai_service_pb2_grpc

from config import logger
from database import get_embedding, get_db_pool
from rag import find_similar_tasks, estimate_from_similar
from estimation import estimate_with_llm, blend_estimates, make_focus_plan_proto
from task_generator import generate_tasks_with_gemini, build_generated_tasks


class AIServiceServicer(ai_service_pb2_grpc.AIServiceServicer):

    async def GenerateTasks(self, request, context):
        """Generate tasks from goal + estimate pomodoros via RAG (with LLM fallback)."""
        logger.info(f"📋 GenerateTasks: user={request.user_id}, goal='{request.goal[:50]}...'")

        max_tasks = max(1, min(request.max_tasks if request.max_tasks > 0 else 5, 7))

        try:
            result = await generate_tasks_with_gemini(
                goal=request.goal,
                context=request.context,
                max_tasks=max_tasks,
            )

            generated_tasks = await build_generated_tasks(
                user_id=request.user_id,
                raw_tasks=result.get("tasks", []),
                proto_module=ai_service_pb2,
                make_focus_plan_proto_fn=make_focus_plan_proto,
            )

            return ai_service_pb2.GenerateTasksResponse(
                tasks=generated_tasks,
                summary=result.get("summary", ""),
            )

        except Exception as e:
            logger.error(f"❌ GenerateTasks error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.GenerateTasksResponse()

    async def EstimateTime(self, request, context):
        """Estimate pomodoros for a single task via RAG + LLM blending."""
        logger.info(f"⏱️ EstimateTime: user={request.user_id}, title='{request.task_title[:50]}'")

        try:
            text = f"{request.task_title} {request.task_description or ''}"

            # Run RAG + LLM in parallel for best results
            rag_task = find_similar_tasks(request.user_id, text)
            llm_task = estimate_with_llm(request.task_title, request.task_description or "")
            similar, (llm_estimate, llm_reasoning, llm_plan) = await asyncio.gather(
                rag_task, llm_task
            )

            rag_avg, rag_reasoning, rag_confidence = estimate_from_similar(similar)

            logger.info(
                f"  RAG: avg={rag_avg}, confidence={rag_confidence} | "
                f"LLM: {llm_estimate} pomos, plan={llm_plan['session_type']}"
            )

            final_estimate, final_reasoning, final_plan, confidence_label = blend_estimates(
                rag_avg, rag_confidence, llm_estimate, llm_plan,
                rag_reasoning, llm_reasoning,
            )

            # Only surface the requester's own similar tasks (privacy)
            relevant = [t for t in similar if t["similarity"] > 0.50]
            own_similar = [t for t in relevant if t.get("is_own", True)]
            similar_task_protos = [
                ai_service_pb2.SimilarTask(
                    title=t["title"],
                    actual_pomodoros=t["actual_pomodoros"],
                    similarity=t["similarity"],
                )
                for t in own_similar[:3]
            ]

            return ai_service_pb2.EstimateTimeResponse(
                estimated_pomodoros=final_estimate,
                reasoning=final_reasoning,
                similar_tasks=similar_task_protos,
                confidence=confidence_label,
                focus_plan=make_focus_plan_proto(final_plan),
            )

        except Exception as e:
            logger.error(f"❌ EstimateTime error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.EstimateTimeResponse(
                estimated_pomodoros=3,
                reasoning="Lỗi khi ước lượng — sử dụng giá trị mặc định.",
                confidence="low",
            )

    async def StoreTaskEmbedding(self, request, context):
        """Generate and store embedding for a task."""
        logger.info(f"💾 StoreTaskEmbedding: task={request.task_id}")

        try:
            text = f"{request.title} {request.description or ''}"
            embedding = await get_embedding(text)

            if embedding is None:
                logger.warning(
                    f"⚠️ Skipping embedding storage for task {request.task_id} — embedding unavailable"
                )
                return ai_service_pb2.StoreTaskEmbeddingResponse(success=False)

            pool = await get_db_pool()
            vector_str = "[" + ",".join(str(v) for v in embedding) + "]"

            await pool.execute(
                'UPDATE tasks SET embedding = $1::vector WHERE id = $2 AND "userId" = $3',
                vector_str,
                request.task_id,
                request.user_id,
            )

            logger.info(f"✅ Stored embedding for task {request.task_id}")
            return ai_service_pb2.StoreTaskEmbeddingResponse(success=True)

        except Exception as e:
            logger.error(f"❌ StoreTaskEmbedding error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.StoreTaskEmbeddingResponse(success=False)
