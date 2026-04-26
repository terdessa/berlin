"""
Manual room-dispatch tool.

Usage:
    python -m src.dispatch_agent              # dispatch (idempotent — skips if active dispatch exists)
    python -m src.dispatch_agent --reset      # delete all active dispatches + remove agent-* participants, then dispatch one
    python -m src.dispatch_agent --status     # print active dispatches and participants, then exit

The Sentinel agent self-dispatches on startup, so this script is only needed if
that path failed or you want to clean up stale dispatches from earlier sessions.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from livekit import api


load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


# Must match the agent_name set on WorkerOptions in agent.py — a dispatch is
# only routed to a worker that registered with the same name.
AGENT_NAME = "sentinel"


async def _status(lk: api.LiveKitAPI, room: str) -> None:
    dispatches = await lk.agent_dispatch.list_dispatch(room_name=room)
    print(f"active dispatches in {room}: {len(dispatches)}")
    for d in dispatches:
        print(f"  id={d.id} agent_name={d.agent_name!r}")
    participants = await lk.room.list_participants(api.ListParticipantsRequest(room=room))
    print(f"participants in {room}: {len(participants.participants)}")
    for p in participants.participants:
        print(f"  identity={p.identity!r} kind={p.kind}")


async def _reset(lk: api.LiveKitAPI, room: str) -> None:
    dispatches = await lk.agent_dispatch.list_dispatch(room_name=room)
    for d in dispatches:
        await lk.agent_dispatch.delete_dispatch(d.id, room)
        print(f"deleted dispatch {d.id}")
    participants = await lk.room.list_participants(api.ListParticipantsRequest(room=room))
    for p in participants.participants:
        if p.identity.startswith("agent-"):
            await lk.room.remove_participant(
                api.RoomParticipantIdentity(room=room, identity=p.identity)
            )
            print(f"removed participant {p.identity}")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete existing dispatches and agent-* participants first")
    parser.add_argument("--status", action="store_true", help="print room state and exit")
    args = parser.parse_args()

    room = os.getenv("LIVEKIT_ROOM", "sentinel-live")
    lk = api.LiveKitAPI(
        os.environ["LIVEKIT_URL"],
        os.environ["LIVEKIT_API_KEY"],
        os.environ["LIVEKIT_API_SECRET"],
    )
    try:
        if args.status:
            await _status(lk, room)
            return

        if args.reset:
            await _reset(lk, room)

        existing = await lk.agent_dispatch.list_dispatch(room_name=room)
        # Drop dispatches that don't match our agent_name — they won't route to
        # the running worker and would just block us from creating a fresh one.
        stale = [d for d in existing if d.agent_name != AGENT_NAME]
        for d in stale:
            await lk.agent_dispatch.delete_dispatch(d.id, room)
            print(f"deleted stale dispatch {d.id} (agent_name={d.agent_name!r})")

        already_mine = [d for d in existing if d.agent_name == AGENT_NAME]
        if already_mine and not args.reset:
            print(
                f"room={room} already has {len(already_mine)} active dispatch(es) "
                f"for agent_name={AGENT_NAME!r}; not creating another"
            )
            for d in already_mine:
                print(f"  id={d.id}")
            return

        dispatch = await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(room=room, agent_name=AGENT_NAME)
        )
        print(f"dispatched agent to room={room}: {dispatch.id} agent_name={AGENT_NAME!r}")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
