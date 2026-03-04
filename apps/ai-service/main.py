"""
AI Task Service -- gRPC server entry point.

Module layout:
  config.py         -- env vars, logger, Gemini client singleton
  database.py       -- asyncpg pool, get_embedding()
  rag.py            -- find_similar_tasks(), estimate_from_similar()
  estimation.py     -- blend_estimates(), estimate_with_llm(),
                       build_focus_plan(), make_focus_plan_proto()
  task_generator.py -- TASK_BREAKDOWN_PROMPT, generate_tasks_with_gemini(),
                       build_generated_tasks()
  servicer.py       -- AIServiceServicer (gRPC handlers)
  main.py           -- serve() bootstrap (this file)
"""

import asyncio
from concurrent import futures

from grpc import aio as grpc_aio
import ai_service_pb2_grpc

from config import HOST, PORT, logger
from database import get_db_pool
from servicer import AIServiceServicer


async def serve() -> None:
    server = grpc_aio.server(futures.ThreadPoolExecutor(max_workers=10))
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(AIServiceServicer(), server)
    listen_addr = f"{HOST}:{PORT}"
    server.add_insecure_port(listen_addr)
    await server.start()
    logger.info(f"AI Service gRPC server listening on {listen_addr}")

    # Eagerly initialise DB pool so the first request is fast
    try:
        await get_db_pool()
    except Exception as e:
        logger.warning(f"DB pool init deferred: {e}")

    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
