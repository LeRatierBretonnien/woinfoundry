const BASE_PATH = "systems/woinfoundry/Icons/conditions/pngs";

const statusEffect = (iconFile, id, name) => {
    const img = `${BASE_PATH}/${iconFile}`;
    return {
        id,
        name,
        img,
        // Keep legacy aliases for older code paths that still reference v13-era keys.
        label: name,
        icon: img,
        flags: { woin: { value: 0 } }
    };
};

CONFIG.statusEffects = [
    statusEffect("terror.png",        "Afraid",     "Afraid"),
    statusEffect("angry-eyes.png",    "Angry",      "Angry"),
    statusEffect("bleeding-wound.png","Bleeding",   "Bleeding"),
    statusEffect("blindfold.png",     "Blind",      "Blind"),
    statusEffect("enrage.png",        "Burning",    "Burning"),
    statusEffect("smitten.png",       "Charmed",    "Charmed"),
    statusEffect("brain-freeze.png",  "Confused",   "Confused"),
    statusEffect("knockout.png",      "Dazed",      "Dazed"),
    // statusEffect("bleeding-wound.png","Deaf",     "Deaf"),
    statusEffect("drop-weapon.png",   "Disarmed",   "Disarmed"),
    statusEffect("shield-disabled.png","Disarmored","Disarmored"),
    statusEffect("falling.png",       "Downed",     "Downed"),
    statusEffect("beer-stein.png",    "Drunk",      "Drunk"),
    statusEffect("tired-eye.png",     "Fatigued",   "Fatigued"),
    statusEffect("think.png",         "Forgetful",  "Forgetful"),
    // statusEffect("bleeding-wound.png","Manic",    "Manic"),
    statusEffect("back-pain.png",     "Pain",       "Pain"),
    statusEffect("poison-bottle.png", "Poisoned",   "Poisoned"),
    statusEffect("imprisoned.png",    "Restrained", "Restrained"),
    statusEffect("vomiting.png",      "Sick",       "Sick"),
    statusEffect("night-sleep.png",   "Sleeping",   "Sleeping"),
    statusEffect("snail.png",         "Slowed",     "Slowed"),
];
