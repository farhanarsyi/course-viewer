"""
download_videos.py — Download course videos from video_links.json

Features:
  - Resume support (log-based, lanjut dari terakhir)
  - Overall progress bar
  - Per-video progress bar + file size (MB)
  - Picks highest available quality per lesson
  - Folder structure: downloaded_videos/Course/Module/Lesson.mp4

Usage:
  pip install tqdm   (opsional, untuk progress bar lebih bagus)
  python download_videos.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
JSON_FILE = SCRIPT_DIR / "video_links.json"
OUTPUT_DIR = SCRIPT_DIR / "downloaded_videos"
LOG_FILE = SCRIPT_DIR / "download_log.json"
FFMPEG_TIMEOUT = 1800  # 30 menit per video

# ── tqdm (opsional) ───────────────────────────────────────────────────
try:
    from tqdm import tqdm

    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


class SimpleBar:
    """Fallback progress bar jika tqdm tidak terinstall."""

    def __init__(self, total=0, desc="", unit="", leave=True, position=0, **kw):
        self.total = total
        self.n = 0.0
        self.desc = desc
        self.unit = unit
        self.leave = leave
        self.postfix = ""
        self._closed = False

    def update(self, n=1):
        self.n += n
        self._draw()

    def set_postfix_str(self, s):
        self.postfix = s

    def set_description(self, s):
        self.desc = s

    def refresh(self):
        self._draw()

    def _draw(self):
        if self._closed:
            return
        if self.total > 0:
            pct = self.n / self.total * 100
            bar_len = 25
            filled = int(bar_len * min(self.n / self.total, 1.0))
            bar = "█" * filled + "░" * (bar_len - filled)
            line = (
                f"\r  {self.desc} {bar} "
                f"{self.n:.0f}/{self.total:.0f}{self.unit} ({pct:.1f}%)"
            )
        else:
            line = f"\r  {self.desc} {self.n:.0f}{self.unit}"
        if self.postfix:
            line += f" | {self.postfix}"
        print(line, end="", flush=True)

    def close(self):
        if not self._closed:
            self._closed = True
            if self.leave:
                print()
            else:
                print("\r" + " " * 120 + "\r", end="", flush=True)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def make_bar(*args, **kwargs):
    """Create progress bar (tqdm if available, else SimpleBar)."""
    if HAS_TQDM:
        return tqdm(*args, **kwargs)
    return SimpleBar(*args, **kwargs)


# ── Resume Log ─────────────────────────────────────────────────────────
def load_log() -> dict:
    """Load download log for resume support."""
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "completed" in data:
                    return data
        except (json.JSONDecodeError, TypeError):
            pass
    return {
        "completed": [],
        "failed": [],
        "stats": {"total_mb": 0.0, "started": None},
    }


def save_log(log: dict):
    """Save download log to file."""
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)


# ── Helpers ────────────────────────────────────────────────────────────
def sanitize(name: str) -> str:
    """Remove invalid filename characters."""
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:150] if len(name) > 150 else name


def pick_best_url(urls: list[str]) -> str | None:
    """Return URL with the highest resolution."""
    if not urls:
        return None
    best, best_score = urls[0], 0
    for url in urls:
        m = re.search(r"/(\d+)p/", url)
        if m:
            q = int(m.group(1))
            if q > best_score:
                best_score, best = q, url
        elif best_score == 0:
            best = url
    return best


def quality_label(url: str) -> str:
    """Extract quality label from URL, e.g. '1080p'."""
    m = re.search(r"/(\d+)p/", url)
    return f"{m.group(1)}p" if m else "unknown"


def format_size(mb: float) -> str:
    """Format MB to human-readable string."""
    if mb >= 1024:
        return f"{mb / 1024:.2f} GB"
    return f"{mb:.1f} MB"


def get_file_size_mb(filepath: str) -> float:
    """Get file size in MB."""
    try:
        return os.path.getsize(filepath) / (1024 * 1024)
    except OSError:
        return 0.0


# ── ffmpeg ─────────────────────────────────────────────────────────────
def get_duration(url: str) -> float:
    """Get video duration in seconds via ffprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        url,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(r.stdout.strip())
    except Exception:
        return 0.0


def drain_stream(stream):
    """Read and discard stream to prevent subprocess buffer deadlock."""
    for _ in stream:
        pass


def download_video(url: str, output_path: str) -> tuple[bool, float]:
    """
    Download HLS stream → MP4 with real-time progress.
    Returns (success, file_size_mb).
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    duration = get_duration(url)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        url,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        output_path,
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Drain stderr in background to prevent buffer deadlock
    stderr_thread = threading.Thread(target=drain_stream, args=(process.stderr,))
    stderr_thread.daemon = True
    stderr_thread.start()

    # Per-video progress bar
    pbar = make_bar(
        total=duration if duration > 0 else 0,
        desc="    ▸ Progress",
        unit="s",
        leave=False,
        position=1,
    )

    current_data: dict[str, str] = {}
    last_size_mb = 0.0

    try:
        for raw_line in iter(process.stdout.readline, b""):
            line = raw_line.decode("utf-8", errors="replace").strip()
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            current_data[key.strip()] = val.strip()

            # Only update on block boundaries
            if current_data.get("progress") not in ("continue", "end"):
                continue

            out_ms = int(current_data.get("out_time_ms", 0))
            cur_sec = out_ms / 1_000_000
            total_bytes = int(current_data.get("total_size", 0))
            last_size_mb = total_bytes / 1_048_576

            if duration > 0:
                pbar.n = min(cur_sec, duration)
            else:
                pbar.n = cur_sec

            pbar.set_postfix_str(format_size(last_size_mb))
            pbar.refresh()
            current_data = {}

    except Exception:
        pass

    pbar.close()
    process.wait()
    stderr_thread.join(timeout=5)

    # Final file size
    if os.path.exists(output_path):
        last_size_mb = os.path.getsize(output_path) / 1_048_576

    success = process.returncode == 0
    if not success and os.path.exists(output_path):
        os.remove(output_path)

    return success, last_size_mb


# ── Task Collection (new flat-list format) ─────────────────────────────
def collect_tasks(entries: list[dict]) -> list[dict]:
    """
    Flatten the JSON array into a list of download tasks.
    Each entry has: course, module, lesson, urls
    """
    tasks = []

    for entry in entries:
        course = sanitize(entry.get("course", "Unknown"))
        module = sanitize(entry.get("module", "Unknown"))
        lesson = sanitize(entry.get("lesson", "Unknown"))
        urls = entry.get("urls", [])

        url = pick_best_url(urls)
        if not url:
            continue

        ql = quality_label(url)

        # Folder: downloaded_videos/Course/Module/
        # File:   Lesson (1080p).mp4
        folder = os.path.join(OUTPUT_DIR, course, module)
        filename = f"{lesson} ({ql}).mp4"
        output_path = os.path.join(folder, filename)

        # Display path for progress
        display = f"{course} > {module} > {lesson}"

        tasks.append(
            {
                "display": display,
                "url": url,
                "output": output_path,
                "quality": ql,
                "filename": filename,
            }
        )

    return tasks


# ── Main ───────────────────────────────────────────────────────────────
def main():
    print("=" * 64)
    print("  Video Downloader — HLS → MP4 (ffmpeg)")
    print("  Resume | Overall progress | Per-video progress + size")
    print("=" * 64)

    if not HAS_TQDM:
        print("  [i] tqdm not installed — using basic progress display")
        print("      Install for better bars: pip install tqdm\n")

    if not JSON_FILE.exists():
        print(f"\n  [ERROR] '{JSON_FILE}' not found.")
        sys.exit(1)

    # Load JSON
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Support both new flat-list format and old nested dict format
    if isinstance(raw, list):
        entries = raw
    elif isinstance(raw, dict):
        # Old format — convert to flat list
        entries = _flatten_old_format(raw)
    else:
        print("  [ERROR] Invalid JSON format.")
        sys.exit(1)

    # Load resume log
    log = load_log()
    completed_set = set(log["completed"])

    if not log["stats"]["started"]:
        log["stats"]["started"] = datetime.now().isoformat()

    # Collect all tasks
    all_tasks = collect_tasks(entries)
    total_videos = len(all_tasks)

    # Filter out already completed
    pending = [t for t in all_tasks if t["output"] not in completed_set]

    print(f"\n  Total videos   : {total_videos}")
    print(f"  Already done   : {len(completed_set)}")
    print(f"  To download    : {len(pending)}")

    if not pending:
        print("\n  ✓ All videos already downloaded!")
        print(f"    Output: {OUTPUT_DIR}")
        return

    stats = {
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "total_mb": log["stats"]["total_mb"],
    }

    overall = make_bar(
        total=len(pending),
        desc="  Overall",
        unit=" vid",
        position=0,
    )

    try:
        for i, task in enumerate(pending, 1):
            display = task["display"]
            url = task["url"]
            output_path = task["output"]
            ql = task["quality"]

            overall.set_description(f"  [{i}/{len(pending)}]")
            overall.refresh()

            print(f"\n  [{i}/{len(pending)}] {display} [{ql}]")

            ok, size_mb = download_video(url, output_path)

            if ok:
                stats["success"] += 1
                stats["total_mb"] += size_mb
                log["completed"].append(output_path)
                log["stats"]["total_mb"] = stats["total_mb"]
                save_log(log)
                completed_set.add(output_path)
                print(f"    ✓ Done — {format_size(size_mb)}")
            else:
                stats["failed"] += 1
                if output_path not in log["failed"]:
                    log["failed"].append(output_path)
                save_log(log)
                print(f"    ✗ Failed")

            overall.update(1)

    except KeyboardInterrupt:
        stats["skipped"] = len(pending) - stats["success"] - stats["failed"]
        save_log(log)
        print(f"\n\n  [!] Interrupted — progress saved to {LOG_FILE.name}")

    overall.close()

    # Summary
    log["stats"]["completed"] = datetime.now().isoformat()
    save_log(log)

    print()
    print("=" * 64)
    print(f"  ✓ Success      : {stats['success']}")
    print(f"  ✗ Failed       : {stats['failed']}")
    if stats["skipped"]:
        print(f"  ⏭ Skipped      : {stats['skipped']} (interrupted)")
    print(f"  ↓ Downloaded   : {format_size(stats['total_mb'])}")
    print(f"  📁 Output      : {OUTPUT_DIR}")
    print(f"  📋 Log         : {LOG_FILE.name}")
    print("=" * 64)
    print("  Jalankan lagi kapan saja untuk melanjutkan download.")
    print()


# ── Old format support ─────────────────────────────────────────────────
def _flatten_old_format(data: dict, path_parts: list[str] | None = None) -> list[dict]:
    """Convert old nested dict format to flat list of entries."""
    if path_parts is None:
        path_parts = []
    entries = []

    for key, value in data.items():
        if isinstance(value, dict):
            entries.extend(_flatten_old_format(value, path_parts + [key]))
        elif isinstance(value, list) and value:
            course = path_parts[0] if len(path_parts) > 0 else "Unknown"
            module = path_parts[1] if len(path_parts) > 1 else "Unknown"
            lesson = key
            entries.append(
                {
                    "course": course,
                    "module": module,
                    "lesson": lesson,
                    "urls": value,
                }
            )

    return entries


if __name__ == "__main__":
    main()
