"""
download_videos.py — Download course videos from video_links.json
Features:
  - Resume support (log-based, lanjut dari terakhir)
  - Overall progress bar
  - Per-video progress bar + file size (MB)
  - Picks highest available quality per lesson
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

    def refresh(self):
        self._draw()

    def _draw(self):
        if self._closed:
            return
        if self.total > 0:
            pct = self.n / self.total * 100
            bar_len = 25
            filled = int(bar_len * self.n / self.total)
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
                print("\r" + " " * 100 + "\r", end="", flush=True)

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
def load_completed() -> set[str]:
    """Load set of already-downloaded file paths from log."""
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data) if isinstance(data, list) else set()
        except (json.JSONDecodeError, TypeError):
            pass
    return set()


def save_completed(completed: set[str]):
    """Save completed download paths to log file."""
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(completed), f, indent=2, ensure_ascii=False)


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
        desc="  ▸ Progress",
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


# ── Task Collection ────────────────────────────────────────────────────
def collect_tasks(
    data: dict, path_parts: list[str] | None = None
) -> list[tuple[str, str, str, str]]:
    """
    Flatten the nested JSON into a list of tasks.
    Each task: (display_name, url, output_path, quality_label)
    """
    if path_parts is None:
        path_parts = []
    tasks: list[tuple[str, str, str, str]] = []

    for key, value in data.items():
        safe = sanitize(key)
        if isinstance(value, dict):
            tasks.extend(collect_tasks(value, path_parts + [safe]))
        elif isinstance(value, list):
            url = pick_best_url(value)
            if url:
                ql = quality_label(url)
                folder = os.path.join(OUTPUT_DIR, *path_parts)
                filename = f"{safe} ({ql}).mp4"
                output_path = os.path.join(folder, filename)
                display = os.path.join(*path_parts, safe) if path_parts else safe
                tasks.append((display, url, output_path, ql))

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

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Collect & filter
    all_tasks = collect_tasks(data)
    completed = load_completed()
    pending = [
        t
        for t in all_tasks
        if t[2] not in completed  # t[2] = output_path
    ]

    print(f"\n  Total videos   : {len(all_tasks)}")
    print(f"  Already done   : {len(completed)}")
    print(f"  To download    : {len(pending)}")

    if not pending:
        print("\n  ✓ All videos already downloaded!")
        print(f"    Output: {OUTPUT_DIR}")
        return

    stats = {"success": 0, "failed": 0, "total_mb": 0.0}
    skipped_on_interrupt = 0

    overall = make_bar(
        total=len(pending),
        desc="  Overall",
        unit=" vid",
        position=0,
    )

    try:
        for i, (display, url, output_path, ql) in enumerate(pending, 1):
            overall.set_postfix_str(display[:55])
            overall.refresh()

            print(f"\n  [{i}/{len(pending)}] {display} [{ql}]")

            ok, size_mb = download_video(url, output_path)

            if ok:
                stats["success"] += 1
                stats["total_mb"] += size_mb
                completed.add(output_path)
                save_completed(completed)
                print(f"  ✓ Done — {format_size(size_mb)}")
            else:
                stats["failed"] += 1
                print(f"  ✗ Failed")

            overall.update(1)

    except KeyboardInterrupt:
        skipped_on_interrupt = len(pending) - stats["success"] - stats["failed"]
        save_completed(completed)
        print(f"\n\n  [!] Interrupted — progress saved to {LOG_FILE.name}")

    overall.close()

    # Summary
    print()
    print("=" * 64)
    print(f"  ✓ Success      : {stats['success']}")
    print(f"  ✗ Failed       : {stats['failed']}")
    if skipped_on_interrupt:
        print(f"  ⏭ Skipped      : {skipped_on_interrupt} (interrupted)")
    print(f"  ↓ Downloaded   : {format_size(stats['total_mb'])}")
    print(f"  📁 Output      : {OUTPUT_DIR}")
    print(f"  📋 Log         : {LOG_FILE.name}")
    print("=" * 64)
    print("  Jalankan lagi kapan saja untuk melanjutkan download.")
    print()


if __name__ == "__main__":
    main()
