/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { SimpleItemSheet } from "./item-sheet.js";
import { SimpleActorSheet } from "./actor-sheet.js";
import { SimpleExploitSheet } from "./exploit-sheet.js"
import { SimpleShipItemSheet } from "./ship-item-sheet.js"
import { WOINActor } from "./actorclass.js";
import * as models from "./models/_module.js";
import "./config.js";
import { overrides } from "./overrides.js"
overrides();

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Handlebars.registerHelper('ifeq', function (a, b, options) {
  if (a == b) { return options.fn(this); }
  return options.inverse(this);
});

Handlebars.registerHelper('ifnoteq', function (a, b, options) {
  if (a != b) { return options.fn(this); }
  return options.inverse(this);
});

Handlebars.registerHelper('enrichHTML', (html) => {
  if (!html) return "";
  return new Handlebars.SafeString(
    foundry.applications.ux.TextEditor.implementation.enrichHTML(html) ?? ""
  );
});

// Handle v12 removal of this helper
Handlebars.registerHelper('select', function (selected, options) {
  const escaped = Handlebars.escapeExpression(selected).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rgx = new RegExp(' value=[\"\']' + escaped + '[\"\']');
  const html = options.fn(this);
  return html.replace(rgx, "$& selected");
});

Hooks.once("init", async function () {
  console.log(`WOIN | simple.js Hooks.once Initialized`);



  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "(@initiative.value)d6",
    decimals: 2
  };

  // Define custom Entity classes
  CONFIG.Actor.documentClass = WOINActor;
  CONFIG.Actor.dataModels = {
    character: models.WOINCharacterData,
    spacecraft: models.WOINSpacecraftData
  };
  CONFIG.Item.dataModels = {
    item: models.WOINItemData,
    skill: models.WOINSkillData,
    exploit: models.WOINExploitData,
    language: models.WOINLanguageData,
    ship_computer: models.WOINShipComputerData,
    ship_sensor: models.WOINShipSensorData,
    ship_ftl: models.WOINShipFTLData,
    ship_subliminal: models.WOINShipSubliminalData,
    ship_weapon: models.WOINShipWeaponData,
    ship_facilities: models.WOINShipFacilitiesData,
    ship_systems: models.WOINShipSystemsData,
    ship_hangar: models.WOINShipHangarData,
    ship_shield: models.WOINShipShieldData,
    ship_armor: models.WOINShipArmorData,
    ship_quirk: models.WOINShipQuirkData
  };

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("woinfoundry", SimpleActorSheet, { makeDefault: true });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("woinfoundry", SimpleItemSheet, { types: ["item"], makeDefault: true });
  foundry.documents.collections.Items.registerSheet("woinfoundry", SimpleExploitSheet, { types: ["skill"], makeDefault: true });
  foundry.documents.collections.Items.registerSheet("woinfoundry", SimpleExploitSheet, { types: ["language"], makeDefault: true });
  foundry.documents.collections.Items.registerSheet("woinfoundry", SimpleExploitSheet, { types: ["exploit"], makeDefault: true });

  const shipTypes = [
    "ship_computer", "ship_sensor", "ship_ftl", "ship_subliminal", "ship_weapon",
    "ship_facilities", "ship_systems", "ship_hangar", "ship_shield", "ship_armor", "ship_quirk"
  ];
  shipTypes.forEach(type =>
    foundry.documents.collections.Items.registerSheet("woinfoundry", SimpleShipItemSheet, { types: [type], makeDefault: true })
  );


  // Register system settings
  game.settings.register("woinfoundry", "macroShorthand", {
    name: "Shortened Macro Syntax",
    hint: "Enable a shortened macro syntax which allows referencing attributes directly, for example @str instead of @attributes.str.value. Disable this setting if you need the ability to reference the full attribute model, for example @attributes.str.label.",
    scope: "world",
    type: Boolean,
    default: true,
    config: true
  });
  game.settings.register("woinfoundry", "verticalSheet", {
    name: "Allow Vertical Sheet",
    hint: "When the character sheet is scaled below a certain point, use a responsive vertical layout?",
    scope: "client",
    type: Boolean,
    default: true,
    config: true
  });
  game.settings.register("woinfoundry", "PrimaryColour", {
    name: "Primary Colour",
    hint: "The primary colour to be used on the sheet. Try to keep it bright and readable.",
    scope: "client",
    type: String,
    default: "#00ffff",
    config: true
  });
  game.settings.register("woinfoundry", "InvertedPrimaryColour", {
    name: "Inverted Colour",
    hint: "The colour used when inverting the primary (e.g. hovering over tabs). Try to use colours that contrast well.",
    scope: "client",
    type: String,
    default: "#ff0000",
    config: true
  });

  // Dynamic Sheet Colour Stuff:
  let root = document.querySelector(':root');
  root.style.setProperty('--cyan', game.settings.get("woinfoundry", "PrimaryColour"));
  root.style.setProperty('--invertcyan', game.settings.get("woinfoundry", "InvertedPrimaryColour"));

  Hooks.on("closeSettingsConfig", () => {
    const root = document.querySelector(':root');
    root.style.setProperty('--cyan', game.settings.get("woinfoundry", "PrimaryColour"));
    root.style.setProperty('--invertcyan', game.settings.get("woinfoundry", "InvertedPrimaryColour"));
  });
});

Hooks.on("preCreateItem", (item, data) => {
  const incomingName = `${data?.name ?? ""}`.trim();
  if (incomingName.length > 0) return;
  item.updateSource({ name: item.type });
});
