#!/usr/bin/env python3
"""Generate 16x16 placeholder PNG textures for the FNAF addon blocks.

These are stand-ins so the addon renders correctly. Replace them with your own
FNAF-themed art at the same paths."""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "blocks", "fnaf")


def write_png(path, pixels):
    """pixels: list of 16 rows, each 16 (r,g,b,a) tuples."""
    width = height = 16
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


def solid(color, border=None, marks=None):
    r, g, b = color
    px = [[(r, g, b, 255) for _ in range(16)] for _ in range(16)]
    if border:
        br, bg, bb = border
        for i in range(16):
            px[0][i] = px[15][i] = px[i][0] = px[i][15] = (br, bg, bb, 255)
    if marks:
        mr, mg, mb = marks
        # A small 3x2 breaker-switch pattern grid
        for row in (4, 8, 12):
            for col in (4, 8, 12):
                for dy in range(2):
                    for dx in range(2):
                        px[row + dy][col + dx] = (mr, mg, mb, 255)
    return px


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Breaker box: dark gray body, black border, red switch marks
    write_png(
        os.path.join(OUT_DIR, "breaker_box_front.png"),
        solid((60, 60, 60), border=(20, 20, 20), marks=(200, 40, 40)),
    )
    # Breaker box sides: plain dark gray
    write_png(
        os.path.join(OUT_DIR, "breaker_box_side.png"),
        solid((45, 45, 45), border=(20, 20, 20)),
    )
    # Room light on: bright warm yellow
    write_png(
        os.path.join(OUT_DIR, "room_light_on.png"),
        solid((255, 230, 130), border=(180, 150, 60)),
    )
    # Room light off: dim gray
    write_png(
        os.path.join(OUT_DIR, "room_light_off.png"),
        solid((70, 70, 70), border=(30, 30, 30)),
    )
    print(f"wrote textures to {OUT_DIR}")


if __name__ == "__main__":
    main()
