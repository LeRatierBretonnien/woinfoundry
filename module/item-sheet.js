/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;

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
    return {
      ...context,
      item,
      system: item.system,
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

    setActiveTab(root.querySelector(".sheet-tabs .item.active")?.dataset.tab || tabs[0].dataset.tab);
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

  async _syncDynamicArrays() {
    if (!this.document) return;

    const damageType = this.document.system.weapon?.damagetype ?? [];
    const ineffective = this.document.system.armor?.ineffective ?? [];
    const normalizedDamageType = this._normalizeNullableArray(damageType);
    const normalizedIneffective = this._normalizeNullableArray(ineffective);
    const updates = {};

    const arraysEqual = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

    if (!arraysEqual(damageType, normalizedDamageType)) {
      updates["system.weapon.damagetype"] = normalizedDamageType;
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

    html.find(".damage-array").change(async (ev) => {
      const index = Number(ev.currentTarget.dataset.dindex);
      const damagetype = [...(this.document.system.weapon?.damagetype ?? [])];
      damagetype[index] = ev.currentTarget.value || null;
      await this.document.update({
        "system.weapon.damagetype": this._normalizeNullableArray(damagetype)
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
