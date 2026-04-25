from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from livekit import api


load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


async def main() -> None:
    room = os.getenv("LIVEKIT_ROOM", "sentinel-live")
    lk = api.LiveKitAPI(
        os.environ["LIVEKIT_URL"],
        os.environ["LIVEKIT_API_KEY"],
        os.environ["LIVEKIT_API_SECRET"],
    )
    try:
        dispatch = await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(room=room)
        )
        print(f"dispatched agent to room={room}: {dispatch.id}")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
