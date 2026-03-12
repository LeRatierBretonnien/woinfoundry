export class DiceWOIN {

    static #escapeHTML(value) {
        return `${value ?? ""}`
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static #number(form, name, fallback = 0) {
        const value = Number(form?.elements?.[name]?.value);
        return Number.isFinite(value) ? value : fallback;
    }

    static #checked(form, name) {
        return Boolean(form?.elements?.[name]?.checked);
    }

    static #buildTag(label, value) {
        if (value == null || value === "") return label;
        return `${label}: ${value}`;
    }

    static async #sendRoll({ formula, data = {}, speaker, flavor, rollMode, actor = null, luckSpent = 0, detailTags = [], subtitle = null, icon = null }) {
        const modeClassMap = {
            roll: "woin-chat-mode--public",
            gmroll: "woin-chat-mode--private",
            blindroll: "woin-chat-mode--blind"
        };
        const modeLabelMap = {
            roll: "Public",
            gmroll: "Private",
            blindroll: "Blind"
        };
        const actorName = this.#escapeHTML(actor?.name ?? speaker?.alias ?? "WOIN");
        const actorImage = icon ?? actor?.img ?? "icons/svg/d20-black.svg";
        const title = this.#escapeHTML(flavor || "Roll");
        const subtitleText = this.#escapeHTML(subtitle || actor?.name || actorName);
        const modeClass = modeClassMap[rollMode] ?? "woin-chat-mode--public";
        const modeLabel = this.#escapeHTML(modeLabelMap[rollMode] ?? "Public");
        const luckLabel = Number(luckSpent || 0) > 0 ? `Luck -${Number(luckSpent)}` : "No Luck";
        const safeFormula = this.#escapeHTML(formula);
        const tags = detailTags.filter(Boolean).map(tag => `<span class="woin-chat-tag">${this.#escapeHTML(tag)}</span>`).join("");
        const tagsBlock = tags ? `<div class="woin-chat-tags">${tags}</div>` : "";
        const flavorCard = `
            <div class="woin-chat-flavor">
                <div class="woin-chat-flavor__header">
                    <img class="woin-chat-flavor__avatar" src="${actorImage}" alt="${actorName}" />
                    <div class="woin-chat-flavor__meta">
                        <div class="woin-chat-flavor__title">${title}</div>
                        <div class="woin-chat-flavor__subtitle">${subtitleText}</div>
                    </div>
                    <span class="woin-chat-mode ${modeClass}">${modeLabel}</span>
                </div>
                ${tagsBlock}
                <div class="woin-chat-flavor__footer">
                    <span class="woin-chat-formula">${safeFormula}</span>
                    <span class="woin-chat-luck">${this.#escapeHTML(luckLabel)}</span>
                </div>
            </div>
        `;

        let roll;
        try {
            roll = new Roll(formula, data);
            roll = await roll.toMessage({ speaker, flavor: flavorCard }, { rollMode });
        } catch (err) {
            console.error("WOIN | dice.js: Invalid roll formula:", formula, err);
            ui.notifications.error("WOIN: Invalid roll formula — check the console for details.");
            return false;
        }

        if (actor) {
            const currentLuck = Number(actor.system?.luck?.value ?? 0);
            const nextLuck = Math.max(0, currentLuck - Number(luckSpent || 0));
            await actor.update({ "system.luck.value": nextLuck });
        }
        return roll;
    }

    static async #openRollDialog({ title = "Roll", content, callbacks, classes = ["woin", "roll-dialog-app"], position = null }) {
        const result = await foundry.applications.api.DialogV2.wait({
            window: { title },
            classes,
            ...(position ? { position } : {}),
            content,
            buttons: [
                { action: "public", label: "Public", callback: callbacks.public, default: true },
                { action: "private", label: "Private", callback: callbacks.private },
                { action: "blind", label: "Blind", callback: callbacks.blind }
            ],
            rejectClose: false
        });
        return result ?? false;
    }

    static async rollGeneral({ attribute_dice = 0, skill_dice = 0, actorId = null, description = null, constant = 0 }) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.error("Actor not found");
            return false;
        }

        const cap = Number(actor.system?.advancement?.dice_cap ?? 0);
        const dice = Math.max(0, Math.min(cap, Number(skill_dice) + Number(attribute_dice)));
        const speaker = ChatMessage.getSpeaker();
        const flavor = description || "Roll";
        const template = "systems/woinfoundry/templates/chat/general-roll-dialog.html";
        const content = await foundry.applications.handlebars.renderTemplate(template, {
            base: dice,
            constant,
            maxLuck: actor.system.luck.value,
            rollMode: game.settings.get("core", "rollMode")
        });

        const makeGeneralRoll = async (form, rollMode) => {
            const base = this.#number(form, "base", dice);
            const add = this.#number(form, "bonus", 0);
            const flat = this.#number(form, "constant", constant);
            const luck = this.#number(form, "luck", 0);
            const explode = this.#checked(form, "explode") ? "x6" : "";
            const totalDice = Math.max(0, base + add);
            const formula = `${totalDice}d6${explode} + ${luck}d6x6 + ${flat}`;
            const detailTags = [
                this.#buildTag("Base", `${base}d6`),
                add ? this.#buildTag("Bonus d6", add > 0 ? `+${add}` : `${add}`) : null,
                flat ? this.#buildTag("Constant", flat > 0 ? `+${flat}` : `${flat}`) : null,
                explode ? "Exploding" : null
            ];
            return this.#sendRoll({ formula, speaker, flavor, rollMode, actor, luckSpent: luck, detailTags });
        };

        return this.#openRollDialog({
            title: "Roll",
            content,
            callbacks: {
                public:  (event, button) => makeGeneralRoll(button.form, "roll"),
                private: (event, button) => makeGeneralRoll(button.form, "gmroll"),
                blind:   (event, button) => makeGeneralRoll(button.form, "blindroll")
            }
        });
    }

    static async rollDamage({ itemId = null, actorId = null, description = null }) {
        // TODO: Is this even needed?
    }

    static async rollAttack({ itemId = null, actorId = null, description = null, bonusAttackOverride = null }) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.error("Actor not found");
            return false;
        }

        const item = actor.items.get(itemId);
        if (!item) {
            ui.notifications.error("Item not found");
            return false;
        }

        const itemSkill = `${item.system.skill ?? ""}`.toLowerCase();
        if (!itemSkill) {
            ui.notifications.error("Invalid Skill");
            return false;
        }

        const skill = actor.items.find(entry => entry.name.toLowerCase() === itemSkill);
        const cap = Number(actor.system?.advancement?.dice_cap ?? 0);

        let skillPool = 0;
        let attribute = 0;
        if (!skill) {
            const attr = actor.system.attributes[itemSkill];
            if (!attr) {
                ui.notifications.error("Invalid Skill");
                return false;
            }
            attribute = Number(attr.dice ?? 0);
        } else {
            skillPool = Number(skill.system.pool ?? 0);
            attribute = Number(actor.system.attributes[skill.system.attribute]?.dice ?? 0);
        }

        const capped = Math.max(0, Math.min(cap, skillPool + attribute));
        const weaponBonusAttack = Number.isFinite(Number(bonusAttackOverride))
            ? Number(bonusAttackOverride)
            : Number(item.system?.weapon?.bonus_attack ?? 0);
        const baseAttackDice = Math.max(0, capped + weaponBonusAttack);
        const speaker = ChatMessage.getSpeaker();
        const flavor = description || "";
        const template = "systems/woinfoundry/templates/chat/combat-roll-dialog.html";
        const content = await foundry.applications.handlebars.renderTemplate(template, {
            base: baseAttackDice,
            maxLuck: actor.system.luck.value,
            rollMode: game.settings.get("core", "rollMode")
        });

        const makeRoll = async (form, rollMode) => {
            const base = this.#number(form, "base", baseAttackDice);
            const add = this.#number(form, "bonus", 0);
            const flat = this.#number(form, "constant", 0);
            const luck = this.#number(form, "luck", 0);

            const highground = this.#checked(form, "high-ground") ? 1 : 0;
            const flanking = this.#checked(form, "flanking") ? 1 : 0;
            const aim = this.#checked(form, "aim-fient") ? 1 : 0;
            const cover = this.#checked(form, "cover") ? -2 : 0;
            // Converts 1-based UI input to a 0-or-negative penalty: input 1 = no penalty (0), input 2 = -1, etc.
            const rangeIncrement = -(this.#number(form, "range-increment", 1) - 1);
            const intoMelee = this.#checked(form, "into-melee") ? -2 : 0;
            const pointBlank = this.#checked(form, "point-blank") ? 1 : 0;
            const improvised = this.#checked(form, "improvised") ? -2 : 0;
            const obscured = this.#checked(form, "obscured") ? -2 : 0;
            const proneMelee = this.#checked(form, "pronem") ? 2 : 0;
            const proneRanged = this.#checked(form, "proner") ? -1 : 0;
            const calledShot = this.#checked(form, "called") ? -2 : 0;
            const sacrifice = -this.#number(form, "sacrifice", 0);
            const pinned = this.#number(form, "pinned", 0);
            const unaware = this.#checked(form, "unaware") ? 2 : 0;
            const crossfire = this.#number(form, "crossfire", 0);
            const suppressive = this.#checked(form, "suppressive") ? -2 : 0;
            const explode = this.#checked(form, "explode") ? "x6" : "";

            const totalDice = Math.max(
                0,
                base + add + unaware + crossfire + suppressive + flanking + highground + aim + cover + rangeIncrement + intoMelee + pointBlank + improvised + obscured + proneMelee + proneRanged + calledShot + sacrifice + pinned
            );
            const formula = `${totalDice}d6${explode} + ${luck}d6x6 + ${flat}`;
            const modifierDelta = totalDice - base;
            const detailTags = [
                this.#buildTag("Weapon", item.name),
                this.#buildTag("Skill", itemSkill),
                this.#buildTag("Base", `${base}d6`),
                weaponBonusAttack ? this.#buildTag("Weapon Bonus", weaponBonusAttack > 0 ? `+${weaponBonusAttack}` : `${weaponBonusAttack}`) : null,
                this.#buildTag("Delta", modifierDelta > 0 ? `+${modifierDelta}` : `${modifierDelta}`),
                add ? this.#buildTag("Bonus d6", add > 0 ? `+${add}` : `${add}`) : null,
                flat ? this.#buildTag("Constant", flat > 0 ? `+${flat}` : `${flat}`) : null,
                explode ? "Exploding" : null,
                highground ? "High Ground" : null,
                flanking ? "Flanking" : null,
                aim ? "Aim/Fient" : null,
                cover ? "Cover" : null,
                rangeIncrement < 0 ? this.#buildTag("Range", `${rangeIncrement}`) : null,
                intoMelee ? "Into Melee" : null,
                pointBlank ? "Point Blank" : null,
                improvised ? "Improvised" : null,
                obscured ? "Obscured" : null,
                proneMelee ? "Prone Target (Melee)" : null,
                proneRanged ? "Prone Target (Ranged)" : null,
                calledShot ? "Called Shot" : null,
                sacrifice ? this.#buildTag("Damage Exchange", `${sacrifice}`) : null,
                pinned ? this.#buildTag("Pinned", `${pinned}`) : null,
                unaware ? "Unaware Target" : null,
                crossfire ? this.#buildTag("Crossfire", `${crossfire}`) : null,
                suppressive ? "Suppressive Fire" : null
            ];
            return this.#sendRoll({
                formula,
                speaker,
                flavor,
                rollMode,
                actor,
                luckSpent: luck,
                detailTags,
                subtitle: `${actor.name} • ${item.name}`,
                icon: item.img
            });
        };

        return this.#openRollDialog({
            title: "Attack Roll",
            classes: ["woin", "roll-dialog-app", "roll-dialog-attack"],
            position: { width: 980 },
            content,
            callbacks: {
                public: (event, button) => makeRoll(button.form, "roll"),
                private: (event, button) => makeRoll(button.form, "gmroll"),
                blind: (event, button) => makeRoll(button.form, "blindroll")
            }
        });
    }

    static async roll({ gradecapped = [], parts = [], sender = null, data = null, flavor = null, speaker = null, title = null, template = null, rollMode = null }) {
        if (!sender) {
            ui.notifications.error("Actor not found");
            return false;
        }

        const resolvedFlavor = flavor || title || "Roll";
        const resolvedSpeaker = speaker || ChatMessage.getSpeaker();
        const resolvedTemplate = template || "systems/woinfoundry/templates/chat/roll-dialog.html";
        const content = await foundry.applications.handlebars.renderTemplate(resolvedTemplate, {
            formula: parts.join(" + "),
            maxLuck: sender.system.luck.value,
            data: data ?? {},
            rollMode: rollMode || game.settings.get("core", "rollMode"),
            rollModes: CONFIG.rollModes,
            config: CONFIG.woinfoundry ?? {}
        });

        const makeRoll = async (form, selectedMode) => {
            const modifier = this.#number(form, "bonus", 0);
            const luck = this.#number(form, "luck", 0);
            const formula = `${form.elements.formula.value} + ${modifier}d6 + ${luck > 0 ? `${luck}d6x6` : "0"}`;
            const detailTags = [
                modifier ? this.#buildTag("Bonus d6", modifier > 0 ? `+${modifier}` : `${modifier}`) : null,
                luck > 0 ? this.#buildTag("Luck", `-${luck}`) : null
            ];
            return this.#sendRoll({
                formula,
                data: data ?? {},
                speaker: resolvedSpeaker,
                flavor: resolvedFlavor,
                rollMode: selectedMode,
                actor: sender,
                luckSpent: luck,
                detailTags
            });
        };

        return this.#openRollDialog({
            title: title || "Roll",
            content,
            callbacks: {
                public: (event, button) => makeRoll(button.form, "roll"),
                private: (event, button) => makeRoll(button.form, "gmroll"),
                blind: (event, button) => makeRoll(button.form, "blindroll")
            }
        });
    }
}
