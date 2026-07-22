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

function later(fn) { system.run(fn); }

// A blueprint-sheet-styled frame around the header. Blue on top and bottom,
// tape/tack pixels in the corners, name banner in the middle.
function blueprintHeader(bp) {
  return [
    "§9┏━━ §b§lB L U E P R I N T §r§9━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    `§9┃ §f${(bp.name || "Untitled").padEnd(38, " ")}§9┃`,
    "§9┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩",
  ].join("\n");
}

function blueprintFooter(bp) {
  const roomN = bp.rooms.length;
  const boxN = bp.rooms.reduce((n, r) => n + r.boxes.length, 0);
  const summary = `§7rooms §f${roomN} §8· §7boxes §f${boxN}`;
  return [
    "§9┢━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┪",
    `§9┃ §8· ${summary.padEnd(38, " ")}§9┃`,
    "§9┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
  ].join("\n");
}

function pickerRibbon(bp, pickerState) {
  if (!pickerState) return null;
  const room = findRoom(bp, pickerState.roomId);
  const step = pickerState.firstCorner
    ? `§ftap §b2nd §fcorner   §8· §71st at §f(${pickerState.firstCorner.x},${pickerState.firstCorner.y},${pickerState.firstCorner.z})`
    : `§ftap §b1st §fcorner`;
  return `§e▶ PICKING §7─ §f${room?.name ?? "?"} §7─ ${step}`;
}

export function openBlueprintEditor(player, bpId) {
  const bp = getBlueprint(bpId);
  if (!bp) {
    player.sendMessage("§cBlueprint not found in world registry.");
    return;
  }

  const pickerState = getPickerState(player.id);
  const map = renderMap(player.dimension.id, bp.rooms, { maxCols: 42, maxRows: 15 });
  const legend = bp.rooms.length ? renderRoomLegend(bp.rooms) : "§8§o(no rooms yet — tap §a+ Add Room§8§o to begin)";
  const ribbon = pickerRibbon(bp, pickerState);

  const body = [
    blueprintHeader(bp),
    ribbon,
    "",
    map,
    "",
    "§8§lLEGEND",
    legend,
    "",
    blueprintFooter(bp),
  ].filter(Boolean).join("\n");

  const form = new ActionFormData()
    .title("§l§bBLUEPRINT")
    .body(body);

  const buttons = [];
  // Tools first
  form.button("§a✦ Add Room");                     buttons.push({ kind: "add_room" });
  form.button("§bRename Blueprint");                buttons.push({ kind: "rename_bp" });
  form.button("§eLoad FNAF 1 Room Preset");         buttons.push({ kind: "preset_fnaf1" });
  if (pickerState) {
    form.button("§c⊘ Cancel Corner Picking");
    buttons.push({ kind: "cancel_picking" });
  }
  form.button("§4⚠ Delete All Rooms");             buttons.push({ kind: "clear_rooms" });
  form.button("§8✖ Close");                          buttons.push({ kind: "close" });
  // Room list
  for (let i = 0; i < bp.rooms.length; i++) {
    const r = bp.rooms[i];
    const boxCount = r.boxes.length;
    form.button(`§b#${String(i + 1).padStart(2, " ")}§r §8│ §f${r.name}  §8(${boxCount} ${boxCount === 1 ? "box" : "boxes"})`);
    buttons.push({ kind: "room", id: r.id });
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const choice = buttons[res.selection];
    if (!choice || choice.kind === "close") return;
    switch (choice.kind) {
      case "room": return later(() => openRoomEditor(player, bpId, choice.id));
      case "add_room": return later(() => promptAddRoom(player, bpId));
      case "rename_bp": return later(() => promptRenameBlueprint(player, bpId));
      case "preset_fnaf1": return later(() => loadFnaf1Preset(player, bpId));
      case "cancel_picking":
        stopPicking(player.id);
        player.onScreenDisplay.setActionBar("§7Corner picking cancelled");
        return later(() => openBlueprintEditor(player, bpId));
      case "clear_rooms": return later(() => confirmClearRooms(player, bpId));
    }
  }).catch(() => {});
}

function promptAddRoom(player, bpId) {
  const form = new ModalFormData()
    .title("§b✦ Add Room")
    .textField("§7Room name", "e.g. Show Stage", "");
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
    .title("§b✎ Rename Blueprint")
    .textField("§7Blueprint name", "e.g. Freddy Fazbear's Pizza", bp.name);
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
  player.onScreenDisplay.setActionBar(`§a✔ Added §f${added}§a FNAF 1 room${added === 1 ? "" : "s"}`);
  later(() => openBlueprintEditor(player, bpId));
}

function confirmClearRooms(player, bpId) {
  new MessageFormData()
    .title("§c⚠ Delete All Rooms?")
    .body("§7This clears every room and box from the blueprint.\n§cThis cannot be undone.")
    .button1("§4⚠ Delete All")
    .button2("§7Cancel")
    .show(player).then(res => {
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

  const map = renderMap(player.dimension.id, [room], { maxCols: 42, maxRows: 12 });
  const boxLines = room.boxes.length === 0
    ? "§8§o(no boxes yet — tap §a✦ Add Box§8§o and plant two corners)"
    : room.boxes.map((b, i) =>
        `§b#${String(i + 1).padStart(2, " ")}§r  §7(§f${b.x1}§7,§f${b.y1}§7,§f${b.z1}§7)§8 → §7(§f${b.x2}§7,§f${b.y2}§7,§f${b.z2}§7)`
      ).join("\n");

  const body = [
    "§9┏━━ §b§lR O O M §r§9━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    `§9┃ §f${room.name.padEnd(40, " ")}§9┃`,
    "§9┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩",
    "",
    map,
    "",
    `§8§lBOXES §7(${room.boxes.length})`,
    boxLines,
    "",
    "§9┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
  ].join("\n");

  const form = new ActionFormData()
    .title(`§lROOM: §r§f${room.name}`)
    .body(body);

  const buttons = [];
  form.button("§a✦ Add Box");          buttons.push({ kind: "add_box" });
  form.button("§bRename Room");         buttons.push({ kind: "rename" });
  form.button("§4⚠ Delete Room");       buttons.push({ kind: "delete" });
  form.button("§7← Back");              buttons.push({ kind: "back" });
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
        player.onScreenDisplay.setActionBar("§e▶ Tap the §b1st§e corner in the world (holding the blueprint).");
        return;
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
  new ModalFormData()
    .title("§b✎ Rename Room")
    .textField("§7Room name", "e.g. West Hall", room.name)
    .show(player).then(res => {
      if (res.canceled || !res.formValues) return later(() => openRoomEditor(player, bpId, roomId));
      const newName = String(res.formValues[0] ?? "").trim() || room.name;
      renameRoom(bp, roomId, newName);
      later(() => openRoomEditor(player, bpId, roomId));
    }).catch(() => {});
}
