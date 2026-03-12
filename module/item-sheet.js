/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_ATTRIBUTE_OPTIONS = [
  "strength",
  "agility",
  "endurance",
  "intuition",
  "logic",
  "willpower",
  "charisma",
  "luck",
  "reputation",
  "psionics",
  "magic",
  "chi"
];

export class SimpleItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["woin", "sheet", "item", "item-sheet"],
    position: {
      width: 520,
      height: 680
    },
    form: {
      handler: SimpleItemSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    },
    window: {
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/woinfoundry/templates/item-sheet.html"
    }
  };

  static async #onSubmitForm(event, form, formData) {
    if (!this.isEditable) return;
    const submitData = this._processFormData(event, form, formData);
    return this._processSubmitData(event, form, submitData);
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    const context = await super._prepareContext();
    const item = this.document;
    const actorAttributes = Object.keys(item.parent?.system?.attributes ?? {});
    const attributeOptions = actorAttributes.length ? actorAttributes : DEFAULT_ATTRIBUTE_OPTIONS;
    return {
      ...context,
      item,
      system: item.system,
      attributeOptions,
      owner: this.isOwner,
      editable: this.isEditable
    };
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element?.querySelector(".sheet-body");
    const bodyHeight = position.height - 192;
    if (sheetBody) {
      sheetBody.style.height = `${bodyHeight}px`;
    }
    return position;
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
        tab.classList.toggle("active", tab.dataset.tab === tabName);
      });
      tabPanels.forEach((panel) => {
        const active = panel.dataset.tab === tabName;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveTab(tab.dataset.tab);
      });
    });

    const preferredTab = tabs.some((tab) => tab.dataset.tab === this._activeLegacyTab)
      ? this._activeLegacyTab
      : (root.querySelector(".sheet-tabs .item.active")?.dataset.tab || tabs[0].dataset.tab);
    setActiveTab(preferredTab);
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._activateLegacyTabs();
    this._syncDynamicArrays();
    this.activateListeners($(this.element));
  }

  _normalizeNullableArray(values = []) {
    const normalized = [...values];
    const hasValue = (value) => value !== null && value !== undefined && `${value}`.trim() !== "";

    if (!normalized.length) normalized.push(null);
    if (hasValue(normalized[normalized.length - 1])) normalized.push(null);
    while (normalized.length > 1 && !hasValue(normalized[normalized.length - 1]) && !hasValue(normalized[normalized.length - 2])) {
      normalized.pop();
    }
    return normalized;
  }

  _collectStringValues(values = []) {
    return values
      .map(value => `${value ?? ""}`.trim())
      .filter(value => value !== "");
  }

  _parseDamageTypeText(text = "") {
    return `${text ?? ""}`
      .split(/[;,/|]+/)
      .map(value => value.trim())
      .filter(value => value !== "");
  }

  async _syncDynamicArrays() {
    if (!this.document) return;

    const damageType = this.document.system.weapon?.damagetype ?? [];
    const damageTypeText = `${this.document.system.weapon?.damagetypetext ?? ""}`;
    const ineffective = this.document.system.armor?.ineffective ?? [];
    const damageTypeValues = this._collectStringValues(damageType);
    const resolvedDamageTypeValues = damageTypeValues.length
      ? damageTypeValues
      : this._parseDamageTypeText(damageTypeText);
    const normalizedDamageType = this._normalizeNullableArray(resolvedDamageTypeValues);
    const normalizedDamageTypeText = resolvedDamageTypeValues.join(", ");
    const normalizedIneffective = this._normalizeNullableArray(ineffective);
    const updates = {};

    const arraysEqual = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

    if (!arraysEqual(damageType, normalizedDamageType)) {
      updates["system.weapon.damagetype"] = normalizedDamageType;
    }
    if (damageTypeText !== normalizedDamageTypeText) {
      updates["system.weapon.damagetypetext"] = normalizedDamageTypeText;
    }
    if (!arraysEqual(ineffective, normalizedIneffective)) {
      updates["system.armor.ineffective"] = normalizedIneffective;
    }
    if (Object.keys(updates).length > 0) {
      await this.document.update(updates);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    if (!this.isEditable) return;

    html.find('select[name="system.attribute"]').change(async (ev) => {
      await this.document.update({ "system.attribute": ev.currentTarget.value });
    });

    html.find('input[name="system.weapon.damagetypetext"]').change(async (ev) => {
      const damageTypeValues = this._parseDamageTypeText(ev.currentTarget.value);
      const normalizedDamageType = this._normalizeNullableArray(damageTypeValues);
      await this.document.update({
        "system.weapon.damagetype": normalizedDamageType,
        "system.weapon.damagetypetext": damageTypeValues.join(", ")
      });
    });
    html.find(".ineffective-array").change(async (ev) => {
      const index = Number(ev.currentTarget.dataset.dindex);
      const ineffective = [...(this.document.system.armor?.ineffective ?? [])];
      ineffective[index] = ev.currentTarget.value || null;
      await this.document.update({
        "system.armor.ineffective": this._normalizeNullableArray(ineffective)
      });
    });
  }
}
