const fields = foundry.data.fields;

const numberField = (initial = 0, options = {}) =>
  new fields.NumberField({ required: true, nullable: false, initial, ...options });

const stringField = (initial = "", options = {}) =>
  new fields.StringField({ required: true, nullable: false, initial, ...options });

const nullableStringField = (initial = "", options = {}) =>
  new fields.StringField({ required: false, nullable: true, initial, ...options });

const booleanField = (initial = false, options = {}) =>
  new fields.BooleanField({ required: true, nullable: false, initial, ...options });

const htmlField = (initial = "") =>
  new fields.HTMLField({ required: true, nullable: false, initial, textSearch: true });

const modifierField = () =>
  new fields.SchemaField({
    name: stringField("base"),
    bonus: numberField(0),
    flat: numberField(0)
  });

const stringArrayField = (initial = []) =>
  new fields.ArrayField(stringField(""), { initial });

const nullableStringArrayField = (initial = []) =>
  new fields.ArrayField(nullableStringField(""), { initial });

const toFiniteNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = `${value ?? ""}`.replace(",", ".").trim();
  if (normalized === "") return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const modifierArrayField = (initial = [{ name: "base", bonus: 0, flat: 0 }]) =>
  new fields.ArrayField(modifierField(), { initial });

const xpRowField = () =>
  new fields.SchemaField({
    name: stringField("default"),
    value: numberField(0)
  });

const characterAttributeField = (name, label) =>
  new fields.SchemaField({
    value: numberField(0),
    name: stringField(name),
    label: stringField(label),
    dice: numberField(0),
    modifier: modifierArrayField([])
  });

const detailsField = () =>
  new fields.SchemaField({
    is: stringField("a bountyhunter/mechanic/politician"),
    with: stringField("grudge/personal life/fondness of blades"),
    species: stringField("human"),
    homeworld: stringField("mars"),
    origin: stringField("Moisture Farmer"),
    gender: stringField("none"),
    age: stringField("young"),
    height: stringField("120cm"),
    weight: stringField("60kg"),
    languages: stringField("standard"),
    size: stringField("medium"),
    traits: stringField("none"),
    deity: stringField("none"),
    carry_increment: numberField(0),
    shadow: numberField(0)
  });

const itemWeaponField = () =>
  new fields.SchemaField({
    range: numberField(0),
    damagedice: numberField(0),
    bonusdamage: numberField(0),
    skilldamage: numberField(0),
    damage_bonus_origin: stringField("skill"),
    tradeoff: numberField(0),
    damagetypetext: stringField(""),
    damagetype: nullableStringArrayField(["slashing"]),
    special: stringField(""),
    attack: numberField(0),
    bonus_attack: numberField(0)
  });

const itemArmorField = () =>
  new fields.SchemaField({
    type: stringField("light"),
    special: stringField(""),
    soak: numberField(0),
    ineffective: nullableStringArrayField(["none"])
  });

export class WOINCharacterData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    const migrated = super.migrateData(source) ?? source ?? {};
    const details = migrated.details ?? {};
    details.carry_increment = toFiniteNumber(details.carry_increment, 0);
    details.shadow = toFiniteNumber(details.shadow, 0);
    migrated.details = details;
    return migrated;
  }

  static defineSchema() {
    return {
      biography: htmlField("Enter Text..."),
      initiative: new fields.SchemaField({
        value: numberField(0),
        mod: numberField(0),
        skill: stringField(""),
        error: stringField("")
      }),
      details: detailsField(),
      carry: new fields.SchemaField({
        carried: numberField(0)
      }),
      credits: numberField(0),
      net_worth: numberField(0),
      advancement: new fields.SchemaField({
        xp_gain: new fields.ArrayField(xpRowField(), { initial: [{ name: "default", value: 0 }] }),
        xp_spent: new fields.ArrayField(xpRowField(), { initial: [{ name: "default", value: 0 }] }),
        xp_total: numberField(0),
        grade: numberField(0),
        dice_cap: numberField(0)
      }),
      health: new fields.SchemaField({
        value: numberField(0),
        min: numberField(0),
        max: numberField(0)
      }),
      luck: new fields.SchemaField({
        value: numberField(0),
        min: numberField(0),
        max: numberField(0)
      }),
      power: new fields.SchemaField({
        value: numberField(0),
        min: numberField(0),
        max: numberField(0)
      }),
      soak: new fields.SchemaField({
        natural: stringField(""),
        armor: stringField(""),
        natural_modifiers: modifierArrayField(),
        armor_modifiers: modifierArrayField()
      }),
      defense: new fields.SchemaField({
        melee: numberField(0),
        ranged: numberField(0),
        mental: numberField(0),
        vital: numberField(0),
        melee_modifiers: modifierArrayField(),
        ranged_modifiers: modifierArrayField(),
        mental_modifiers: modifierArrayField(),
        vital_modifiers: modifierArrayField()
      }),
      movement: new fields.SchemaField({
        speed: numberField(0),
        climb: numberField(0),
        swim: numberField(0),
        jumpH: numberField(0),
        jumpV: numberField(0),
        highG: numberField(0),
        lowG: numberField(0),
        zeroG: numberField(0)
      }),
      attributes: new fields.SchemaField({
        strength: characterAttributeField("strength", "str"),
        agility: characterAttributeField("agility", "agi"),
        endurance: characterAttributeField("endurance", "end"),
        intuition: characterAttributeField("intuition", "int"),
        logic: characterAttributeField("logic", "log"),
        willpower: characterAttributeField("willpower", "will"),
        charisma: characterAttributeField("charisma", "cha"),
        luck: characterAttributeField("luck", "luc"),
        reputation: characterAttributeField("reputation", "rep"),
        psionics: characterAttributeField("psionics", "psi"),
        magic: characterAttributeField("magic", "mag"),
        chi: characterAttributeField("chi", "chi")
      })
    };
  }
}

export class WOINSpacecraftData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      history: htmlField("Enter Text..."),
      details: new fields.SchemaField({
        name: stringField("Name"),
        date: stringField("Entering Service XXXX"),
        weight: numberField(0),
        hull: stringField("Class I"),
        length: numberField(0),
        width: numberField(0),
        height: numberField(0),
        traits: stringField(""),
        market_value: numberField(0)
      }),
      crew: new fields.SchemaField({
        crew: stringField(""),
        cost: numberField(0),
        troops: stringField("0"),
        passengers: stringField("0"),
        cabins: stringField("(0 standard, 0 luxury)"),
        luxury: stringField("100% Adequate")
      }),
      engine: new fields.SchemaField({
        fuel_capacity: numberField(0),
        operational_range: numberField(0),
        travel_increment: numberField(0),
        speed_trials: stringField("")
      }),
      defensive_data: new fields.SchemaField({
        superstructure: numberField(0),
        CPU: numberField(0),
        defense: numberField(0),
        "e-defense": numberField(0)
      })
    };
  }
}

export class WOINItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      inventorysort: numberField(0),
      description: htmlField("Enter Text..."),
      quantity: numberField(1),
      weight: numberField(0),
      cost: numberField(0),
      size: stringField("m"),
      availability: stringField("00"),
      types: stringArrayField(["none", "weapon", "container", "armor"]),
      type: stringField("none"),
      skill: stringField("skill"),
      attribute: stringField("strength"),
      equipped: booleanField(false),
      equipped_modifiers: stringField(""),
      eq_modifiers: stringField(""),
      carried: booleanField(true),
      quality: stringField("standard"),
      contained_in: stringField(""),
      error: stringField(""),
      open: booleanField(false),
      container: new fields.SchemaField({
        holds: numberField(0),
        adds: numberField(0),
        slots: numberField(0)
      }),
      weapon: itemWeaponField(),
      armor: itemArmorField()
    };
  }
}

export class WOINSkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attribute: stringField("strength"),
      score: numberField(0),
      pool: numberField(0),
      gradepool: numberField(0),
      description: htmlField("")
    };
  }
}

export class WOINExploitData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: stringField("name"),
      description: htmlField("description"),
      modifier: stringField(""),
      style: stringField(""),
      open: booleanField(false)
    };
  }
}

const shipArmorSoakField = () =>
  new fields.ArrayField(
    new fields.ArrayField(nullableStringField(""), { initial: [] }),
    { initial: [["0", "ballistic"]] }
  );

export class WOINShipComputerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(0),
      cycles: numberField(0),
      max_FTL: numberField(0),
      check: stringField("+0d6"),
      description: htmlField("")
    };
  }
}

export class WOINShipSensorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      range: numberField(0),
      check: stringField("+0d6"),
      description: htmlField("")
    };
  }
}

export class WOINShipFTLData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      power: numberField(0),
      FTL: numberField(0),
      fuel_efficiency: numberField(0),
      description: htmlField("")
    };
  }
}

export class WOINShipSubliminalData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      power: numberField(0),
      speed: numberField(0),
      fuel_efficiency: numberField(0),
      description: htmlField("")
    };
  }
}

export class WOINShipWeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      facing: stringField("f"),
      turret: booleanField(false),
      quantity: numberField(1),
      range: numberField(0),
      damage: stringField("0d6"),
      damage_type: stringArrayField([]),
      attack: stringField("+0d6"),
      description: htmlField("")
    };
  }
}

export class WOINShipFacilitiesData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      size: numberField(0),
      description: htmlField("")
    };
  }
}

export class WOINShipSystemsData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      description: htmlField("")
    };
  }
}

export class WOINShipHangarData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      ship_type: stringField(""),
      description: htmlField("")
    };
  }
}

export class WOINShipShieldData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      power: numberField(0),
      soak: numberField(0),
      description: htmlField("")
    };
  }
}

export class WOINShipArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      type: stringField(""),
      soak: shipArmorSoakField(),
      description: htmlField("")
    };
  }
}

export class WOINShipQuirkData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: numberField(1),
      hidden: booleanField(true),
      description: htmlField("")
    };
  }
}

export class WOINLanguageData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: stringField("standard"),
      description: htmlField("")
    };
  }
}
