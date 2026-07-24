import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIMATRONIC_EDITOR_PREFIX } from "./blueprintTypes.js";

// Compact "Editor" panel for animatronics. The title carries the
// FNAF|ANIM_EDITOR| prefix so RP/ui/server_form.json's anim_editor wrapper
// matches, giving us a small floating-style panel instead of a full-screen
// modal. Nine buttons fill a 3x3 grid in fixed order:
//
//   row 1: rotation −  |  current yaw  |  rotation +
//   row 2: anim prev   |  current anim |  anim next
//   row 3: face-me     |  reset yaw    |  despawn
//
// ActionForm always closes on click, so we re-open the form on every
// action to *feel* like a persistent panel. There is one frame of flicker;
// eliminating it entirely would require a non-modal custom UI screen
// (previously scoped and left as future work — see the JSON-UI vault).

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

function facePlayer(entity, player) {
  const p = player.location, e = entity.location;
  const yaw = (Math.atan2(p.x - e.x, -(p.z - e.z)) * 180) / Math.PI;
  setYaw(entity, yaw);
}

function cycleIndex(list, current, delta) {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + delta + list.length) % list.length];
}

function openEditor(player, entity, entry) {
  const yaw = currentYaw(entity);
  const anim = entity.getProperty(entry.property);

  // Put the prefix AFTER the label so the visible portion of the title bar
  // (which truncates on the right) reads clean. The JSON-UI gate uses
  // substring match on the prefix, so position doesn't matter.
  const form = new ActionFormData()
    .title(`§9Editor · §f${entry.label}     ${ANIMATRONIC_EDITOR_PREFIX}`)
    .button("§l−")             // 0
    .button(`§f${yaw}°`)       // 1  (display-only)
    .button("§l+")             // 2
    .button("§l◄")             // 3
    .button(`§f${anim}`)       // 4  (display-only)
    .button("§l►")             // 5
    .button("§7Face")          // 6
    .button("§7Reset")         // 7
    .button("§cKill");         // 8

  form.show(player).then(res => {
    if (res.canceled) return;
    let acted = false;
    switch (res.selection) {
      case 0: setYaw(entity, (yaw - YAW_STEP + 360) % 360); acted = true; break;
      case 2: setYaw(entity, (yaw + YAW_STEP) % 360);       acted = true; break;
      case 3: entity.setProperty(entry.property, cycleIndex(entry.animations, anim, -1)); acted = true; break;
      case 5: entity.setProperty(entry.property, cycleIndex(entry.animations, anim, +1)); acted = true; break;
      case 6: facePlayer(entity, player); acted = true; break;
      case 7: setYaw(entity, 0);          acted = true; break;
      case 8: entity.remove();            return;
      default: break;
    }
    if (acted) system.runTimeout(() => openEditor(player, entity, entry), 1);
  });
}

export function registerAnimatronicUi() {
  world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
    const entry = ANIMATRONICS[ev.target?.typeId];
    if (!entry) return;
    ev.cancel = true;
    const { player, target } = ev;
    system.run(() => openEditor(player, target, entry));
  });
}
