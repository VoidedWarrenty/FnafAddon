import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIMATRONIC_EDITOR_PREFIX } from "./blueprintTypes.js";

// Wrench-gated JSON-UI editor for animatronics. Right-click with wrench in
// hand opens the compact 3x3 panel (rendered by RP/ui/server_form.json's
// anim_editor_long_form wrapper). Right-click without wrench does nothing.
//
// The panel closes on each click; the handler re-opens it after applying
// the action so it *feels* persistent (one-frame flicker).

const WRENCH_ID = "fnaf:wrench";
const YAW_STEP = 15;
const MISC_ACTIONS = ["Face me", "Reset yaw", "Despawn"];

const ANIMATRONICS = {
  "fnaf:freddy_fazbear": {
    label: "Freddy Fazbear",
    property: "fnaf:anim",
    animations: ["idle", "perform", "statue", "walk", "chase", "attack", "sit"],
  },
};

function currentYaw(entity) {
  const r = entity.getRotation();
  return ((Math.round(r.y) % 360) + 360) % 360;
}

function setYaw(entity, yaw) {
  entity.teleport(entity.location, {
    dimension: entity.dimension,
    rotation: { x: 0, y: yaw },
  });
}

function cycleIndex(list, current, delta) {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + delta + list.length) % list.length];
}

function openEditor(player, entity, entry) {
  const yaw = currentYaw(entity);
  const anim = entity.getProperty(entry.property);

  const ICON = "textures/items/fnaf/";
  const form = new ActionFormData()
    .title(`§9Editor · §f${entry.label}     ${ANIMATRONIC_EDITOR_PREFIX}`)
    .button("",             ICON + "ui_minus")   // 0
    .button(`§f${yaw}°`)                          // 1 display-only
    .button("",             ICON + "ui_plus")    // 2
    .button("",             ICON + "ui_larr")    // 3
    .button(`§f${anim}`)                          // 4 display-only
    .button("",             ICON + "ui_rarr")    // 5
    .button("",             ICON + "ui_face")    // 6
    .button("",             ICON + "ui_reset")   // 7
    .button("",             ICON + "ui_kill");   // 8

  form.show(player).then(res => {
    if (res.canceled) return;
    let acted = false;
    switch (res.selection) {
      case 0: setYaw(entity, (yaw - YAW_STEP + 360) % 360); acted = true; break;
      case 2: setYaw(entity, (yaw + YAW_STEP) % 360);       acted = true; break;
      case 3: entity.setProperty(entry.property, cycleIndex(entry.animations, anim, -1)); acted = true; break;
      case 5: entity.setProperty(entry.property, cycleIndex(entry.animations, anim, +1)); acted = true; break;
      case 6: {
        const p = player.location, e = entity.location;
        const yawToPlayer = (Math.atan2(p.x - e.x, -(p.z - e.z)) * 180) / Math.PI;
        setYaw(entity, yawToPlayer);
        acted = true; break;
      }
      case 7: setYaw(entity, 0); acted = true; break;
      case 8: entity.remove(); return;
      default: break;
    }
    if (acted) system.runTimeout(() => openEditor(player, entity, entry), 1);
  });
}

export function registerAnimatronicUi() {
  world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
    const entry = ANIMATRONICS[ev.target?.typeId];
    if (!entry) return;
    // Wrench required — no wrench, no editor.
    if (ev.itemStack?.typeId !== WRENCH_ID) return;
    ev.cancel = true;
    const { player, target } = ev;
    system.run(() => openEditor(player, target, entry));
  });
}
