import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { FNAF1_ROOMS, roomName } from "./rooms.js";
import { getBreakerBoxState, setRoomPowered } from "./state.js";

// Open the FNAF 1 breaker box UI for a given block location.
// Uses ActionFormData so it works out of the box. A JSON-UI overlay with the
// FNAF map background can be layered on later without changing the script.
export function openBreakerBox(player, block) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const state = getBreakerBoxState(dim, x, y, z);

  const anyOn = FNAF1_ROOMS.some(r => state[String(r.id)] === true);
  const anyOff = FNAF1_ROOMS.some(r => state[String(r.id)] !== true);

  const form = new ActionFormData()
    .title("§lFNAF 1 §r§7- Breaker Panel")
    .body(
      "§7Freddy Fazbear's Pizza\n" +
      "§8Toggle a breaker to cut or restore power to a room.\n" +
      "§8Room lights within this dimension will follow the nearest breaker box."
    );

  for (const r of FNAF1_ROOMS) {
    const on = state[String(r.id)] === true;
    const label = `${on ? "§a[ON]§r" : "§c[OFF]§r"}  ${r.name}`;
    form.button(label);
  }
  // Always-last utility buttons
  form.button("§eMain Breaker: §aAll ON");
  form.button("§eMain Breaker: §cAll OFF");

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const sel = res.selection;
    if (sel < FNAF1_ROOMS.length) {
      const room = FNAF1_ROOMS[sel];
      const nowOn = state[String(room.id)] === true;
      setRoomPowered(dim, x, y, z, room.id, !nowOn);
      player.playSound(nowOn ? "random.click" : "random.click");
      player.onScreenDisplay.setActionBar(
        `${!nowOn ? "§aPowered on" : "§cCut power to"} §f${room.name}`
      );
    } else if (sel === FNAF1_ROOMS.length) {
      for (const r of FNAF1_ROOMS) setRoomPowered(dim, x, y, z, r.id, true);
      player.onScreenDisplay.setActionBar("§aAll breakers ON");
    } else if (sel === FNAF1_ROOMS.length + 1) {
      for (const r of FNAF1_ROOMS) setRoomPowered(dim, x, y, z, r.id, false);
      player.onScreenDisplay.setActionBar("§cAll breakers OFF");
    }
    // Re-open so the player can flip multiple breakers in a row.
    system.run(() => {
      try {
        if (block.typeId === "fnaf:breaker_box_1") {
          openBreakerBox(player, block);
        }
      } catch (_) { /* block gone */ }
    });
  }).catch(() => {});
}
