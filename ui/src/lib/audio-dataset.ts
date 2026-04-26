export type DatasetCondition = "clean" | "noisy";

export type DatasetClip = {
  id: string;
  condition: DatasetCondition;
  command: string;
  take: string;
  url: string;
};

const CLEAN_FILES = [
  "clean__call_for_backup__take01.wav",
  "clean__create_report__take01.wav",
  "clean__flag_this_as_suspicious__take01.wav",
  "clean__follow_that_person__take01.wav",
  "clean__mark_false_alarm__take01.wav",
  "clean__open_aisle_five__take01.wav",
  "clean__open_camera_five__take01.wav",
  "clean__pause_the_video__take01.wav",
  "clean__replay_last_ten_seconds__take01.wav",
  "clean__resume_playback__take01.wav",
  "clean__send_floor_associate__take01.wav",
  "clean__show_previous_alert__take01.wav",
  "clean__switch_to_camera_two__take01.wav",
  "clean__watch_live__take01.wav",
  "clean__what_happened_there__take01.wav",
  "clean__zoom_in_on_that_area__take01.wav",
];

const NOISY_FILES = [
  "noisy__call_for_backup__take01.wav",
  "noisy__call_for_backup__take02.wav",
  "noisy__create_report__take01.wav",
  "noisy__create_report__take02.wav",
  "noisy__flag_this_as_suspicious__take01.wav",
  "noisy__flag_this_as_suspicious__take02.wav",
  "noisy__follow_that_person__take01.wav",
  "noisy__follow_that_person__take02.wav",
  "noisy__mark_false_alarm__take01.wav",
  "noisy__mark_false_alarm__take02.wav",
  "noisy__open_aisle_five__take01.wav",
  "noisy__open_aisle_five__take02.wav",
  "noisy__open_camera_five__take01.wav",
  "noisy__open_camera_three__take01.wav",
  "noisy__pause_the_video__take01.wav",
  "noisy__pause_the_video__take02.wav",
  "noisy__replay_last_ten_seconds__take01.wav",
  "noisy__replay_last_ten_seconds__take02.wav",
  "noisy__resume_playback__take01.wav",
  "noisy__resume_playback__take02.wav",
  "noisy__send_floor_associate__take01.wav",
  "noisy__send_floor_associate__take02.wav",
  "noisy__show_previous_alert__take01.wav",
  "noisy__show_previous_alert__take02.wav",
  "noisy__switch_to_camera_two__take01.wav",
  "noisy__switch_to_camera_two__take02.wav",
  "noisy__watch_live__take01.wav",
  "noisy__watch_live__take02.wav",
  "noisy__what_happened_there__take01.wav",
  "noisy__what_happened_there__take02.wav",
  "noisy__zoom_in_on_that_area__take01.wav",
  "noisy__zoom_in_on_that_area__take02.wav",
];

function parseFilename(name: string, condition: DatasetCondition): DatasetClip {
  const stem = name.replace(/\.wav$/i, "");
  const parts = stem.split("__");
  const command = (parts[1] ?? "unknown").replace(/_/g, " ");
  const take = parts[2] ?? "take01";
  return {
    id: stem,
    condition,
    command,
    take,
    url: `/audio/${condition}/${name}`,
  };
}

export const datasetClips: DatasetClip[] = [
  ...CLEAN_FILES.map((f) => parseFilename(f, "clean")),
  ...NOISY_FILES.map((f) => parseFilename(f, "noisy")),
];
