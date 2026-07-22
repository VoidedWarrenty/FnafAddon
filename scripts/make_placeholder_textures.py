#!/usr/bin/env python3
"""Generate placeholder PNG textures for the FNAF addon.

Textures here are stand-ins so the addon renders correctly. Replace with your
own art at the same paths."""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "blocks", "fnaf")
ITEM_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "items", "fnaf")


def write_png(path, pixels):
    """pixels: list of H rows, each W (r,g,b,a) tuples."""
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def blank(w, h, color):
    r, g, b = color
    return [[(r, g, b, 255) for _ in range(w)] for _ in range(h)]


def rect(px, x, y, w, h, color):
    r, g, b = color
    for dy in range(h):
        for dx in range(w):
            yy, xx = y + dy, x + dx
            if 0 <= yy < len(px) and 0 <= xx < len(px[0]):
                px[yy][xx] = (r, g, b, 255)


def solid(color, border=None, marks=None):
    """Legacy 16x16 helper used for lights."""
    r, g, b = color
    px = [[(r, g, b, 255) for _ in range(16)] for _ in range(16)]
    if border:
        br, bg, bb = border
        for i in range(16):
            px[0][i] = px[15][i] = px[i][0] = px[i][15] = (br, bg, bb, 255)
    if marks:
        mr, mg, mb = marks
        for row in (4, 8, 12):
            for col in (4, 8, 12):
                for dy in range(2):
                    for dx in range(2):
                        px[row + dy][col + dx] = (mr, mg, mb, 255)
    return px


def breaker_panel_front_32():
    """32x32 texture, but only the top-left 14x14 region is used (panel front
    UV is [2,2]->[14,14]). We fill the useful area with an electrical panel
    look, and leave the rest as dark gray so other UVs on the same atlas map
    to neutral colors."""
    px = blank(32, 32, (24, 24, 24))

    # Panel body (12x12 visible face at UV [2,2] -> [14,14])
    panel_bg = (52, 52, 56)
    rect(px, 2, 2, 12, 12, panel_bg)

    # Panel darker inset frame
    inset = (30, 30, 34, 255)
    for i in range(12):
        px[2][2 + i] = inset
        px[13][2 + i] = inset
        px[2 + i][2] = inset
        px[2 + i][13] = inset

    # 4 corner screws
    for (x, y) in [(3, 3), (12, 3), (3, 12), (12, 12)]:
        px[y][x] = (170, 170, 170, 255)

    # Brand plate (a light strip at top)
    plate = (200, 200, 200)
    rect(px, 5, 4, 6, 1, plate)

    # Breaker switches: 2 columns x 3 rows of small rectangles
    body = (210, 210, 210)
    for row in range(3):
        for col in range(2):
            x = 4 + col * 4
            y = 6 + row * 2
            rect(px, x, y, 3, 1, body)
            # switch slot (small dark line)
            px[y][x + 1] = (60, 60, 60, 255)

    # Sides / edges / back: paint a subtle metallic band in the UV strip areas
    # East UV strip at (0,14)->(2,26): thin metallic
    metallic = (36, 36, 40)
    rect(px, 0, 14, 2, 12, metallic)
    rect(px, 14, 14, 2, 12, metallic)
    # Top/bottom strip
    rect(px, 2, 14, 12, 2, metallic)
    rect(px, 16, 14, 12, 2, metallic)
    # South face (back) at (16,2)->(28,14): plain
    rect(px, 16, 2, 12, 12, (30, 30, 34))
    return px


def breaker_panel_side_16():
    """Fallback side texture (used by material_instances '*'). Keeps a
    neutral dark metallic where the panel meets the wall."""
    px = blank(16, 16, (36, 36, 40))
    rect(px, 0, 0, 16, 1, (20, 20, 22))
    rect(px, 0, 15, 16, 1, (20, 20, 22))
    rect(px, 0, 0, 1, 16, (20, 20, 22))
    rect(px, 15, 0, 1, 16, (20, 20, 22))
    return px


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ITEM_DIR, exist_ok=True)

    # New wall-mount panel textures
    write_png(os.path.join(OUT_DIR, "breaker_panel_front.png"), breaker_panel_front_32())
    write_png(os.path.join(OUT_DIR, "breaker_panel_side.png"), breaker_panel_side_16())

    # Legacy full-cube textures kept so old resource pack references still resolve
    write_png(
        os.path.join(OUT_DIR, "breaker_box_front.png"),
        solid((60, 60, 60), border=(20, 20, 20), marks=(200, 40, 40)),
    )
    write_png(
        os.path.join(OUT_DIR, "breaker_box_side.png"),
        solid((45, 45, 45), border=(20, 20, 20)),
    )

    # Room lights
    write_png(
        os.path.join(OUT_DIR, "room_light_on.png"),
        solid((255, 230, 130), border=(180, 150, 60)),
    )
    write_png(
        os.path.join(OUT_DIR, "room_light_off.png"),
        solid((70, 70, 70), border=(30, 30, 30)),
    )
    print(f"wrote block textures to {OUT_DIR}")

    # Blueprint item icon
    bp = [[(24, 60, 130, 255) for _ in range(16)] for _ in range(16)]
    for i in range(16):
        bp[0][i] = bp[15][i] = bp[i][0] = bp[i][15] = (255, 255, 255, 255)
    for i in range(16):
        if i % 4 == 0:
            for j in range(1, 15):
                if bp[i][j] == (24, 60, 130, 255):
                    bp[i][j] = (200, 220, 255, 255)
                if bp[j][i] == (24, 60, 130, 255):
                    bp[j][i] = (200, 220, 255, 255)
    write_png(os.path.join(ITEM_DIR, "blueprint.png"), bp)
    print(f"wrote item textures to {ITEM_DIR}")


if __name__ == "__main__":
    main()
