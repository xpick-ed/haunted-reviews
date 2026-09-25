#!/usr/bin/env python3
"""下載 Poly Haven 的 CC0 材質，壓成 WebP 放到 public/tex/。

用法：python3 scripts/fetch_textures.py（重新下載後，把 src/scene/kit.tsx 的 TEX_VERSION 加一）
需要 Pillow（pip install pillow）。重跑會覆蓋舊檔。
"""
import io
import json
import pathlib
import urllib.request

from PIL import Image

# 遊戲內名稱 → (Poly Haven id, 顏色貼圖邊長, 要不要粗糙度貼圖)
# 法線貼圖用一半邊長、粗糙度最多 512：俯視鏡頭看不出差別，下載量少一半以上（手機 4G 要快）
MATERIALS = {
    "brick": ("red_brick", 1024, True),
    "roof": ("clay_roof_tiles_02", 1024, True),
    "yard": ("dirty_concrete", 1024, True),
    "tile": ("terracotta_floor_tiles", 1024, True),
    "wood": ("dark_wooden_planks", 1024, True),
    "plaster": ("white_plaster_rough_01", 1024, False),
    "stone": ("japanese_stone_wall", 1024, True),
    "grass": ("grass_ground", 1024, False),
    "mud": ("brown_mud_02", 512, False),
}

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "tex"
UA = {"User-Agent": "haunted-reviews-texture-fetch/1.0"}


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def save_webp(data: bytes, path: pathlib.Path, size: int, quality: int, gray: bool = False) -> int:
    im = Image.open(io.BytesIO(data))
    im = im.convert("L" if gray else "RGB")
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)
    return path.stat().st_size


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, (ph_id, size, rough) in MATERIALS.items():
        files = json.loads(get(f"https://api.polyhaven.com/files/{ph_id}"))
        maps = [("Diffuse", "diff", 78, False), ("nor_gl", "nor", 82, False)]
        if rough:
            maps.append(("Rough", "rough", 80, True))
        for key, suffix, q, gray in maps:
            url = files[key]["1k"]["jpg"]["url"]
            s = size if suffix == "diff" else min(size // 2 if suffix == "nor" else size, 512)
            n = save_webp(get(url), OUT / f"{name}_{suffix}.webp", s, q, gray)
            total += n
            print(f"{name}_{suffix}.webp  {n // 1024:5d} KB  ← {ph_id}")
    (OUT / "CREDITS.txt").write_text(
        "Textures from Poly Haven (https://polyhaven.com), CC0 public domain.\n"
        + "".join(f"  {k}: https://polyhaven.com/a/{v[0]}\n" for k, v in MATERIALS.items()),
        encoding="utf-8",
    )
    print(f"total {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
