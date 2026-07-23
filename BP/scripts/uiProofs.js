import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// JSON-UI proof-of-concept experiments per docs/phase-0-inventory.md
// section "UNKNOWN / TEST REQUIRED". Each experiment opens a form
// whose title starts with a distinct prefix; the JSON-UI override in
// RP/ui/server_form.json gates a custom layout on that prefix.
//
// Trigger from chat:
//   /scriptevent fnaf:proofs
//
// The menu lists every experiment currently defined; each shows a
// PASS/FAIL rubric in its own form body so the reader can eyeball
// the result and report it back.

const MENU_PREFIX = "PROOF_MENU|";
const U1_PREFIX = "PROOF_U1|";
const U4_PREFIX = "PROOF_U4|";
const U8_PREFIX = "PROOF_U8|";

function openMenu(player) {
  const form = new ActionFormData()
    .title(`${MENU_PREFIX}JSON-UI proofs`)
    .body(
      "§7Select an experiment to run. Each opens its own form with a\n" +
      "§7PASS/FAIL rubric. Report the outcome so it can be recorded\n" +
      "§7into the vault."
    )
    .button("§bU1 §7· offset binding to derived value")
    .button("§bU4 §7· textures/ui/White availability")
    .button("§bU8 §7· image visibility independent of button")
    .button("§7Close");

  form.show(player).then(res => {
    if (res.canceled || res.selection == null) return;
    switch (res.selection) {
      case 0: return system.run(() => openU1(player));
      case 1: return system.run(() => openU4(player));
      case 2: return system.run(() => openU8(player));
    }
  }).catch(() => {});
}

// -- U1: can `offset` on a per-item control be bound to a runtime value
// derived from #collection_index? --------------------------------------
//
// The JSON-UI side (see RP/ui/server_form.json) lays out 5 slots inside
// a fixed collection, each intended to sit at x = collection_index * 30.
// We only need to send 5 buttons — texture doesn't matter, index does.

function openU1(player) {
  const form = new ActionFormData()
    .title(`${U1_PREFIX}Offset binding`)
    .body(
      "§7If you see FIVE white squares §fspread horizontally§7 across\n" +
      "§7the black canvas (roughly evenly spaced), §aU1 PASSES§7 —\n" +
      "§7per-item offset binding is available (Path A viable).\n\n" +
      "§7If you see FIVE white squares §fstacked on top of each other§7\n" +
      "§7or one visible square, §cU1 FAILS§7 — offset binding didn't\n" +
      "§7resolve, we must use a fixed pre-positioned pool (Path B)."
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
      "§7If you see §fFIVE white bars§7 stacked vertically but only\n" +
      "§7THREE of them are highlighted or interactive on hover,\n" +
      "§aU8 PASSES§7 — image and button visibility are independent.\n\n" +
      "§7If either all five or none of them are interactive, or fewer\n" +
      "§7than five images render, §cU8 FAILS§7 — decorative and\n" +
      "§7interactive layers must live in separate control pools."
    );
  form.button("on", "");
  form.button("",   "");
  form.button("on", "");
  form.button("",   "");
  form.button("on", "");
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
