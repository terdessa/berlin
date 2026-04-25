import { useEffect, useRef, useState } from "react";
import type { RemoteVideoTrack, Room } from "livekit-client";
import { issueLivekitToken } from "./livekit-token";

export type LiveFeed = {
  /** LiveKit participant identity (e.g. "phone-android-a1b2c3") */
  identity: string;
  /** Track SID — stable unique ID for the track */
  sid: string;
  track: RemoteVideoTrack;
};

/**
 * Connects to a LiveKit room as a viewer (no publish) and returns an ordered
 * list of remote video tracks, one entry per connected publisher.
 *
 * - Returns [] immediately (safe for SSR / before mount).
 * - Gracefully returns [] when LiveKit is not configured.
 * - Tracks preserve insertion order so the first publisher stays in slot 0.
 */
export function useLivekitFeeds(room: string): LiveFeed[] {
  const [feeds, setFeeds] = useState<LiveFeed[]>([]);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const identity = `dashboard-${Math.random().toString(36).slice(2, 8)}`;
      const tokenResult = await issueLivekitToken({
        data: { room, identity, viewerOnly: true },
      });
      if (cancelled || !tokenResult.ok) return;

      const livekit = await import("livekit-client");
      if (cancelled) return;

      const lkRoom = new livekit.Room({ adaptiveStream: true, dynacast: false });
      roomRef.current = lkRoom;

      const addFeed = (track: RemoteVideoTrack, participantIdentity: string) => {
        const sid = track.sid ?? `${participantIdentity}-video`;
        setFeeds((prev) => {
          if (prev.some((f) => f.sid === sid)) return prev;
          return [...prev, { identity: participantIdentity, sid, track }];
        });
      };

      lkRoom
        .on(livekit.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind !== livekit.Track.Kind.Video) return;
          addFeed(track as RemoteVideoTrack, participant.identity);
        })
        .on(livekit.RoomEvent.TrackUnsubscribed, (track) => {
          const sid = track.sid;
          if (sid) setFeeds((prev) => prev.filter((f) => f.sid !== sid));
        })
        .on(livekit.RoomEvent.ParticipantDisconnected, (participant) => {
          setFeeds((prev) => prev.filter((f) => f.identity !== participant.identity));
        })
        .on(livekit.RoomEvent.Disconnected, () => {
          setFeeds([]);
        });

      try {
        await lkRoom.connect(tokenResult.url, tokenResult.token);

        // Pick up tracks that were already published before we joined.
        for (const participant of lkRoom.remoteParticipants.values()) {
          for (const pub of participant.trackPublications.values()) {
            if (
              pub.isSubscribed &&
              pub.track &&
              pub.kind === livekit.Track.Kind.Video
            ) {
              addFeed(pub.track as RemoteVideoTrack, participant.identity);
            }
          }
        }
      } catch {
        // LiveKit unavailable — stay silent, tiles keep their placeholders.
      }
    })();

    return () => {
      cancelled = true;
      try {
        roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
    };
  // room is stable for the lifetime of the dashboard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return feeds;
}
