import type { Camera } from "@/lib/sentinel-data";

export const CAMERA_CLIPS: Record<string, string> = {
  "CAM-01": "/cams/cam1-pingpong.mp4",
  "CAM-02": "/cams/cam2-pingpong.mp4",
  "CAM-04": "/cams/cam4-pingpong.mp4",
  "CAM-05": "/cams/cam5-pingpong.mp4",
  "CAM-06": "/cams/cam6-pingpong.mp4",
  "CAM-07": "/cams/cam7-pingpong.mp4",
  "CAM-08": "/cams/cam8-pingpong.mp4",
};

export const DASHBOARD_CAMERAS: Camera[] = [
  { id: "CAM-01", zone: "Hack area" },
  { id: "CAM-02", zone: "Corridor" },
  { id: "CAM-03", zone: "Moving camera" },
  { id: "CAM-04", zone: "Coding area" },
  { id: "CAM-05", zone: "Elevator" },
  { id: "CAM-06", zone: "Fun zone" },
  { id: "CAM-07", zone: "Kitchen" },
  { id: "CAM-08", zone: "Stage" },
];

export const CAMERA_WALL_ORDER = [
  "CAM-01",
  "CAM-02",
  "CAM-03",
  "CAM-04",
  "CAM-05",
  "CAM-06",
  "CAM-07",
  "CAM-08",
];
