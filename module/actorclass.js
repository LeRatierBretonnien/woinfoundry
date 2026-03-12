// The pool table maps the number of dice in the attribute's dice pool based on the attribute's value.
const pool = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]
const poolSkill = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]

export class WOINActor extends Actor {

  /**
   * Given a skill or attribute name, returns the resolved dice pool and matching skill item.
   * Checks attributes first, then falls back to skill items.
   * @param {string} skillName
   * @returns {{ pool: number, found: boolean, skill: Item|null }}
   */
  _resolveSkillPool(skillName) {
    const key = `${skillName ?? ""}`.trim().toLowerCase();
    if (!key) return { pool: 0, found: false, skill: null };
    const attr = this.system.attributes[key];
    if (attr) return { pool: attr.dice, found: true, skill: null };
    const skill = this.items.find(
      s => s.type === "skill" && s.name.toLowerCase() === key
    );
    if (skill) return { pool: skill.system.pool + skill.system.gradepool, found: true, skill };
    return { pool: 0, found: false, skill: null };
  }

  _onUpdateOperation(documents, operation, user) {
    super._onUpdateOperation(documents, operation, user);
    console.log("WOIN | actor-sheet.js _onUpdateOperation documents ", documents);
  }

  async _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    if (userId !== game.userId) {
      return
    }

    let data = foundry.utils.duplicate(this.system);
    let updates = {}
    console.log("WOIN | actor-sheet.js updateAttributes data ", data);
    let toUpdate = false;

    // Calculating Attribute Dice Pools:
    for (let key in data.attributes) {
      let attr = data.attributes[key];
      const parsedValue = Number.parseInt(attr.value, 10);
      if (!Number.isNaN(parsedValue) && parsedValue !== attr.value) {
        updates[`system.attributes.${key}.value`] = parsedValue;
        toUpdate = true;
      }

      if (pool[attr.value] != null && attr.dice != pool[attr.value]) {
        updates[`system.attributes.${key}.dice`] = pool[attr.value];
        toUpdate = true;
      } else if (attr.dice == null || attr.dice < 0) {
        updates[`system.attributes.${key}.dice`] = 0;
        toUpdate = true;
      }
    };

    // Calculating Luck:
    if ( data.attributes.luck.dice != data.luck.max) {
      updates[`system.luck.max`] = data.attributes.luck.dice;
      toUpdate = true;
    }
    data.luck.max = data.attributes.luck.dice;
    if (data.luck.value > data.luck.max) {
      updates[`system.luck.value`] = data.luck.max;
      toUpdate = true;
    }
    if (data.luck.value == null || data.luck.value < 0) {
      updates[`system.luck.value`] = 0;
      toUpdate = true;
    }
    if (data.power.value > data.power.max) {
      updates[`system.power.value`] = data.power.max;
      toUpdate = true;
    }
    if (data.power.value == null || data.power.value < 0) {
      updates[`system.power.value`] = 0;
      toUpdate = true;
    }

    if (toUpdate) {
      console.log("WOIN | actor-sheet.js updateAttributes updates ", updates);
      await this.update(updates);
      this.sheet?.render(true);
    }
  }

  prepareData() {
    super.prepareData();
    const actorData = this;
    const data = actorData.system;

    console.log("WOIN | actorclass.js prepareData beginning actorData ", actorData);
    if (actorData.type === "character") {

      // Calculating Advancement:
      let xp = 0;
      data.advancement.xp_gain.forEach(element => {
        xp += Number.parseInt(element.value, 10) || 0;
      });
      data.advancement.xp_spent.forEach(element => {
        xp -= Number.parseInt(element.value, 10) || 0;
      });
      data.advancement.xp_total = xp;

      // Calculating Max Pool
      let grade = parseInt(data.advancement.grade);
      console.log("WOIN | actorclass.js prepareData grade ", grade);
      // Note: To escape this forced calculation, users can set their grade to "_7" or some other string.
      if ((typeof (grade) === "number") && (!isNaN(grade))) {
        if (grade < 6) {
          data.advancement.dice_cap = 5;
        } else if (grade < 8) {
          data.advancement.dice_cap = 6;
        } else if (grade < 11) {
          data.advancement.dice_cap = 7;
        } else if (grade < 15) {
          data.advancement.dice_cap = 8;
        } else if (grade < 20) {
          data.advancement.dice_cap = 9;
        } else {
          // The table only goes to grade 25 but the math breaks down well before this anyway.
          data.advancement.dice_cap = 10;
        }
      }

      // Calculating Skills:
      let itemUpdates = []
      actorData.items.forEach(item => {

        if (item.type === "skill") {
          let gradePool = this.system.attributes?.[item.system.attribute]?.dice ?? 0;
          const score = Math.max(0, Number(item.system.score) || 0);
          if (score !== item.system.score) {
            itemUpdates.push({ _id: item.id, "system.score": score });
          }
          let poolIndex = score;
          if (score > poolSkill.length) {
            poolIndex = poolSkill.length - 1;
          }
          let poolValue = poolSkill[poolIndex];
          if (gradePool != item.system.gradepool || poolValue != item.system.pool) {
            itemUpdates.push({ _id: item.id, "system.pool": poolValue, "system.gradepool": gradePool });
          }
        }

        if (item.type === "exploit") {
          const exploitData = item.system;
          const modifier = exploitData.modifier ?? "";
          let style = "";
          if (modifier.includes("uni_exploit")) {
            style = "uni";
          } else if (modifier.includes("psi_exploit")) {
            style = "psi";
          }
          if ((exploitData.style ?? "") !== style) {
            itemUpdates.push({ _id: item.id, "system.style": style });
          }
        }
      });

      if (itemUpdates.length > 0) {
        console.log("WOIN | actorclass.js prepareData itemUpdates ", itemUpdates);
        setTimeout(() => {
          this.updateEmbeddedDocuments("Item", itemUpdates).catch(err =>
            console.error("WOIN | actorclass.js prepareData: failed to update embedded items", err)
          );
        }, 100);
      }

      // Calculating Carried/Items:
      if (!data.carry) {
        data.carry = {};
      }
      data.carry.carried = 0;
      const combatItemUpdates = [];
      const availableAttributes = Object.keys(data.attributes ?? {});
      const arraysEqual = (a = [], b = []) => a.length === b.length && a.every((value, index) => value === b[index]);
      actorData.items.forEach(item => {
        if (item.type === "item") {
          if (item.system.carried === true) {
            data.carry.carried += item.system.weight * item.system.quantity;
          }
          //console.log("WOIN | actorclass.js prepareData item ", item)
          let itemData = item.system;
          //console.log("WOIN | actorclass.js prepareData itemData ", itemData);
          itemData.weapon.skilldamage = 0;
          let computedError = "error-red";
          const rawAttribute = `${itemData.attribute ?? ""}`.trim().toLowerCase();
          const firstAttributeToken = rawAttribute.split(/[,\s;/|]+/).find(Boolean) ?? "";
          const normalizedAttribute = availableAttributes.includes(rawAttribute)
            ? rawAttribute
            : (availableAttributes.includes(firstAttributeToken) ? firstAttributeToken : (availableAttributes[0] ?? "strength"));
          if (itemData.attribute !== normalizedAttribute) {
            itemData.attribute = normalizedAttribute;
            combatItemUpdates.push({ _id: item.id, "system.attribute": normalizedAttribute });
          }
          const currentDamageTypes = Array.isArray(itemData.weapon?.damagetype) ? itemData.weapon.damagetype : [];
          const compactDamageTypes = currentDamageTypes
            .map(value => `${value ?? ""}`.trim())
            .filter(value => value !== "");
          const parsedDamageTypesFromText = `${itemData.weapon?.damagetypetext ?? ""}`
            .split(/[;,/|]+/)
            .map(value => value.trim())
            .filter(value => value !== "");
          const resolvedDamageTypes = compactDamageTypes.length ? compactDamageTypes : parsedDamageTypesFromText;
          const normalizedDamageTypes = resolvedDamageTypes.length ? [...resolvedDamageTypes, null] : [null];
          const normalizedDamageTypeText = resolvedDamageTypes.join(", ");
          if (!arraysEqual(currentDamageTypes, normalizedDamageTypes)) {
            combatItemUpdates.push({ _id: item.id, "system.weapon.damagetype": normalizedDamageTypes });
          }
          if (`${itemData.weapon?.damagetypetext ?? ""}` !== normalizedDamageTypeText) {
            combatItemUpdates.push({ _id: item.id, "system.weapon.damagetypetext": normalizedDamageTypeText });
          }
          if (itemData.skill) {
            const { pool: basePool, found, skill: matchedSkill } = this._resolveSkillPool(itemData.skill);
            computedError = found ? "error-green" : "error-red";
            const damageBonusOrigin = itemData.weapon.damage_bonus_origin ?? "skill";
            if (damageBonusOrigin === "attribute") {
              const attrKey = normalizedAttribute;
              const attrDice = Number(data.attributes?.[attrKey]?.dice ?? 0);
              if (data.attributes?.[attrKey]) {
                itemData.weapon.skilldamage = attrDice;
              }
            } else if (matchedSkill && matchedSkill.system.pool !== itemData.weapon.skilldamage) {
              itemData.weapon.skilldamage = matchedSkill.system.pool;
            }
            const poolValue = basePool + itemData.weapon.bonus_attack;
            if (!item.system.weapon.attack || poolValue !== item.system.weapon.attack) {
              itemData.weapon.attack = poolValue;
            }
          }
          if ((item.system.error ?? "") !== computedError) {
            combatItemUpdates.push({ _id: item.id, "system.error": computedError });
          }
        }
      });
      if (combatItemUpdates.length > 0) {
        setTimeout(() => {
          this.updateEmbeddedDocuments("Item", combatItemUpdates).catch(err =>
            console.error("WOIN | actorclass.js prepareData: failed to update combat item states", err)
          );
        }, 100);
      }

      // Calculating Initiative:
      const { pool: initPool, found: initFound } = this._resolveSkillPool(data.initiative.skill);
      data.initiative.value = initPool;
      data.initiative.error = initFound ? "" : "error-red";
      //console.log("WOIN | actorclass.js prepareData data.initiative.value ", data.initiative.value);
      if (data.initiative.value > data.advancement.dice_cap) {
        data.initiative.value = data.advancement.dice_cap;
      }
      if (data.initiative.value < 0) {
        data.initiative.value = 0;
      }
      //console.log("WOIN | actorclass.js prepareData data.initiative.value ", data.initiative.value);
      data.initiative.value = parseInt(data.initiative.value) + parseInt(data.initiative.mod);
      //console.log("WOIN | actorclass.js prepareData data.initiative ", data.initiative);

      // Calculating Credits:
      data.net_worth = data.credits || 0;
      actorData.items.forEach(item => {
        if (item.type === "item") {
          if (Number.isFinite(item.system.cost) && Number.isFinite(item.system.quantity)) {
            data.net_worth += item.system.cost * item.system.quantity;
          }
        }
      });
    }

    console.log("WOIN | actorclass.js prepareData ending actorData ", actorData);
  }
}
