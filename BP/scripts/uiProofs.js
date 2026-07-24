import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { FNAF_ROOT_PREFIX } from "./blueprintTypes.js";

// JSON-UI proof-of-concept experiments per docs/phase-0-inventory.md
// section "UNKNOWN / TEST REQUIRED". Each experiment opens a form
// whose title starts with a distinct prefix under the shared
// FNAF_ROOT_PREFIX; the JSON-UI override in RP/ui/server_form.json
// gates a custom layout on that prefix.
//
// Trigger from chat:
//   /scriptevent fnaf:proofs
//
// The menu lists every experiment currently defined; each shows a
// PASS/FAIL rubric in its own form body so the reader can eyeball
// the result and report it back.

const MENU_PREFIX  = FNAF_ROOT_PREFIX + "PROOF_MENU|";
const U1A_PREFIX   = FNAF_ROOT_PREFIX + "PROOF_U1A|"; // view binding
const U1B_PREFIX   = FNAF_ROOT_PREFIX + "PROOF_U1B|"; // property_bag
const U1C_PREFIX   = FNAF_ROOT_PREFIX + "PROOF_U1C|"; // inline math in offset
const U4_PREFIX    = FNAF_ROOT_PREFIX + "PROOF_U4|";
const U8_PREFIX    = FNAF_ROOT_PREFIX + "PROOF_U8|";

function openMenu(player) {
  const form = new ActionFormData()
    .title(`${MENU_PREFIX}JSON-UI proofs`)
    .body(
      "§7Select an experiment. Each opens its own form with a\n" +
      "§7PASS/FAIL rubric. Report outcomes for the vault."
    )
    .button("§bU1a §7· offset via view-binding")
    .button("§bU1b §7· offset via property_bag")
    .button("§bU1c §7· inline math in offset array")
    .button("§bU4  §7· textures/ui/White availability")
    .button("§bU8  §7· image vs button visibility split")
    .button("§7Close");

  form.show(player).then(res => {
    if (res.canceled || res.selection == null) return;
    switch (res.selection) {
      case 0: return system.run(() => openU1(player, U1A_PREFIX, "view binding"));
      case 1: return system.run(() => openU1(player, U1B_PREFIX, "property_bag"));
      case 2: return system.run(() => openU1(player, U1C_PREFIX, "inline math"));
      case 3: return system.run(() => openU4(player));
      case 4: return system.run(() => openU8(player));
    }
  }).catch(() => {});
}

// -- U1: can `offset` on a per-item control be bound to a runtime value
// derived from #collection_index? --------------------------------------
//
// Three RP-side variants exist behind U1A/U1B/U1C prefixes; each tries
// a different JSON-UI mechanism. Same PASS/FAIL rubric for all three.
// We send 5 buttons; the JSON-UI positions them via its own mechanism.

function openU1(player, prefix, variantLabel) {
  const form = new ActionFormData()
    .title(`${prefix}Offset · ${variantLabel}`)
    .body(
      `§7Variant: §f${variantLabel}\n\n` +
      "§7Five slots. If they §fspread horizontally§7 across the black\n" +
      "§7canvas, §aPASS§7 — this variant supports per-item offset.\n\n" +
      "§7If they §fstack at x=0§7 (one visible tall column), §cFAIL§7\n" +
      "§7— this variant doesn't work; try the next."
    );
  for (let i = 0; i < 5; i++) {
    form.button(`slot ${i}`, "textures/ui/electrical_map/wall");
  }
  form.show(player).catch(() => {});
}

// -- U4: does the stock texture textures/ui/White exist? --------------
//
// Just render one image whose texture attribute names it directly (no
// binding needed). If a solid white square appears the texture path
// resolves; if we see the missing-texture placeholder or nothing, it
// doesn't and we ship our own solid pixel.

function openU4(player) {
  new ActionFormData()
    .title(`${U4_PREFIX}White texture availability`)
    .body(
      "§7If you see a §fsolid white square§7 centred in the black\n" +
      "§7canvas, §aU4 PASSES§7 — textures/ui/White is a live stock\n" +
      "§7asset we can use as the wall fill.\n\n" +
      "§7If you see a missing-texture placeholder or nothing,\n" +
      "§cU4 FAILS§7 — we ship our own solid-colour pixel."
    )
    .button("close")
    .show(player).catch(() => {});
}

// -- U8: can an image's visibility be gated independently of a button's
// while both bind to the same collection? -----------------------------
//
// We send 5 buttons: 3 have text "on", 2 have text "" (empty). Each
// collection iteration renders BOTH an always-visible image and a
// hitbox button whose visibility depends on the button's text being
// non-empty. Expected pass: 5 images render, 3 hitboxes register clicks.

function openU8(player) {
  const form = new ActionFormData()
    .title(`${U8_PREFIX}Split visibility`)
    .body(
      "§7Five slots are sent — three labelled §fkeep§7, two labelled\n" +
      "§fhide§7. Every slot renders both an always-visible white bar\n" +
      "§7and a hitbox whose visibility depends on the label.\n\n" +
      "§aPASS§7 — you see FIVE white bars but only THREE respond to\n" +
      "§7taps (bars labelled 'hide' render but do nothing).\n\n" +
      "§cFAIL§7 — fewer than five bars OR all five are interactive."
    );
  form.button("keep", "");
  form.button("hide", "");
  form.button("keep", "");
  form.button("hide", "");
  form.button("keep", "");
  form.show(player).catch(() => {});
}

// -- registration -----------------------------------------------------

export function registerUiProofs() {
  system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id !== "fnaf:proofs") return;
    const player = ev.sourceEntity;
    if (!player) return;
    system.run(() => openMenu(player));
  });
}
