#!/usr/bin/env python
# title             : AdditionalReplays.py
# description       : Adds 3 "additional" ReplayBuffer with UI Sound Settings.
# author            : Bootscreen / Gemini
# version           : 0.4.2 (Audio-Sync Fix)
# ==============================================================================

import obspython as obs
import os, sys, subprocess, time
from time import sleep
from importlib import util
import threading
import winsound 

# Windows-specific flag to prevent CMD windows from popping up
CREATE_NO_WINDOW = 0x08000000

# Safety padding (in seconds) to avoid the un-muxed trailing edge of the master buffer file
TAIL_OFFSET = 1.5

# Global Variables
enabled = True
debug_mode = False
sound_enabled = True
global_sound_path = ""

replay1_hotkey = obs.OBS_INVALID_HOTKEY_ID
replay1_seconds = 5
replay1_dir = ""
replay1_remove = True
replay1_from_end = True
replay1_rev = ""

replay2_hotkey = obs.OBS_INVALID_HOTKEY_ID
replay2_seconds = 10
replay2_dir = ""
replay2_remove = True
replay2_from_end = True
replay2_rev = ""

replay3_hotkey = obs.OBS_INVALID_HOTKEY_ID
replay3_seconds = 15
replay3_dir = ""
replay3_remove = True
replay3_from_end = True
replay3_rev = ""

# Reversed/FFmpeg properties
ending = "_r"
extension = ".mkv"
codec_v = "mpeg2video"
video_q = "-qscale:v"
video_qval = "6"
codec_a = "mp2"
audio_q = "-b:a"
audio_qval = "384k"
rev_vol = "-9dB"

media_source_name = ""
path_list = [None, None]

# "Job is done" hotkey
job_is_done_key = "OBS_KEY_NUM7"
job_is_done_modifires = {"shift": False, "alt": True, "control": True, "command": False}

def play_success_sound():
    """Plays the wav file in a background thread."""
    global sound_enabled, global_sound_path
    if sound_enabled and global_sound_path and os.path.isfile(global_sound_path):
        try:
            winsound.PlaySound(global_sound_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
        except:
            pass

def send_hotkey(hotkey_id_name, key_modifiers):
    shift_mod = key_modifiers["shift"]
    control_mod = key_modifiers["control"]
    alt_mod = key_modifiers["alt"]
    command_mod = key_modifiers["command"]
    modifiers = 0
    if shift_mod: modifiers |= obs.INTERACT_SHIFT_KEY
    if control_mod: modifiers |= obs.INTERACT_CONTROL_KEY
    if alt_mod: modifiers |= obs.INTERACT_ALT_KEY
    if command_mod: modifiers |= obs.INTERACT_COMMAND_KEY
    combo = obs.obs_key_combination()
    combo.modifiers = modifiers
    combo.key = obs.obs_key_from_name(hotkey_id_name)
    obs.obs_hotkey_inject_event(combo, False)
    obs.obs_hotkey_inject_event(combo, True)
    obs.obs_hotkey_inject_event(combo, False)

def ffmpeg_extract_subclip(filename, t1, t2, targetname):
    from moviepy.config import FFMPEG_BINARY
    cmd = [FFMPEG_BINARY, "-y", "-ss", "{:.2f}".format(t1), "-i", filename,
           "-t", "{:.2f}".format(t2 - t1), "-map", "0?", "-codec", "copy", targetname]
    subprocess.run(cmd, check=True, creationflags=CREATE_NO_WINDOW)

def ffmpeg_get_clip_dur(filename):
    from moviepy.video.io.VideoFileClip import VideoFileClip
    clip = VideoFileClip(filename)
    duration = clip.duration
    fps = clip.fps
    try:
        clip.close()
    except:
        if hasattr(clip, 'reader') and clip.reader:
            try: clip.reader.close()
            except: pass
    return duration, fps

def save_and_get_last_replay():
    timestamp = time.time()
    obs.obs_frontend_replay_buffer_save()
    for i in range(20):
        path = get_last_replay()
        if path and os.path.isfile(path):
            if os.path.getmtime(path) >= timestamp:
                return path
        sleep(0.5)
    return None

def get_last_replay():
    replay_buffer = obs.obs_frontend_get_replay_buffer_output()
    if not replay_buffer: return None
    cd = obs.calldata_create()
    ph = obs.obs_output_get_proc_handler(replay_buffer)
    obs.proc_handler_call(ph, "get_last_replay", cd)
    path = obs.calldata_string(cd, "path")
    obs.calldata_destroy(cd)
    obs.obs_output_release(replay_buffer)
    return path

def save_replay1(pressed):
    if pressed and enabled:
        save_replay(replay1_seconds, replay1_dir, replay1_remove, replay1_from_end)

def save_replay2(pressed):
    if pressed and enabled:
        save_replay(replay2_seconds, replay2_dir, replay2_remove, replay2_from_end)

def save_replay3(pressed):
    if pressed and enabled:
        save_replay(replay3_seconds, replay3_dir, replay3_remove, replay3_from_end)

def save_replay(seconds, new_folder, remove, from_end):
    global path_list, media_source_name
    if not obs.obs_frontend_replay_buffer_active(): return

    last_replay = save_and_get_last_replay()
    if not last_replay: return

    last_replay = os.path.abspath(last_replay)
    last_replay_folder = os.path.dirname(last_replay)
    last_replay_name, last_replay_type = os.path.splitext(os.path.basename(last_replay))

    if not new_folder or not os.path.exists(new_folder):
        new_folder = last_replay_folder
    
    trunc_replay = os.path.join(new_folder, f"{last_replay_name}_{seconds}s{last_replay_type}")
    duration, in_fps = ffmpeg_get_clip_dur(last_replay)

    try:
        # Adjust duration mathematically to completely ignore the tail end
        safe_duration = max(0, duration - TAIL_OFFSET)

        if safe_duration > seconds:
            # Shift the window backward from the new 'safe' end of the file
            t_start = safe_duration - seconds if from_end else 0
            ffmpeg_extract_subclip(last_replay, t_start, t_start + seconds, targetname=trunc_replay)
        else:
            # If the safe buffer length is shorter than requested clip size, we slice what we safely can
            if safe_duration > 0:
                t_start = 0
                ffmpeg_extract_subclip(last_replay, t_start, safe_duration, targetname=trunc_replay)
            else:
                if last_replay_folder != new_folder:
                    import shutil
                    shutil.copy2(last_replay, trunc_replay)
                else:
                    trunc_replay = last_replay
        
        # SUCCESS TRIGGER
        threading.Thread(target=play_success_sound, daemon=True).start()
        
    except Exception as e:
        if debug_mode: print(f"[AR] Replay failed: {e}")
        return

    if media_source_name != "":
        files_to_media_source()
    send_hotkey(job_is_done_key, job_is_done_modifires)

    if remove and trunc_replay != last_replay and os.path.exists(last_replay):
        try: os.remove(last_replay)
        except: pass

def script_properties():
    props = obs.obs_properties_create()
    obs.obs_properties_add_bool(props, "enabled", "Enable Script")
    
    # Sound Settings at the top
    obs.obs_properties_add_bool(props, "sound_enabled", "Enable Success Sound")
    obs.obs_properties_add_path(props, "global_sound_path", "Sound File (.wav)", obs.OBS_PATH_FILE, "Sound Files (*.wav)", None)
    
    obs.obs_properties_add_bool(props, "debug_mode", "Debug Mode")

    for i in ["1", "2", "3"]:
        obs.obs_properties_add_int(props, f"replay{i}_seconds", f"Replay {i} (sec)", 1, 900, 1)
        obs.obs_properties_add_path(props, f"replay{i}_dir", f"Save Folder {i}", obs.OBS_PATH_DIRECTORY, "", None)
        obs.obs_properties_add_bool(props, f"replay{i}_remove", "Delete Original Buffer")
        obs.obs_properties_add_bool(props, f"replay{i}_from_end", "Preserve End")
    return props

def script_load(settings):
    global replay1_hotkey, replay2_hotkey, replay3_hotkey
    replay1_hotkey = obs.obs_hotkey_register_frontend("additional_replays.replay1", "Replay 1", save_replay1)
    obs.obs_hotkey_load(replay1_hotkey, obs.obs_data_get_array(settings, "additional_replays.replay1"))
    replay2_hotkey = obs.obs_hotkey_register_frontend("additional_replays.replay2", "Replay 2", save_replay2)
    obs.obs_hotkey_load(replay2_hotkey, obs.obs_data_get_array(settings, "additional_replays.replay2"))
    replay3_hotkey = obs.obs_hotkey_register_frontend("additional_replays.replay3", "Replay 3", save_replay3)
    obs.obs_hotkey_load(replay3_hotkey, obs.obs_data_get_array(settings, "additional_replays.replay3"))

def script_save(settings):
    obs.obs_data_set_array(settings, "additional_replays.replay1", obs.obs_hotkey_save(replay1_hotkey))
    obs.obs_data_set_array(settings, "additional_replays.replay2", obs.obs_hotkey_save(replay2_hotkey))
    obs.obs_data_set_array(settings, "additional_replays.replay3", obs.obs_hotkey_save(replay3_hotkey))

def script_update(settings):
    global enabled, debug_mode, sound_enabled, global_sound_path
    global replay1_seconds, replay1_dir, replay1_remove, replay1_from_end
    global replay2_seconds, replay2_dir, replay2_remove, replay2_from_end
    global replay3_seconds, replay3_dir, replay3_remove, replay3_from_end
    
    enabled = obs.obs_data_get_bool(settings, "enabled")
    debug_mode = obs.obs_data_get_bool(settings, "debug_mode")
    sound_enabled = obs.obs_data_get_bool(settings, "sound_enabled")
    global_sound_path = obs.obs_data_get_string(settings, "global_sound_path")

    for i in ["1", "2", "3"]:
        globals()[f"replay{i}_seconds"] = obs.obs_data_get_int(settings, f"replay{i}_seconds")
        globals()[f"replay{i}_dir"] = obs.obs_data_get_string(settings, f"replay{i}_dir")
        globals()[f"replay{i}_remove"] = obs.obs_data_get_bool(settings, f"replay{i}_remove")
        globals()[f"replay{i}_from_end"] = obs.obs_data_get_bool(settings, f"replay{i}_from_end")