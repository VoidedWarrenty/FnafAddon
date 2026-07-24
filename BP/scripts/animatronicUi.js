import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// Registry of interactable animatronic entities and the animation slots
// they expose. Each entry lists the enum values the entity's `fnaf:anim`
// property accepts, in the order the UI should show them.
//
// Adding another animatronic later is just another entry here + a matching
// BP entity + RP client_entity + animation controller.
const ANIMATRONICS = {
  "fnaf:freddy_fazbear": {
    label: "Freddy Fazbear",
    property: "fnaf:anim",
    animations: ["idle", "perform", "statue", "walk", "chase", "attack", "sit"],
  },
};

function openAnimatronicUi(player, entity, entry) {
  const current = entity.getProperty(entry.property);
  const form = new ActionFormData()
    .title(`§9${entry.label}`)
    .body(`§7Currently playing: §f${current}\n§8Tap an animation to switch.`);
  for (const name of entry.animations) {
    const marker = name === current ? "§a▶ " : "§7  ";
    form.button(`${marker}${name}`);
  }
  form.show(player).then(res => {
    if (res.canceled) return;
    const picked = entry.animations[res.selection];
    if (!picked) return;
    try {
      entity.setProperty(entry.property, picked);
    } catch (e) {
      player.sendMessage(`§cCould not set animation: ${e}`);
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
