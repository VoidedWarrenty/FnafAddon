#!/usr/bin/env python3
"""Generate placeholder PNG textures for the FNAF addon.

Textures here are stand-ins so the addon renders correctly. Replace with your
own art at the same paths."""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "blocks", "fnaf")
ITEM_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "items", "fnaf")
TILE_DIR = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "ui", "breaker_tiles")


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


def breaker_panel_entity_64():
    """64x64 texture matching the multi-cube breaker_panel.geo.json UV layout.

    - Back plate (10x14x1, recessed switch board):
        north (switches): (0,0)-(10,14)
        south:            (10,0)-(20,14)
        east/west/up/down: strip along y=14..15 and x=20..22
    - Frame top/bottom/left/right (rim around the back plate):
        packed into (22,0)-(60,22)
    - Door (14x18x0.5):
        north (outside):  (0,22)-(14,40)
        south (inside):   (14,22)-(28,40)
    """
    px = blank(64, 64, (25, 25, 28))

    metal_light = (170, 170, 175)
    metal_dark  = (110, 110, 115)
    metal_deep  = (55, 55, 60)

    # --- Back plate north face (breaker switch board) ---
    rect(px, 0, 0, 10, 14, (140, 140, 145))
    for i in range(10):
        px[0][i] = px[13][i] = (metal_deep + (255,))
    for i in range(14):
        px[i][0] = px[i][9] = (metal_deep + (255,))
    # 2 columns x 6 rows of tiny breaker switches
    for row in range(6):
        for col in range(2):
            sx = 1 + col * 4
            sy = 2 + row * 2
            rect(px, sx, sy, 3, 1, (215, 215, 210))
            px[sy][sx + 1] = (35, 35, 38, 255)
    # "MAIN" strip
    rect(px, 3, 0, 4, 1, (210, 210, 210))

    # --- Back plate south (against wall) ---
    rect(px, 10, 0, 10, 14, metal_deep)

    # --- Back plate east/west/up/down thin strips ---
    rect(px, 20, 0, 1, 14, metal_dark)
    rect(px, 21, 0, 1, 14, metal_dark)
    rect(px, 0, 14, 10, 1, metal_deep)
    rect(px, 10, 14, 10, 1, metal_deep)

    # --- Frame rims (fill a big dark-metal patch and let the individual
    # cube UVs sample from it) ---
    rect(px, 22, 0, 42, 22, metal_dark)
    # Add subtle screws at corners of the front-visible face regions
    for (x, y) in [(23, 1), (34, 1), (23, 5), (34, 5)]:
        px[y][x] = (metal_light + (255,))

    # --- Door north face (outside of the door, seen when closed) ---
    rect(px, 0, 22, 14, 18, (155, 155, 160))
    for (dx, dy) in [(0, 0), (13, 0), (0, 17), (13, 17)]:
        px[22 + dy][dx] = (70, 70, 75, 255)
    # Handle
    rect(px, 11, 28, 1, 6, metal_deep)
    # DANGER sticker
    rect(px, 1, 23, 8, 3, (170, 40, 40))
    rect(px, 1, 24, 8, 1, (240, 220, 220))

    # --- Door south face (inside — room list sticker) ---
    rect(px, 14, 22, 14, 18, (245, 240, 225))
    rect(px, 15, 23, 12, 2, (170, 40, 40))
    for i in range(7):
        y = 26 + i * 2
        rect(px, 15, y, 12, 1, (55, 55, 60))

    # --- Door thin edges ---
    rect(px, 28, 22, 1, 18, metal_dark)
    rect(px, 29, 22, 1, 18, metal_dark)
    rect(px, 30, 22, 14, 1, metal_dark)
    rect(px, 30, 23, 14, 1, metal_dark)

    return px


def make_tile_set():
    """Return a dict of {name: pixels} for the 14 breaker-map tiles.

    Each tile is 16x16. Palette:
      ground:  #0E1015
      wall:    #F5F3EA
      door:    #F0C755 (dashed)
      on:      #5FB878
      off:     #D25757
      frame:   #3B5A8C (subtle box around breaker)
    """
    W, H = 16, 16
    GROUND = (14, 16, 21)
    WALL   = (245, 243, 234)
    DOOR   = (240, 199, 85)
    ON     = (95, 184, 120)
    OFF    = (210, 87, 87)
    FRAME  = (59, 90, 140)

    def base():
        return blank(W, H, GROUND)

    tiles = {}

    tiles["blank"] = base()
    # floor: same ground but with a single dim dot for a subtle grid feel
    floor = base()
    floor[H // 2][W // 2] = (30, 34, 42, 255)
    tiles["floor"] = floor

    # cardinal walls (2 px thick along the named edge)
    wall_n = base(); rect(wall_n, 0, 0, W, 2, WALL); tiles["wall_n"] = wall_n
    wall_s = base(); rect(wall_s, 0, H - 2, W, 2, WALL); tiles["wall_s"] = wall_s
    wall_w = base(); rect(wall_w, 0, 0, 2, H, WALL); tiles["wall_w"] = wall_w
    wall_e = base(); rect(wall_e, W - 2, 0, 2, H, WALL); tiles["wall_e"] = wall_e

    # corners: two edges
    corner_nw = base(); rect(corner_nw, 0, 0, W, 2, WALL); rect(corner_nw, 0, 0, 2, H, WALL); tiles["corner_nw"] = corner_nw
    corner_ne = base(); rect(corner_ne, 0, 0, W, 2, WALL); rect(corner_ne, W - 2, 0, 2, H, WALL); tiles["corner_ne"] = corner_ne
    corner_sw = base(); rect(corner_sw, 0, H - 2, W, 2, WALL); rect(corner_sw, 0, 0, 2, H, WALL); tiles["corner_sw"] = corner_sw
    corner_se = base(); rect(corner_se, 0, H - 2, W, 2, WALL); rect(corner_se, W - 2, 0, 2, H, WALL); tiles["corner_se"] = corner_se

    # doorways: dashed line along middle of one edge
    door_h = base()
    # horizontal dashed across the bottom (opening in an N or S wall row)
    for x in range(0, W, 4):
        rect(door_h, x, H // 2 - 1, 3, 2, DOOR)
    tiles["door_h"] = door_h

    door_v = base()
    for y in range(0, H, 4):
        rect(door_v, W // 2 - 1, y, 2, 3, DOOR)
    tiles["door_v"] = door_v

    # breaker on / off — small tile with a switch body
    breaker_on = base()
    rect(breaker_on, 4, 3, 8, 10, (25, 31, 42))
    for i in range(4):
        breaker_on[3][4 + i * 2 + 1] = (FRAME + (255,))  # top dots (rivets)
        breaker_on[12][4 + i * 2 + 1] = (FRAME + (255,))
    rect(breaker_on, 5, 5, 6, 3, ON)
    tiles["breaker_on"] = breaker_on

    breaker_off = base()
    rect(breaker_off, 4, 3, 8, 10, (25, 31, 42))
    for i in range(4):
        breaker_off[3][4 + i * 2 + 1] = (FRAME + (255,))
        breaker_off[12][4 + i * 2 + 1] = (FRAME + (255,))
    rect(breaker_off, 5, 8, 6, 3, OFF)
    tiles["breaker_off"] = breaker_off

    return tiles


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ITEM_DIR, exist_ok=True)
    os.makedirs(TILE_DIR, exist_ok=True)

    for name, pixels in make_tile_set().items():
        write_png(os.path.join(TILE_DIR, f"{name}.png"), pixels)
    print(f"wrote 14 tile textures to {TILE_DIR}")

    write_png(os.path.join(OUT_DIR, "breaker_panel.png"), breaker_panel_entity_64())

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

    # Breaker box item icon: mini panel look
    bb = blank(16, 16, (110, 110, 115))
    for i in range(16):
        bb[0][i] = bb[15][i] = bb[i][0] = bb[i][15] = (55, 55, 60, 255)
    # Handle
    rect(bb, 13, 6, 1, 4, (60, 60, 65))
    # Slots
    for row in range(3):
        for col in range(2):
            rect(bb, 3 + col * 4, 4 + row * 3, 3, 1, (215, 215, 210))
            bb[4 + row * 3][4 + col * 4] = (35, 35, 35, 255)
    write_png(os.path.join(ITEM_DIR, "breaker_box.png"), bb)
    print(f"wrote item textures to {ITEM_DIR}")


if __name__ == "__main__":
    main()
