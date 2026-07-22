import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import {
  getBlueprint, saveBlueprint, addRoom, findRoom, renameRoom, removeRoom,
  removeBoxFromRoom,
} from "./blueprint.js";
import { startPicking, stopPicking, isPicking, getPickerState } from "./blueprintPicker.js";
import { FNAF1_ROOMS } from "./rooms.js";
import { rewriteHeldBlueprintName } from "./blueprintItem.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";

function blueprintMap(bp, player) {
  const dim = player.dimension.id;
  return renderMap(dim, bp.rooms, { maxCols: 46, maxRows: 18 });
}

function blueprintHeader(bp) {
  const bar = "§9━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  return `${bar}\n§8┃ §b§lBLUEPRINT§r §7- §f${bp.name}\n${bar}`;
}

// Re-open helper: forms have to be re-shown from a system.run tick.
function later(fn) { system.run(fn); }

export function openBlueprintEditor(player, bpId) {
  const bp = getBlueprint(bpId);
  if (!bp) {
    player.sendMessage("§cBlueprint not found in world registry.");
    return;
  }

  const pickerState = getPickerState(player.id);
  const statusLine = pickerState
    ? `§ePicking §f${findRoom(bp, pickerState.roomId)?.name ?? "?"}§e — ${pickerState.firstCorner ? "tap 2nd corner" : "tap 1st corner"}`
    : `§7Rooms: §f${bp.rooms.length}   §7Boxes: §f${bp.rooms.reduce((n, r) => n + r.boxes.length, 0)}`;
  const body = [
    blueprintHeader(bp),
    statusLine,
    blueprintMap(bp, player),
    renderRoomLegend(bp.rooms),
  ].filter(Boolean).join("\n");

  const form = new ActionFormData()
    .title("§l§bBLUEPRINT")
    .body(body);

  const buttons = [];

  // Tools first (until we ship JSON-UI, this is the closest we can get to
  // a persistent sidebar without pushing them below a long room list).
  form.button("§a+ Add Room");                buttons.push({ kind: "add_room" });
  form.button("§bRename Blueprint");          buttons.push({ kind: "rename_bp" });
  form.button("§eLoad FNAF 1 Room Preset");   buttons.push({ kind: "preset_fnaf1" });
  if (pickerState) {
    form.button("§cCancel Corner Picking");
    buttons.push({ kind: "cancel_picking" });
  }
  form.button("§4Delete All Rooms");          buttons.push({ kind: "clear_rooms" });

  // Room list
  for (let i = 0; i < bp.rooms.length; i++) {
    const r = bp.rooms[i];
    form.button(`§b#${i + 1}§r  §f${r.name}  §8(${r.boxes.length} box${r.boxes.length === 1 ? "" : "es"})`);
    buttons.push({ kind: "room", id: r.id });
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const choice = buttons[res.selection];
    if (!choice) return;
    switch (choice.kind) {
      case "room": return later(() => openRoomEditor(player, bpId, choice.id));
      case "add_room": return later(() => promptAddRoom(player, bpId));
      case "rename_bp": return later(() => promptRenameBlueprint(player, bpId));
      case "preset_fnaf1": return later(() => loadFnaf1Preset(player, bpId));
      case "cancel_picking":
        stopPicking(player.id);
        player.onScreenDisplay.setActionBar("§7Picking cancelled");
        return later(() => openBlueprintEditor(player, bpId));
      case "clear_rooms": return later(() => confirmClearRooms(player, bpId));
    }
  }).catch(() => {});
}

function promptAddRoom(player, bpId) {
  const form = new ModalFormData()
    .title("Add Room")
    .textField("Room name", "e.g. Show Stage", "");
  form.show(player).then(res => {
    if (res.canceled || !res.formValues) return later(() => openBlueprintEditor(player, bpId));
    const name = String(res.formValues[0] ?? "").trim();
    const bp = getBlueprint(bpId);
    if (!bp) return;
    const rid = addRoom(bp, name || `Room ${bp.rooms.length + 1}`);
    later(() => openRoomEditor(player, bpId, rid));
  }).catch(() => {});
}

function promptRenameBlueprint(player, bpId) {
  const bp = getBlueprint(bpId);
  if (!bp) return;
  const form = new ModalFormData()
    .title("Rename Blueprint")
    .textField("Blueprint name", "e.g. Freddy Fazbear's Pizza", bp.name);
  form.show(player).then(res => {
    if (res.canceled || !res.formValues) return later(() => openBlueprintEditor(player, bpId));
    const newName = String(res.formValues[0] ?? "").trim() || bp.name;
    bp.name = newName;
    saveBlueprint(bp);
    rewriteHeldBlueprintName(player, bpId, newName);
    later(() => openBlueprintEditor(player, bpId));
  }).catch(() => {});
}

function loadFnaf1Preset(player, bpId) {
  const bp = getBlueprint(bpId);
  if (!bp) return;
  const existing = new Set(bp.rooms.map(r => r.name.toLowerCase()));
  let added = 0;
  for (const r of FNAF1_ROOMS) {
    if (existing.has(r.name.toLowerCase())) continue;
    addRoom(bp, r.name);
    added++;
  }
  player.onScreenDisplay.setActionBar(`§aAdded ${added} FNAF 1 room name${added === 1 ? "" : "s"}`);
  later(() => openBlueprintEditor(player, bpId));
}

function confirmClearRooms(player, bpId) {
  const form = new MessageFormData()
    .title("Delete All Rooms?")
    .body("This clears every room and box from the blueprint. This cannot be undone.")
    .button1("Delete All")
    .button2("Cancel");
  form.show(player).then(res => {
    if (!res.canceled && res.selection === 0) {
      const bp = getBlueprint(bpId);
      if (bp) { bp.rooms = []; saveBlueprint(bp); }
    }
    later(() => openBlueprintEditor(player, bpId));
  }).catch(() => {});
}

// --- Room submenu ------------------------------------------------------

export function openRoomEditor(player, bpId, roomId) {
  const bp = getBlueprint(bpId);
  if (!bp) return;
  const room = findRoom(bp, roomId);
  if (!room) return later(() => openBlueprintEditor(player, bpId));

  // Show a map of just this one room, so the player sees exactly what
  // they've painted so far.
  const map = renderMap(player.dimension.id, [room], { maxCols: 46, maxRows: 14 });

  const boxLines = room.boxes.length === 0
    ? "§8No boxes yet. Tap §a+ Add Box §8then plant two corners in the world."
    : room.boxes.map((b, i) =>
        `§7#${i + 1}  §f(${b.x1},${b.y1},${b.z1}) → (${b.x2},${b.y2},${b.z2})`
      ).join("\n");

  const body = [
    `§9━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `§8┃ §b§lROOM§r §7- §f${room.name}`,
    `§9━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    map,
    "",
    "§7Boxes:",
    boxLines,
  ].join("\n");

  const form = new ActionFormData()
    .title(`§lROOM: §r§f${room.name}`)
    .body(body);

  const buttons = [];
  // Tools first
  form.button("§a+ Add Box");          buttons.push({ kind: "add_box" });
  form.button("§bRename Room");        buttons.push({ kind: "rename" });
  form.button("§4Delete Room");        buttons.push({ kind: "delete" });
  form.button("§7← Back");             buttons.push({ kind: "back" });
  // Then each existing box (delete)
  for (let i = 0; i < room.boxes.length; i++) {
    form.button(`§c✖ Delete Box #${i + 1}`);
    buttons.push({ kind: "del_box", index: i });
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const c = buttons[res.selection];
    if (!c) return;
    switch (c.kind) {
      case "add_box":
        startPicking(player.id, bpId, roomId, player.dimension.id);
        player.onScreenDisplay.setActionBar(
          `§eTap the 1st corner block in the world (holding the blueprint).`
        );
        return; // close menu so player can go pick
      case "del_box":
        removeBoxFromRoom(bp, roomId, c.index);
        return later(() => openRoomEditor(player, bpId, roomId));
      case "rename": return later(() => promptRenameRoom(player, bpId, roomId));
      case "delete":
        removeRoom(bp, roomId);
        return later(() => openBlueprintEditor(player, bpId));
      case "back": return later(() => openBlueprintEditor(player, bpId));
    }
  }).catch(() => {});
}

function promptRenameRoom(player, bpId, roomId) {
  const bp = getBlueprint(bpId);
  const room = bp && findRoom(bp, roomId);
  if (!room) return;
  const form = new ModalFormData()
    .title("Rename Room")
    .textField("Room name", "e.g. West Hall", room.name);
  form.show(player).then(res => {
    if (res.canceled || !res.formValues) return later(() => openRoomEditor(player, bpId, roomId));
    const newName = String(res.formValues[0] ?? "").trim() || room.name;
    renameRoom(bp, roomId, newName);
    later(() => openRoomEditor(player, bpId, roomId));
  }).catch(() => {});
}
