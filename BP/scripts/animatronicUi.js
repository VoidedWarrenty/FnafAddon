import { world, system } from "@minecraft/server";

// Wrench-gated NPC dialogue editor for animatronics.
//
// Flow:
//   1. Player right-clicks an animatronic while holding fnaf:wrench.
//   2. Because the animatronic has `minecraft:npc`, vanilla opens its
//      dialogue automatically (first scene in BP/dialogue/*.json).
//   3. Non-wrench right-clicks are cancelled so no dialogue appears.
//   4. Dialogue buttons run `/scriptevent fnaf:wrench <action>`. This
//      handler dispatches: rotate ±, anim prev/next, face-me, despawn.
//
// scriptevent context: sourceEntity = the NPC (Freddy). We don't reliably
// get the initiating player, so actions that need player context (face-me)
// find the nearest player within a small radius.

const WRENCH_ID = "fnaf:wrench";
const YAW_STEP = 15;

const ANIMATRONICS = {
  "fnaf:freddy_fazbear": {
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

function nearestPlayer(entity) {
  const players = entity.dimension.getPlayers({
    location: entity.location,
    maxDistance: 8,
    closest: 1,
  });
  return players[0];
}

function cycleIndex(list, current, delta) {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + delta + list.length) % list.length];
}

function performAction(npc, action) {
  const entry = ANIMATRONICS[npc.typeId];
  if (!entry) return;
  const current = npc.getProperty(entry.property);

  switch (action) {
    case "rot_minus":
      setYaw(npc, (currentYaw(npc) - YAW_STEP + 360) % 360);
      break;
    case "rot_plus":
      setYaw(npc, (currentYaw(npc) + YAW_STEP) % 360);
      break;
    case "anim_prev":
      npc.setProperty(entry.property, cycleIndex(entry.animations, current, -1));
      break;
    case "anim_next":
      npc.setProperty(entry.property, cycleIndex(entry.animations, current, +1));
      break;
    case "face": {
      const p = nearestPlayer(npc);
      if (!p) return;
      const pl = p.location, e = npc.location;
      const yaw = (Math.atan2(pl.x - e.x, -(pl.z - e.z)) * 180) / Math.PI;
      setYaw(npc, yaw);
      break;
    }
    case "kill":
      npc.remove();
      break;
  }
}

export function registerAnimatronicUi() {
  // Wrench gate: cancel any non-wrench right-click on a known animatronic
  // so the NPC dialogue never opens without the tool.
  world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
    if (!ANIMATRONICS[ev.target?.typeId]) return;
    if (ev.itemStack?.typeId !== WRENCH_ID) {
      ev.cancel = true;
    }
    // With wrench held, we let the interaction through — vanilla NPC
    // dialogue opens with the first scene from the entity's dialogue file.
  });

  // Dialogue-button dispatch: dialogue commands run `/scriptevent fnaf:wrench <action>`
  // with the NPC as sourceEntity.
  system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id !== "fnaf:wrench") return;
    const npc = ev.sourceEntity;
    if (!npc || !ANIMATRONICS[npc.typeId]) return;
    performAction(npc, ev.message.trim());
  });
}
