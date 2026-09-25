#!/usr/bin/env python3
"""下載 Kenney 的 CC0 音效包、挑出要用的檔案，再合成幾個找不到的聲音，全部轉成 mp3 放到 public/sfx/。

用法：python3 scripts/fetch_sfx.py          （只用標準函式庫 + ffmpeg）
      python3 scripts/fetch_sfx.py --cache DIR   （zip 下載到哪裡，預設系統暫存）

輸出：
  public/sfx/<name>_<n>.mp3
  public/sfx/manifest.json   { name: { files: [...], volume } }
  public/sfx/CREDITS.txt
"""
import argparse
import array
import io
import json
import math
import pathlib
import random
import subprocess
import tempfile
import urllib.request
import wave
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "sfx"

PACKS = {
    "rpg": "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
    "interface": "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
    "impact": "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
}

# 名稱 → (包, [檔名], 預設音量)
PICKS = {
    "door_open": ("rpg", ["doorOpen_1.ogg", "doorOpen_2.ogg"], 0.8),
    "door_close": ("rpg", ["doorClose_1.ogg", "doorClose_2.ogg", "doorClose_4.ogg"], 0.8),
    "cloth": ("rpg", ["cloth1.ogg", "cloth2.ogg", "cloth3.ogg", "cloth4.ogg"], 0.9),
    "creak": ("rpg", ["creak1.ogg", "creak2.ogg", "creak3.ogg"], 0.6),
    "pot": ("rpg", ["metalPot1.ogg", "metalPot2.ogg", "metalPot3.ogg"], 0.6),
    "switch": ("rpg", ["metalClick.ogg"], 0.7),
    "footstep_wood": ("impact", [f"footstep_wood_00{i}.ogg" for i in range(5)], 0.5),
    "footstep_stone": ("impact", [f"footstep_concrete_00{i}.ogg" for i in range(5)], 0.5),
    "footstep_grass": ("impact", [f"footstep_grass_00{i}.ogg" for i in range(5)], 0.5),
    "knock": ("impact", ["impactWood_light_000.ogg", "impactWood_light_002.ogg"], 0.7),
    "ui_select": ("interface", ["select_001.ogg", "select_002.ogg"], 0.5),
    "ui_confirm": ("interface", ["confirmation_001.ogg"], 0.6),
    "ui_cancel": ("interface", ["back_001.ogg"], 0.5),
    "dialogue_next": ("interface", ["click_002.ogg"], 0.45),
    "pickup": ("interface", ["pluck_001.ogg", "pluck_002.ogg"], 0.6),
}

SR = 44100


def ffmpeg(*args: str) -> str:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-v", "info", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-1200:])
    return r.stderr


def peak_db(src: pathlib.Path) -> float:
    log = ffmpeg("-i", str(src), "-af", "volumedetect", "-f", "null", "-")
    for line in log.splitlines():
        if "max_volume" in line:
            return float(line.split(":")[1].strip().split()[0])
    return 0.0


def to_mp3(src: pathlib.Path, dest: pathlib.Path, pre: str = "") -> None:
    """轉 mp3、單聲道，峰值拉到 -1 dBFS（短音效用響度標準化不準，用峰值比較穩）。"""
    gain = -1.0 - peak_db(src)
    af = (pre + "," if pre else "") + f"volume={gain:.2f}dB"
    ffmpeg("-y", "-i", str(src), "-af", af, "-ac", "1", "-ar", str(SR), "-c:a", "libmp3lame", "-b:a", "80k", str(dest))


# ---------------------------------------------------------------------------
# 合成：純 Python 寫 WAV
# ---------------------------------------------------------------------------


def write_wav(path: pathlib.Path, samples: list[float]) -> None:
    peak = max(1e-9, max(abs(s) for s in samples))
    data = array.array("h", (int(max(-1, min(1, s / peak * 0.95)) * 32767) for s in samples))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def bell(dur: float, f0: float, partials: list[tuple[float, float, float]], strike: float = 0.0, seed: int = 1) -> list[float]:
    """partials：(頻率倍數, 振幅, 衰減秒數)。每個分音加一個微微走音的副本產生拍頻。"""
    rnd = random.Random(seed)
    n = int(dur * SR)
    out = [0.0] * n
    for ratio, amp, decay in partials:
        f = f0 * ratio
        f2 = f * (1 + rnd.uniform(0.0006, 0.0018))
        ph1, ph2 = rnd.random() * 6.28, rnd.random() * 6.28
        w1, w2 = 2 * math.pi * f / SR, 2 * math.pi * f2 / SR
        k = -1 / (decay * SR)
        for i in range(n):
            env = math.exp(i * k)
            if env < 1e-4:
                break
            out[i] += amp * env * (math.sin(ph1 + w1 * i) + 0.6 * math.sin(ph2 + w2 * i))
    # 敲擊的瞬間：一小段衰減很快的雜訊
    if strike:
        for i in range(int(0.03 * SR)):
            out[i] += strike * rnd.uniform(-1, 1) * math.exp(-i / (0.006 * SR))
    # 起音不要太硬
    for i in range(int(0.002 * SR)):
        out[i] *= i / (0.002 * SR)
    return out


def biquad_bandpass(x: list[float], freqs, q: float) -> list[float]:
    """時變帶通：每 64 個取樣重算一次係數。freqs(t) 回傳中心頻率。"""
    y = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    b0 = b2 = a1 = a2 = 0.0
    for i, xi in enumerate(x):
        if i % 64 == 0:
            f = freqs(i / SR)
            w = 2 * math.pi * f / SR
            alpha = math.sin(w) / (2 * q)
            a0 = 1 + alpha
            b0, b2 = alpha / a0, -alpha / a0
            a1, a2 = -2 * math.cos(w) / a0, (1 - alpha) / a0
        yi = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xi
        y2, y1 = y1, yi
        y[i] = yi
    return y


def synth_whoosh(seed: int) -> list[float]:
    rnd = random.Random(seed)
    dur = 0.85
    n = int(dur * SR)
    noise = [rnd.uniform(-1, 1) for _ in range(n)]
    lo = biquad_bandpass(noise, lambda t: 260 + 1300 * math.sin(math.pi * min(t / dur, 1)) ** 1.5, 1.4)
    hi = biquad_bandpass(noise, lambda t: 1800 + 2600 * math.sin(math.pi * min(t / dur, 1)) ** 2, 2.5)
    out = []
    for i in range(n):
        t = i / n
        env = math.sin(math.pi * t) ** 1.6
        out.append((lo[i] + 0.35 * hi[i]) * env)
    return out


def synth_incense() -> list[float]:
    """劃火柴（嚓＋劈啪＋火苗）→ 小磬「叮」"""
    rnd = random.Random(7)
    dur = 3.0
    n = int(dur * SR)
    out = [0.0] * n
    # 嚓：0.12 秒的刮擦雜訊
    scratch = [rnd.uniform(-1, 1) for _ in range(int(0.14 * SR))]
    scratch = biquad_bandpass(scratch, lambda t: 2800 + 3000 * t / 0.14, 1.2)
    for i, s in enumerate(scratch):
        t = i / len(scratch)
        out[i] += 1.4 * s * (min(1, t * 12) * (1 - t) ** 0.5)
    # 劈啪：幾個短脈衝
    for _ in range(9):
        p = int(rnd.uniform(0.1, 0.45) * SR)
        for j in range(120):
            if p + j < n:
                out[p + j] += rnd.uniform(-1, 1) * math.exp(-j / 18) * 0.7
    # 火苗：低頻的呼
    flame = [rnd.uniform(-1, 1) for _ in range(int(0.9 * SR))]
    flame = biquad_bandpass(flame, lambda t: 420, 0.7)
    start = int(0.12 * SR)
    for i, s in enumerate(flame):
        t = i / len(flame)
        out[start + i] += 0.5 * s * math.sin(math.pi * t) ** 2
    # 叮：小磬（引磬），高音、分音不和諧、長尾
    ding = bell(2.3, 1180, [(1.0, 1.0, 1.4), (2.76, 0.45, 0.7), (5.4, 0.22, 0.3), (8.93, 0.08, 0.15)], strike=0.25, seed=3)
    start = int(0.7 * SR)
    for i, s in enumerate(ding):
        if start + i < n:
            out[start + i] += 0.55 * s
    return out


def synth_temple_bell() -> list[float]:
    """廟裡的大鐘：低沉、長尾、有拍頻"""
    return bell(
        5.5,
        150,
        [
            (0.5, 0.6, 4.5),  # hum
            (1.0, 1.0, 3.2),  # prime
            (1.19, 0.55, 2.4),  # tierce
            (1.5, 0.35, 1.8),  # quint
            (2.0, 0.7, 1.6),  # nominal
            (2.52, 0.3, 1.0),
            (2.99, 0.25, 0.8),
            (4.07, 0.14, 0.45),
            (5.3, 0.08, 0.3),
        ],
        strike=0.6,
        seed=11,
    )


# ---------------------------------------------------------------------------


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(pathlib.Path(tempfile.gettempdir()) / "kenney-cache"))
    args = ap.parse_args()
    cache = pathlib.Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.mp3"):
        f.unlink()

    zips = {}
    for key, url in PACKS.items():
        z = cache / url.rsplit("/", 1)[1]
        if not z.exists():
            print(f"下載 {z.name}")
            req = urllib.request.Request(url, headers={"User-Agent": "haunted-reviews-sfx/1.0"})
            z.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        zips[key] = zipfile.ZipFile(z)

    manifest: dict[str, dict] = {}
    with tempfile.TemporaryDirectory() as t:
        tmp = pathlib.Path(t)
        for name, (pack, files, vol) in PICKS.items():
            zf = zips[pack]
            names = {pathlib.PurePosixPath(n).name: n for n in zf.namelist()}
            outs = []
            for i, fn in enumerate(files, 1):
                src = tmp / fn
                src.write_bytes(zf.read(names[fn]))
                dest = OUT / f"{name}_{i}.mp3"
                to_mp3(src, dest)
                outs.append(dest.name)
            manifest[name] = {"files": outs, "volume": vol}

        synth = {
            "whoosh": ([synth_whoosh(s) for s in (1, 2)], 0.7),
            "incense": ([synth_incense()], 0.8),
            "temple_bell": ([synth_temple_bell()], 0.9),
        }
        for name, (variants, vol) in synth.items():
            outs = []
            for i, samples in enumerate(variants, 1):
                wav = tmp / f"{name}_{i}.wav"
                write_wav(wav, samples)
                dest = OUT / f"{name}_{i}.mp3"
                to_mp3(wav, dest)
                outs.append(dest.name)
            manifest[name] = {"files": outs, "volume": vol}

    (OUT / "manifest.json").write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "CREDITS.txt").write_text(
        "Sound effects\n"
        "=============\n\n"
        "Kenney (https://kenney.nl) — CC0 1.0 Universal (public domain)\n"
        "  RPG Audio:        door_open, door_close, cloth, creak, pot, switch\n"
        "  Impact Sounds:    footstep_wood, footstep_stone, footstep_grass, knock\n"
        "  Interface Sounds: ui_select, ui_confirm, ui_cancel, dialogue_next, pickup\n\n"
        "Synthesized by scripts/fetch_sfx.py for this game — CC0\n"
        "  whoosh, incense (match strike + small bowl bell), temple_bell\n",
        encoding="utf-8",
    )
    total = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"完成：{len(manifest)} 種音效、{len(list(OUT.glob('*.mp3')))} 個檔案，{total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
