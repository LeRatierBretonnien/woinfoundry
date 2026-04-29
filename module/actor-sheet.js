/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

import { DiceWOIN } from "./dice.js"
const { HandlebarsApplicationMixin } = foundry.applications.api;
const poolSkill = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]

export class SimpleActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {


  // ---------------------------------------------------------------------------------
  // Important Initialization Functions for Foundry:

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["woin", "sheet", "actor"],
    position: {
      width: 831,
      height: 800
    },
    form: {
      handler: SimpleActorSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    },
    window: {
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/woinfoundry/templates/actor-sheet.html"
    }
  };

  static async #onSubmitForm(event, form, formData) {
    if (!this.isEditable) return;
    const submitData = this._processFormData(event, form, formData);
    const finiteNumberPaths = [
      "system.details.carry_increment",
      "system.details.shadow"
    ];
    const invalidFiniteFields = [];

    for (const path of finiteNumberPaths) {
      const hasDirectPath = Object.prototype.hasOwnProperty.call(submitData, path);
      const rawValue = hasDirectPath ? submitData[path] : foundry.utils.getProperty(submitData, path);
      if (rawValue === undefined) continue;

      const numericValue = Number(`${rawValue}`.trim());
      const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
      if (!Number.isFinite(numericValue) && `${rawValue}`.trim() !== "") {
        const pathParts = path.split(".");
        invalidFiniteFields.push(pathParts[pathParts.length - 1]);
      }

      if (hasDirectPath) submitData[path] = safeValue;
      foundry.utils.setProperty(submitData, path, safeValue);
    }

    if (invalidFiniteFields.length > 0) {
      ui.notifications.warn(`${invalidFiniteFields.join(", ")} must be finite numbers. Invalid values were reset to 0.`);
    }

    return this._processSubmitData(event, form, submitData);
  }

  /** @override */
  async _prepareContext() {
    const context = await super._prepareContext();
    const actorDocument = this.document ?? this.actor;
    const baseData = {
      actor: actorDocument,
      items: actorDocument.items,
      effects: actorDocument.effects
    };
    let sheetData = {
      ...context,
      owner: this.isOwner,
      editable: this.isEditable,
      actor: baseData,
      items: actorDocument.items,
      system: actorDocument.system,
    };
    await this.prepareItems(sheetData.items);
    console.log("WOIN | actor-sheet.js _prepareContext sheetData ", sheetData);
    return sheetData;
  }
  // ================================================================================

  async prepareItems(items) {
    let itemUpdates = [];
    for (let item of items) {
      if (item.system.description) {
        item.system.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, { async: true });
      }
      if (item.type === "skill") {
        let gradePool = this.actor.system.attributes[item.system.attribute].dice;
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
    }
    if (itemUpdates.length > 0) {
      console.log("WOIN | actor-sheet.js prepareItems itemUpdates ", itemUpdates);
      this.actor.updateEmbeddedDocuments("Item", itemUpdates)
        .then(() => this.render(false))
        .catch(err => console.error("WOIN | actor-sheet.js prepareItems: failed to update items", err));
    }
  }

  // ---------------------------------------------------------------------------------
  // Resize code for responsive design:
  _onResize() {
    if (!this.element) return;
    const rootElement = this.element;
    if (game.settings.get("woinfoundry", "verticalSheet")) {
      const sheetWidth = Number(this.position?.width ?? rootElement.getBoundingClientRect().width ?? 0);
      if (sheetWidth < 830) {
        rootElement.classList.add("vertical-sheet");
      }
      else {
        rootElement.classList.remove("vertical-sheet");
      }
    }
  }
  // ================================================================================

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._activateLegacyTabs();
    this._onResize();
    this.activateListeners($(this.element));
  }

  /** @override */
  async _onDropItemCreate(itemData, event) {
    let preparedData = itemData;
    const isGenericName = `${itemData?.name ?? ""}`.trim().toLowerCase() === "item";

    if (isGenericName && event?.dataTransfer) {
      try {
        const raw = event.dataTransfer.getData("text/plain");
        const dropData = raw ? JSON.parse(raw) : null;
        const isEmbeddedDrop = `${dropData?.uuid ?? ""}`.startsWith("Actor.");

        if (dropData?.type === "Item" && !isEmbeddedDrop) {
          const source = dropData.uuid ? await fromUuid(dropData.uuid) : game.items.get(dropData.id);
          if (source) {
            preparedData = source.toObject();
            delete preparedData._id;
          }
        }
      } catch (error) {
        console.warn("WOIN | actor-sheet.js _onDropItemCreate fallback to default data", error);
      }
    }

    const createData = foundry.utils.duplicate(preparedData ?? {});
    delete createData._id;
    return this.actor.createEmbeddedDocuments("Item", [createData]);
  }

  _activateLegacyTabs() {
    const root = this.element;
    if (!root) return;
    const tabs = Array.from(root.querySelectorAll(".sheet-tabs [data-tab]"));
    const tabPanels = Array.from(root.querySelectorAll(".sheet-body .tab[data-tab]"));
    if (!tabs.length || !tabPanels.length) return;

    const setActiveTab = (tabName) => {
      this._activeLegacyTab = tabName;
      tabs.forEach((tab) => {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle("active", active);
      });
      tabPanels.forEach((panel) => {
        const active = panel.dataset.tab === tabName;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
        panel.style.display = active ? "block" : "none";
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveTab(tab.dataset.tab);
      });
    });

    const initialTab = tabs.some((tab) => tab.dataset.tab === this._activeLegacyTab)
      ? this._activeLegacyTab
      : (root.querySelector(".sheet-tabs .item.active")?.dataset.tab || tabs[0].dataset.tab);
    setActiveTab(initialTab);
  }


  // ---------------------------------------------------------------------------------
  // The Code Below Handles listener creation for the character sheet: (Its messy)

  /** @override */
  activateListeners(html) {
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Portrait image editing (AppV2 has no automatic data-edit handler)
    html.find('img[data-edit]').click(ev => {
      const img = ev.currentTarget;
      const attr = img.dataset.edit;
      const current = foundry.utils.getProperty(this.actor, attr);
      const fp = new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: current,
        callback: path => this.actor.update({ [attr]: path }),
        top: this.position.top + 40,
        left: this.position.left + 10
      });
      fp.browse();
    });

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget);
      const item = this.actor.items.get(li[0].dataset.itemId);
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(async ev => {
      let html = await renderTemplate("systems/woinfoundry/templates/chat/delete.html");
      const actor = this.actor;
      const sheet = this;

      const del = async () => {
        const li = $(ev.currentTarget).parents(".item");
        await actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
        li.slideUp(200, () => sheet.render(false));
      };

      new Dialog({
        title: "Please Confirm",
        content: html,
        buttons: {
          delete: {
            label: "delete",
            callback: html => { del(); }
          },
          back: {
            label: "back",
            callback: html => { }
          }
        },
        default: "back"
      }, null).render(true);
    });

    // Setting up progress bar overflow:
    const carryBar = html.find(".carry-bar")[0];
    if (carryBar) {
      const max = carryBar.max;
    }

    // Handling Effects:
    html.find(".manage-effect").click(ev => {
      this.manageEffect(ev);
    });

    // Handling Auto-Calculate Buttons:
    html.find(".auto-calculate.movement").click(ev => {
      this.calculateMovement();
    });

    // Ensure actor-level sheet fields persist reliably in v2 sheets.
    html.find("input[name], select[name], textarea[name]").change(async ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const field = ev.currentTarget;
      if (!field.closest(".character-sheet")) return;
      if (field?.readOnly) return;
      const path = field?.name;
      if (!path) return;
      if (!path.startsWith("system.") && path !== "name") return;

      const rawValue = `${field.value ?? ""}`.trim();
      const currentValue = foundry.utils.getProperty(this.actor, path);
      const dtype = `${field.dataset?.dtype ?? ""}`.toLowerCase();
      const inputType = `${field.type ?? ""}`.toLowerCase();
      const isNumericPath = /^system\.(attributes\.[^.]+\.value|health\.(value|max|min)|luck\.(value|max|min)|power\.(value|max|min)|movement\.(speed|climb|swim|jumpH|jumpV|highG|lowG|zeroG)|defense\.(melee|ranged|mental|vital)|details\.(carry_increment|shadow)|credits|advancement\.(grade|dice_cap)|initiative\.mod)$/.test(path);
      const shouldBeNumber = dtype === "number" || inputType === "number" || typeof currentValue === "number" || isNumericPath;
      const parsed = Number(rawValue);
      const value = shouldBeNumber ? (Number.isFinite(parsed) ? parsed : 0) : rawValue;
      const isCarryOrShadow = path === "system.details.carry_increment" || path === "system.details.shadow";

      if (isCarryOrShadow && shouldBeNumber && rawValue !== "" && !Number.isFinite(parsed)) {
        const label = path.endsWith("shadow") ? "Shadow" : "Carry Increment";
        ui.notifications.warn(`${label} must be a finite number. Value reset to 0.`);
      }

      await this.actor.update({ [path]: value });
    });

    // Handling Updates to Skills:
    html.find(".skills-value").change(ev => { this.updateSkill(ev); });
    html.find(".skill-create").click(ev => { this.onClickSkillControl(ev, "create"); });
    html.find(".skill-delete").click(ev => { this.onClickSkillControl(ev, "delete"); });

    html.find(".exploit-delete").click(ev => { this.onClickExploitControl(ev, "delete"); });

    // Handling Modifiers:
    html.find(".add_modifier").click(ev => { this.addModifier(ev); });
    html.find(".remove_modifier").click(ev => { this.removeModifier(ev); });
    html.find(".modifier_value").change(ev => { this.updateModifier(ev); });

    // Adding new Items:
    html.find(".item-add").click(ev => {
      const item = { name: "new item", type: "item" };
      this.actor.createEmbeddedDocuments("Item", [item], { renderSheet: false });
    });

    // Flipping Item Equipped State:
    html.find(".item-equip").click(async ev => {
      ev.preventDefault();

      const dataset = ev.currentTarget.dataset;
      const item = this.actor.items.get(dataset.itemId);

      await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.equipped": !item.system.equipped }]);
    });

    // Flipping Item Carried State:
    html.find(".item-carry").click(async ev => {
      ev.preventDefault();

      const dataset = ev.currentTarget.dataset;
      const item = this.actor.items.get(dataset.itemId);

      await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.carried": !item.system.carried, "system.equipped": false }]);
    });

    // Adding new Exploits:
    html.find(".exploit-add").click(ev => {
      const item = { name: "new item", type: "exploit" };
      this.actor.createEmbeddedDocuments("Item", [item], { renderSheet: false });
    });

    //Handling Equipment/Exploit Expansion:
    html.find(".description-show").hover((ev) => {
      let target = $(ev.target);
      target.closest(".description-show").css("border", "1px solid var(--invertcyan)");
      target.closest(".description-show").css("background-color", "var(--invertcyan)");
      target.closest(".description-show").css("color", "var(--cyan)");
    }, (ev) => {
      let target = $(ev.target);
      target.closest(".description-show").css("border", "")
      target.closest(".description-show").css("background-color", "");
      target.closest(".description-show").css("color", "");
    });

    html.find(".description-show").click((ev) => {
      let stop = false;
      $(ev.target).attr("class").split(' ').forEach(element => {
        if (["item-open", "exploit-open", "item-button", "exploit-delete", "delete", "edit", "ignoreclick"].includes(element)) { stop = true; }
      });
      if (stop) return;
      try {
        let target;
        if ($(ev.target).attr("class").includes("description-show")) {
          target = $(ev.target).next().filter(".item-description");
        } else {
          target = $(ev.target).parent().next().filter(".item-description");
        }
        target.toggle();
        let item = foundry.utils.duplicate(this.actor.items.get(target.data().itemId));
        if (item.system.open == null) item.open = true;
        item.system.open = !item.system.open;
        this.actor.items.get(target.data().itemId).update(item);
      } catch (error) {
        console.error("WOIN | actor-sheet.js: Error toggling item description:", error);
      }

    });

    html.find(".item-open").click((ev) => {
    });

    // Handling updates to Combat Tab:
    html.find(".combat-skill input").change(async ev => {
      ev.preventDefault();

      const dataset = ev.currentTarget.dataset;
      const itemId = dataset.itemId ?? dataset.itemid;
      const item = this.actor.items.get(itemId);
      if (!item) {
        console.error("WOIN | actor-sheet.js combat-skill change: missing item", { itemId, dataset });
        return;
      }
      const input = (ev.currentTarget.value);

      if (item.system.skill != input) {
        await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.skill": input }]);
      }
    });

    //Handling Item Drag&Drop
    const draggables = document.querySelectorAll('.woin .draggable');
    const containers = document.querySelectorAll('.woin .container');

    html.find('.display-to-chat').click(async ev => {
      const title = foundry.utils.escapeHTML(`${$(ev.currentTarget).data("title") || "Info"}`);
      const rawDescription = `${$(ev.currentTarget).data("description") || ""}`;
      const content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, { async: true });
      let chatData = {
        user: game.user.id,
        content: `<div class="woin-chat-body">${content}</div>`,
        flavor: `<div class="woin-chat-flavor woin-chat-flavor--info"><div class="woin-chat-flavor__title">${title}</div></div>`
      };
      chatData.speaker = ChatMessage.getSpeaker({ user: game.user });
      ChatMessage.create(chatData);
    });

    html.find(".item").each((_i, sortable) => {
      sortable.addEventListener("dragstart", (e) => this._onDragStart.call(this, e), false);
    });


    //Handling Updates to Exploits:

    //Handling Updates to Advancement:
    html.find(".advancement-input").change(ev => {
      this.updateAdvancement(ev);
    });
    html.find(".advancement-add-gain").click(() => this._modifyAdvancementArray("xp_gain", "add"));
    html.find(".advancement-add-spend").click(() => this._modifyAdvancementArray("xp_spent", "add"));
    html.find(".advancement-remove-gain").click(ev => this._modifyAdvancementArray("xp_gain", "remove", ev.currentTarget.dataset.index));
    html.find(".advancement-remove-spend").click(ev => this._modifyAdvancementArray("xp_spent", "remove", ev.currentTarget.dataset.index));

    // Inputs highlight on click:
    html.find(".sheet-global input, .tab.advancement input, .tab.combat input, .tab.skills input").click(ev => {
      ev.currentTarget.select();
    });

    //Handling Rollables:
    html.find('.rollable-general, .rollable-attack').hover(ev => {
      const li = $(ev.target);
      li.css({ "color": "var(--invertcyan)" });
    }, (ev) => {
      const li = $(ev.target);
      li.css({ "color": "" });
    });
    html.find('.rollable').click(ev => {
      const li = (ev.target);
      const description = li.attributes['data-description'].value;
      let gradecapped = li.attributes['data-gradecapped-formula'].value.split('+');
      gradecapped = gradecapped.reduce((a, b) => {
        return +a + +b;
      }, 0);

      const formula = li.attributes['data-formula'].value;
      if (gradecapped > this.actor.system.advancement.dice_cap) {
        gradecapped = this.actor.system.advancement.dice_cap;
      }
      gradecapped += "d6";

      DiceWOIN.roll({ parts: ["0", formula.replace("+0+", "").replace("+0", "").replace("0+", ""), gradecapped].filter((n) => { return n != 0 && n != "0d6" && n != "0" && n != "+0" && n != "0+" && n != "+0+" }), sender: this.actor, flavor: description });
    });
    html.find('.rollable-attack').click(ev => {
      const li = (ev.target);
      const description = li.attributes['data-description'].value;
      const item = li.attributes['data-itemid'].value;
      const actor = li.attributes['data-actorid'].value;
      const bonusAttack = li.attributes['data-bonus-attack'] ? Number(li.attributes['data-bonus-attack'].value) : 0;
      DiceWOIN.rollAttack({
        description: description,
        itemId: item,
        actorId: actor,
        bonusAttackOverride: Number.isFinite(bonusAttack) ? bonusAttack : 0
      });
    });
    html.find('.rollable-general').click(ev => {
      const li = (ev.target);
      const description = li.attributes['data-description'].value;
      const attribute_dice = (li.attributes['data-attribute-dice']) ? li.attributes['data-attribute-dice'].value : 0;
      const skill_dice = (li.attributes['data-skill-dice']) ? li.attributes['data-skill-dice'].value : 0;
      const actor = li.attributes['data-actorid'].value;
      const constant1 = li.attributes['data-constant1'] ? li.attributes['data-constant1'].value : 0;
      const constant2 = li.attributes['data-constant2'] ? li.attributes['data-constant2'].value : 0;
      DiceWOIN.rollGeneral({
        description: description,
        attribute_dice: attribute_dice,
        constant: Number(constant1) + Number(constant2),
        skill_dice: skill_dice,
        actorId: actor
      });
    });


    // Updating Items:
    this.actor.items.forEach(item => {
      if (item.type === "item") {
        //console.log("WOIN | actor-sheet.js activateListeners item ", item);
        if (typeof item.system.carried === 'undefined') {
          item.update({ "system.carried": true });
        }
      }
    });
  }

  // ================================================================================



  // Auto Calculations:
  async calculateMovement() {
    let html = await renderTemplate("systems/woinfoundry/templates/chat/confirmation.html");

    //console.log("WOIN | actor-sheet.js calculateMovement strength obj:",game.actors.get(this.actor.id).system.attributes.strength);

    function calc(originalActor) {
      let actor = foundry.utils.duplicate(originalActor);
      let data = actor.system;
      let movement = data.movement;
      let attributes = data.attributes;
      let running = 0;
      let climbing = 0;
      let swimming = 0;
      let zerog = 0;
      let highg = 0;
      let lowg = 0;
      //console.log("WOIN | actor-sheet.js calculateMovement calc attributes ", attributes);

      actor.items.forEach(item => {
        if (item.type == "skill") {
          switch (item.name.toLowerCase()) {
            case "running":
              running = item.system.pool;
              //console.log("WOIN | actor-sheet.js calculateMovement calc running ", running);
              break;
            case "climbing":
              climbing = item.system.pool;
              break;
            case "swimming":
              swimming = item.system.pool;
              break;
            case "zero-g":
              zerog = item.system.pool;
              break;
            case "high-g":
              highg = item.system.pool;
              break;
            case "low-g":
              lowg = item.system.pool
              break;
          }
        }
      });
      //console.log("WOIN | actor-sheet.js calculateMovement calc actor.items ", actor.items);

      let base_speed = attributes.agility.dice + attributes.strength.dice;
      //console.log("WOIN | actor-sheet.js calculateMovement calc base_speed ",base_speed);
      movement.speed = base_speed + running;

      if (data.details.size && (data.details.size.includes("small") || data.details.size.includes("tiny"))) {
        movement.speed = Math.max(movement.speed - 1, 0);
      }
      movement.highG = Math.ceil((base_speed + highg) / 2);
      movement.lowG = Math.ceil((base_speed + lowg) / 2);
      movement.zeroG = Math.ceil((base_speed + zerog) / 2);
      movement.swim = Math.ceil((base_speed + swimming) / 2);
      movement.climb = Math.ceil((base_speed + climbing) / 2);

      movement.jumpH = attributes.agility.value * 2;
      movement.jumpV = attributes.strength.value;
      if (movement.jumpV > movement.jumpH) { movement.jumpV = movement.jumpH; }

      actor.system.movement = movement;
      originalActor.update(actor);

      // (In Squares) Speed: Strength DP + AGI DP + Running DP

      // Climbing, Swimming, Zero-G and High-G Replace Running Skill and Halve FINAL total

      // Small or Smaller suffer -1 to SPEED

      // Round Up

      // (In Feet) Jump:
      // Horizontal = 2 * AGI ATTR
      // Vertical = STR ATTR, NOT EXCEED Horizontal
    }

    new Dialog({
      title: "Please Confirm",
      content: html,
      buttons: {
        yes: {
          label: "yes",
          callback: html => { calc(game.actors.get(this.actor.id)) }
        },
        no: {
          label: "no",
          callback: html => { }
        }
      },
      default: "no"
    }, null).render(true);
  }



  // ---------------------------------------------------------------------------------
  // The Code Below Handles Deletion and Addition of items to
  // exploit-rows(items/exploits) and skills:

  async deleteItem(event, actor) {
    const html = await foundry.applications.handlebars.renderTemplate("systems/woinfoundry/templates/chat/delete.html");
    const activeTab = this._activeLegacyTab ?? this.element?.querySelector(".sheet-tabs .item.active")?.dataset?.tab ?? null;

    const performDelete = async () => {
      const li = $(event.currentTarget);
      const exploit = li.data().exploitcode || li.data().skillcode;
      if (!exploit) {
        ui.notifications.error("Unable to delete item: missing item id.");
        return;
      }

      if (activeTab) this._activeLegacyTab = activeTab;
      await actor.deleteEmbeddedDocuments("Item", [exploit]);
      await this.render(true);
    };

    await foundry.applications.api.DialogV2.wait({
      window: { title: "Please Confirm" },
      classes: ["woin", "roll-dialog-app"],
      content: html,
      buttons: [
        { action: "delete", label: "delete", callback: async () => performDelete() },
        { action: "back", label: "back", default: true }
      ],
      rejectClose: false
    });
  }

  async onClickExploitControl(event, task) {
    event.preventDefault();
    const a = event.currentTarget;

    if (task === "delete") {
      this.deleteItem(event, this.actor);
    }
  }

  async onClickSkillControl(event, task) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new attribute
    if (task === "create") {
      const item = { type: "skill", name: "newskill" };
      this.actor.createEmbeddedDocuments("Item", [item]);
    }

    // Remove existing attribute
    else if (task === "delete") {
      this.deleteItem(event, this.actor);
    }
  }

  // ================================================================================


  async manageEffect(event) {
    event.preventDefault();

    const action = event.currentTarget.dataset.action;

    const effectId = event.currentTarget.dataset.id;

    if (action != "add" && effectId == null) {
      //console.log("WOIN | actor-sheet.js manageEffect Effect was null.");
      return
    }

    let effect;
    if (effectId != null) {
      effect = this.actor.effects.get(effectId);
    }

    switch (action) {
      case "add":
        //console.log("WOIN | actor-sheet.js manageEffect adding new effect");
        await ActiveEffect.create({
          name: "New Effect",
          icon: "icons/svg/aura.svg",
          origin: this.actor.uuid,
          disabled: false,
          changes: [],
          description: ""
        }, { parent: this.actor });
        break;
      case "edit":
        //console.log("WOIN | actor-sheet.js manageEffect editing existing effect with ID ", effectId);
        effect.sheet.render(true);
        break;
      case "delete":
        //console.log("WOIN | actor-sheet.js manageEffect removing existing effect with ID ", effectId);
        effect.delete();
        break;
      case "toggle":
        //console.log("WOIN | actor-sheet.js manageEffect toggling existing effect with ID ", effectId);
        return effect.update({ disabled: !effect.disabled });
        break;
      default:
        //console.log("WOIN | actor-sheet.js manageEffect the specified effect action is not supported. Please use add/edit/delete.");
        break;
    }
  }


  // ---------------------------------------------------------------------------------
  // The following is used to keep data values for attributes up to date:

  async updateAttributes(event) {
    event.preventDefault();

    const target = event.currentTarget.dataset.attribute;
    const input = ($(event.currentTarget)[0].value);

    // The pool table maps the number of dice in the attribute's dice pool based on the attribute's value.
    const pool = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]

    let data = foundry.utils.duplicate(this.actor.system);
    let updates = {}
    console.log("WOIN | actor-sheet.js updateAttributes data ", data);

    // Calculating Attribute Dice Pools:
    for (let key in data.attributes) {
      if (key === target && !isNaN(input)) {
        updates[`system.attributes.${key}.value`] = parseInt(input);
        //data.attributes[key].value = parseInt(input);
      }
      let attr = data.attributes[key];

      if (pool[attr.value] != null) {
        updates[`system.attributes.${key}.dice`] = pool[attr.value];
        //data.attributes[key].dice = pool[data.attributes[key].value];
      } else {
        updates[`system.attributes.${key}.dice`] = 0;
        //data.attributes[key].dice = 0;
      }
    };

    // Calculating Luck:
    data.luck.max = data.attributes.luck.dice;
    if (data.luck.value > data.luck.max) {
      updates[`system.luck.value`] = data.luck.max;
      //data.luck.value = data.luck.max;
    }
    if ((data.luck.value < 0) || (!data.luck.value)) {
      updates[`system.luck.value`] = 0;
      //data.luck.value = 0;
    }
    if (data.power.value > data.power.max) {
      updates[`system.power.value`] = data.power.max;
      //data.power.value = data.power.max;
    }
    if ((data.power.value < 0) || (!data.power.value)) {
      updates[`system.power.value`] = 0;
      //data.power.value = 0;
    }

    await this.actor.update({ updates });
    console.log("WOIN | actor-sheet.js updateAttributes updates ", this.actor.id, updates);
  }

  // ================================================================================
  // ---------------------------------------------------------------------------------
  // The following Is used to keep data values for skills and advancement up to date:
  async updateSkill(ev) {
    ev.preventDefault();

    //console.log("WOIN | actor-sheet.js updateSkill woo");

    const dataset = ev.currentTarget.dataset;
    const item = this.actor.items.get(dataset.itemId);
    const input = ($(ev.currentTarget)[0].value);
    const binding = dataset.binding;

    if (!item) {
      return;
    }
    if (!binding) {
      return;
    }

    const previousValue = foundry.utils.getProperty(item, binding);
    const parsedInput = binding === "system.score" ? Number(input) : input;
    if (previousValue === parsedInput) {
      return;
    }
    const updates = { [binding]: parsedInput };
    const data = foundry.utils.duplicate(item.system);
    if (binding.startsWith("system.")) {
      foundry.utils.setProperty(data, binding.replace(/^system\./, ""), parsedInput);
    }

    const pool = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8];
    const actorData = this.actor.system;
    const attributeDice = actorData.attributes?.[data.attribute]?.dice ?? 0;
    let score = Number(data.score) || 0;
    score = Math.max(0, Math.min(pool.length - 1, score));

    updates["system.score"] = score;
    updates["system.pool"] = pool[score];
    updates["system.gradepool"] = attributeDice;

    await item.update(updates);
  }


  _modifyAdvancementArray(arrayKey, action, index = null) {
    const actor = foundry.utils.duplicate(this.actor);
    const arr = actor.system.advancement[arrayKey];
    if (action === "add") {
      arr.push({ name: "default", value: 0 });
    } else if (action === "remove" && index != null) {
      arr.splice(index, 1);
    }
    this.actor.update(actor);
  }

  updateAdvancement(ev) {
    const target = ev.currentTarget;
    const data = target.dataset;
    const index = data.index;
    const key = data.key;
    console.log("WOIN | actor-sheet.js updateAdvancement data ", data);

    let actor = foundry.utils.duplicate(this.actor); //For manipulating actor.system.advancement
    switch (key) {
      case "spent_name":
        actor.system.advancement.xp_spent[index].name = target.value;
        break;
      case "spent_xp":
        actor.system.advancement.xp_spent[index].value = target.value;
        break;
      case "gain_name":
        actor.system.advancement.xp_gain[index].name = target.value;
        break;
      case "gain_xp":
        actor.system.advancement.xp_gain[index].value = target.value;
        break;
      default:
        break;
    }
    this.actor.update(actor);
  }

  // ================================================================================

}
