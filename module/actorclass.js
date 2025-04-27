// The pool table maps the number of dice in the attribute's dice pool based on the attribute's value.
const pool = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]
const poolSkill = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]

export class WOINActor extends Actor {

  _onUpdateOperation(documents, operation, user) {
    super._onUpdateOperation(documents, operation, user);
    console.log("WOIN | actor-sheet.js _onUpdateOperation documents ", documents);
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    let data = foundry.utils.duplicate(this.system);
    let updates = {}
    console.log("WOIN | actor-sheet.js updateAttributes data ", data);
    let toUpdate = false;

    // Calculating Attribute Dice Pools:
    for (let key in data.attributes) {
      let attr = data.attributes[key];
      if (!isNaN(attr.value)) {
        updates[`system.attributes.${key}.value`] = parseInt(attr.value);
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
    data.luck.max = data.attributes.luck.dice;
    if (data.luck.value > data.luck.max) {
      updates[`system.luck.value`] = data.luck.max;
      toUpdate = true;
    }
    if ((data.luck.value < 0) || (!data.luck.value)) {
      updates[`system.luck.value`] = 0;
      toUpdate = true;
    }
    if (data.power.value > data.power.max) {
      updates[`system.power.value`] = data.power.max;
      toUpdate = true;
    }
    if ((data.power.value < 0) || (!data.power.value)) {
      updates[`system.power.value`] = 0;
      toUpdate = true;
    }

    if (toUpdate) {
      setTimeout(() => {
        console.log("WOIN | actor-sheet.js updateAttributes updates ", updates);
        this.update(updates);
        if (this.sheet) {
          this.sheet.render(true);
        }
      }, 50);
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
        xp += parseInt(element.value);
      });
      data.advancement.xp_spent.forEach(element => {
        xp -= parseInt(element.value);
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
          let gradePool = this.system.attributes[item.system.attribute].dice;
          if (item.system.score < 0) {
            item.system.score = 0;
          }
          let poolIndex = item.system.score;
          if (item.system.score > poolSkill.length) {
            poolIndex = poolSkill.length - 1;
          }
          let poolValue = poolSkill[poolIndex];
          if (gradePool != item.system.gradepool || poolValue != item.system.pool) {
            itemUpdates.push({ _id: item.id, "system.pool": poolValue, "system.gradepool": gradePool });
          }
        }

        if (item.type === "exploit") {
          let data = item.system;
          // console.log("WOIN | actorclass.js prepareData data ", data);
          // Used to ensure old character sheets remain up to date:
          if (data.style == null) {
            itemUpdates.push({ _id: item.id, "system.style": "" });
            //data.style = "";
          }
          // Checking the modifiers for any specific styling choices:
          data.style = "";
          if (data.modifier) {
            if (data.modifier.includes("uni_exploit")) {
              itemUpdates.push({ _id: item.id, "system.style": "uni" });
              //data.style = "uni";
            }
            if (data.modifier.includes("psi_exploit")) {
              itemUpdates.push({ _id: item.id, "system.style": "psi" });
              //data.style = "psi";
            }
          }
        }
      });

      if (itemUpdates.length > 0) {
        console.log("WOIN | actorclass.js prepareData itemUpdates ", itemUpdates);
        setTimeout(() => {
          this.updateEmbeddedDocuments("Item", itemUpdates);
        }, 100);
      }

      // Calculating Carried/Items:
      if (!data.carry) {
        data.carry = {};
      }
      data.carry.carried = 0;
      actorData.items.forEach(item => {
        if (item.type === "item" && item.system.carried === true) {
          data.carry.carried += item.system.weight * item.system.quantity;
          if (item.type != "skill") {
            //console.log("WOIN | actorclass.js prepareData item ", item)
            let itemData = item.system;
            //console.log("WOIN | actorclass.js prepareData itemData ", itemData);
            itemData.weapon.skilldamage = 0;
            if (itemData.skill) {
              //console.log("WOIN | actorclass.js prepareData itemData.skill ", itemData.skill);
              let pool;
              if (typeof itemData.skill === 'string') {
                pool = (data.attributes[itemData.skill.toLowerCase()]);
              }
              else {
                pool = (data.attributes[itemData.skill.toLowerCase()]);
              }

              if (pool) {
                let update = pool.dice;
                pool = update;
                itemData.error = "";
              }
              else {
                itemData.error = "error-red";
                actorData.items.forEach(skill => {
                  if (skill.type === "skill" && skill.name.toLowerCase() === itemData.skill.toLowerCase()) {
                    pool = skill;
                    let update = skill.system.gradepool + skill.system.pool;
                    if (skill.system.pool != itemData.weapon.skilldamage) {
                      itemData.weapon.skilldamage = skill.system.pool;
                    }
                    pool = update;
                    itemData.error = "";
                  }
                });
              }
              pool += itemData.weapon.bonus_attack;

              if (!item.system.weapon.attack || pool != item.system.weapon.attack) {
                itemData.weapon.attack = pool;
                // this.updateOwnedItem(item, {"data":itemData});
              }
            }
          }
        }
      });

      // Calculating Initiative:
      data.initiative.error = "error-red";
      data.initiative.value = 0;
      let attdice = data.attributes[data.initiative.skill];
      if (attdice) {
        data.initiative.value = attdice.dice;
        data.initiative.error = "";
        //console.log("WOIN | actorclass.js prepareData data.initiative.value ", data.initiative.value);
      }
      else {
        console.log("WOIN | actorclass.js prepareData data.initiative.value ", data.initiative.value);
        actorData.items.forEach(skill => {
          if (skill.type === "skill" && skill.name.toLowerCase() === data.initiative.skill.toLowerCase()) {
            //console.log("WOIN | actorclass.js prepareData skill.system ", skill.system);
            //console.log("WOIN | actorclass.js prepareData skill.system.gradepool ", skill.system.gradepool);
            data.initiative.value = skill.system.pool + skill.system.gradepool;
            data.initiative.error = "";
          }
        });
      }
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
