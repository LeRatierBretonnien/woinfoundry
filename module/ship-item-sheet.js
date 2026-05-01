const { HandlebarsApplicationMixin } = foundry.applications.api;

export class SimpleShipItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["woin", "sheet", "item", "ship-item-sheet"],
    position: {
      width: 520,
      height: 520
    },
    form: {
      handler: SimpleShipItemSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    },
    window: {
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/woinfoundry/templates/ship-item-sheet.html"
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
    const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description, { relativeTo: item }
    );
    return {
      ...context,
      item,
      system: item.system,
      fields: item.schema.fields,
      systemFields: item.system.schema.fields,
      owner: this.isOwner,
      editable: this.isEditable,
      enrichedDescription,
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

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.activateListeners($(this.element));
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    if (!this.isEditable) return;

    html.find('img[data-edit]').click(ev => {
      const img = ev.currentTarget;
      const attr = img.dataset.edit;
      const current = foundry.utils.getProperty(this.document, attr);
      const fp = new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: current,
        callback: path => this.document.update({ [attr]: path }),
        top: this.position.top + 40,
        left: this.position.left + 10
      });
      fp.browse();
    });

    // ship_armor soak array management
    html.find(".ship-armor-soak-add").click(async () => {
      const soak = foundry.utils.duplicate(this.document.system.soak ?? []);
      soak.push(["0", ""]);
      await this.document.update({ "system.soak": soak });
    });

    html.find(".ship-armor-soak-remove").click(async ev => {
      const index = Number(ev.currentTarget.dataset.soakIndex);
      const soak = foundry.utils.duplicate(this.document.system.soak ?? []);
      soak.splice(index, 1);
      await this.document.update({ "system.soak": soak });
    });

    html.find(".ship-armor-soak-value").change(async ev => {
      const index = Number(ev.currentTarget.dataset.soakIndex);
      const soak = foundry.utils.duplicate(this.document.system.soak ?? []);
      if (!soak[index]) soak[index] = ["0", ""];
      soak[index][0] = ev.currentTarget.value;
      await this.document.update({ "system.soak": soak });
    });

    html.find(".ship-armor-soak-type").change(async ev => {
      const index = Number(ev.currentTarget.dataset.soakIndex);
      const soak = foundry.utils.duplicate(this.document.system.soak ?? []);
      if (!soak[index]) soak[index] = ["0", ""];
      soak[index][1] = ev.currentTarget.value;
      await this.document.update({ "system.soak": soak });
    });
  }
}
