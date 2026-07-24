import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

// Registry of interactable animatronics. Each entry names the animation
// enum values on the entity's `fnaf:anim` property, in the order the
// picker exposes them. Add a new animatronic by adding an entry here plus
// the matching BP entity + RP client_entity + animation controller.
const MISC_ACTIONS = ["(none)", "Face me", "Reset rotation", "Despawn"];

const ANIMATRONICS = {
  "fnaf:freddy_fazbear": {
    label: "Freddy Fazbear",
    property: "fnaf:anim",
    animations: ["idle", "perform", "statue", "walk", "chase", "attack", "sit"],
  },
};

function currentYaw(entity) {
  const r = entity.getRotation();
  // Bedrock reports yaw in [-180, 180]; normalize to [0, 360) for a slider.
  return ((r.y % 360) + 360) % 360;
}

function openAnimatronicUi(player, entity, entry) {
  const curAnim = entity.getProperty(entry.property);
  const curYaw = Math.round(currentYaw(entity));
  const animIndex = Math.max(0, entry.animations.indexOf(curAnim));

  const form = new ModalFormData()
    .title(`§9${entry.label} · Editor`)
    .slider("§lRotation§r  (yaw °)", 0, 359, 15, curYaw)
    .dropdown("§lAnimation", entry.animations, animIndex)
    .dropdown("§lMisc", MISC_ACTIONS, 0);

  form.show(player).then(res => {
    if (res.canceled || !res.formValues) return;
    const [yaw, pickedAnimIdx, pickedMiscIdx] = res.formValues;

    // Rotation: teleport in place with the new yaw. Non-player entities
    // don't expose setRotation() from the server API, so an in-place
    // teleport with a rotation override is the standard workaround.
    if (Math.round(yaw) !== curYaw) {
      entity.teleport(entity.location, {
        dimension: entity.dimension,
        rotation: { x: 0, y: yaw },
      });
    }

    // Animation.
    const pickedAnim = entry.animations[pickedAnimIdx];
    if (pickedAnim && pickedAnim !== curAnim) {
      try { entity.setProperty(entry.property, pickedAnim); }
      catch (e) { player.sendMessage(`§cAnim set failed: ${e}`); }
    }

    // Misc.
    switch (MISC_ACTIONS[pickedMiscIdx]) {
      case "Face me": {
        const p = player.location, e = entity.location;
        const yawToPlayer = (Math.atan2(p.x - e.x, -(p.z - e.z)) * 180) / Math.PI;
        entity.teleport(entity.location, {
          dimension: entity.dimension,
          rotation: { x: 0, y: yawToPlayer },
        });
        break;
      }
      case "Reset rotation":
        entity.teleport(entity.location, {
          dimension: entity.dimension,
          rotation: { x: 0, y: 0 },
        });
        break;
      case "Despawn":
        entity.remove();
        break;
    }
  });
}

export function registerAnimatronicUi() {
  world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
    const entry = ANIMATRONICS[ev.target?.typeId];
    if (!entry) return;
    ev.cancel = true;
    const { player, target } = ev;
    system.run(() => openAnimatronicUi(player, target, entry));
  });
}
