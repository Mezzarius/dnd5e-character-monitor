const moduleName = "dnd5e-character-monitor";
// Setting CONSTS
let trashIconSetting;
const TEMPLATE_DIR = `modules/${moduleName}/templates`
const ITEM_EQUIP_TEMPLATE = `${TEMPLATE_DIR}/itemEquip.hbs`;
const ITEM_ATTUNE_TEMPLATE = `${TEMPLATE_DIR}/itemAttune.hbs`;
const SPELL_PREPARE_TEMPLATE = `${TEMPLATE_DIR}/spellPrepare.hbs`;
const FEAT_USES_TEMPLATE = `${TEMPLATE_DIR}/featUses.hbs`;
const SPELL_SLOTS_TEMPLATE = `${TEMPLATE_DIR}/spellSlots.hbs`;
const RESOURCE_USES_TEMPLATE = `${TEMPLATE_DIR}/resourceUses.hbs`;
const CURRENCY_TEMPLATE = `${TEMPLATE_DIR}/currency.hbs`;
const PROFICIENCY_TEMPLATE = `${TEMPLATE_DIR}/proficiency.hbs`;
const ABILITY_TEMPLATE = `${TEMPLATE_DIR}/ability.hbs`;

Hooks.once("setup", async () => {
    console.log(`${moduleName} | Initializing`);

    await loadTemplates([ITEM_EQUIP_TEMPLATE, ITEM_ATTUNE_TEMPLATE, SPELL_PREPARE_TEMPLATE, FEAT_USES_TEMPLATE, SPELL_SLOTS_TEMPLATE, RESOURCE_USES_TEMPLATE]);

    // Open module API
    window.CharacterMonitor = CharacterMonitor;

    // Register module settings
    window.CharacterMonitor.registerSettings();

    // Determine module setting states
    trashIconSetting = game.settings.get(moduleName, "trashIcon");

    // Register init hooks
    window.CharacterMonitor.registerInitHooks();
});

Hooks.once("ready", () => {
    window.CharacterMonitor.registerReadyHooks();
});


class CharacterMonitor {

    // Settings --------
    static registerSettings() {
        game.settings.registerMenu(moduleName, "cmColorsMenu", {
            name: game.i18n.localize("characterMonitor.settings.cmColorsMenu.name"),
            label: game.i18n.localize("characterMonitor.settings.cmColorsMenu.label"),
            icon: "fas fa-palette",
            type: CharacterMonitorColorMenu,
            restricted: true
        });
        game.settings.register(moduleName, "cmColors", {
            name: "Character Monitor Colors",
            hint: "",
            scope: "world",
            type: Object,
            default: {
                on: "#06a406",
                off: "#c50d19",
                slots: "#b042f5",
                feats: "#425af5",
                currency: "#b59b3c",
                proficiency: "#37908a",
                ability: "#37908a"
            },
            config: false,
            onChange: debounce(CharacterMonitor.setCssVariables, 500)
        });


        game.settings.register(moduleName, "monitorEquip", {
            name: game.i18n.localize("characterMonitor.settings.monitorEquip.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorEquip.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorAttune", {
            name: game.i18n.localize("characterMonitor.settings.monitorAttune.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorAttune.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorSpellPrep", {
            name: game.i18n.localize("characterMonitor.settings.monitorSpellPrep.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorSpellPrep.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorSpellSlots", {
            name: game.i18n.localize("characterMonitor.settings.monitorSpellSlots.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorSpellSlots.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorFeats", {
            name: game.i18n.localize("characterMonitor.settings.monitorFeats.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorFeats.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorResources", {
            name: game.i18n.localize("characterMonitor.settings.monitorResources.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorResources.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorCurrency", {
            name: game.i18n.localize("characterMonitor.settings.monitorCurrency.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorCurrency.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorProficiency", {
            name: game.i18n.localize("characterMonitor.settings.monitorProficiency.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorProficiency.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "monitorAbility", {
            name: game.i18n.localize("characterMonitor.settings.monitorAbility.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorAbility.hint"),
            scope: "world",
            type: Boolean,
            default: true,
            config: true
        });

        game.settings.register(moduleName, "showGMonly", {
            name: game.i18n.localize("characterMonitor.settings.showGMonly.name"),
            hint: game.i18n.localize("characterMonitor.settings.showGMonly.hint"),
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: debounce(CharacterMonitor.setCssVariables, 500)
        });

        game.settings.register(moduleName, "allowPlayerView", {
            name: game.i18n.localize("characterMonitor.settings.allowPlayerView.name"),
            hint: game.i18n.localize("characterMonitor.settings.allowPlayerView.hint"),
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: debounce(CharacterMonitor.setCssVariables, 500)
        });

        game.settings.register(moduleName, "showToggle", {
            name: game.i18n.localize("characterMonitor.settings.showToggle.name"),
            hint: game.i18n.localize("characterMonitor.settings.showToggle.hint"),
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: async () => {
                if (!game.user.isGM) return;

                await game.settings.set(moduleName, "cmToggle", true);
                setTimeout(() => window.location.reload(), 500);
            }
        });

        game.settings.register(moduleName, "trashIcon", {
            name: game.i18n.localize("characterMonitor.settings.trashIcon.name"),
            hint: "",
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: () => setTimeout(() => window.location.reload(), 500)
        });

        game.settings.register(moduleName, "showPrevious", {
            name: "Show Previous Values",
            hint: "",
            scope: "world",
            type: Boolean,
            default: false,
            config: true

        });

        game.settings.register(moduleName, "cmToggle", {
            name: "Toggle Character Monitor",
            hint: "",
            scope: "world",
            type: Boolean,
            default: true,
            config: false
        });

        Hooks.on("renderSettingsConfig", (settingsConfig, html, user) => {
            const formGroups = html.find('div.form-group');

          	// Disable the player view setting if GM-only mode is disabled.
		    const playerViewDiv = formGroups.has(`:checkbox[name="${moduleName}.allowPlayerView"]`);
		    CharacterMonitor.toggleDivs(playerViewDiv, game.settings.get(moduleName, "showGMonly"));

            // Handle the showGMonly checkbox being toggled.
            const showGMonlyCheckbox = formGroups.find(`:checkbox[name="${moduleName}.showGMonly"]`);
            showGMonlyCheckbox.change((event) => {
                CharacterMonitor.toggleDivs(playerViewDiv, event.target.checked);
            });
        });

        CharacterMonitor.setCssVariables();
    }

    // Enable / disable inputs in a set of divs.
	static toggleDivs(divs, enabled) {
		const inputs = divs.find("input,select");
		const labels = divs.find("label>span");

		// Disable all inputs in the divs (checkboxes and dropdowns)
		inputs.prop("disabled", !enabled);
		// Disable TidyUI's on click events for the labels.
		labels.css("pointer-events", enabled ? "auto" : "none");
	}

    static setCssVariables() {
        const root = document.querySelector(':root');
        const colors = game.settings.get(moduleName, "cmColors");
        root.style.setProperty('--dnd5e-cm-on', colors.on);
        root.style.setProperty('--dnd5e-cm-off', colors.off);
        root.style.setProperty('--dnd5e-cm-feats', colors.feats);
        root.style.setProperty('--dnd5e-cm-slots', colors.slots);
        root.style.setProperty('--dnd5e-cm-currency', colors.currency);
        root.style.setProperty('--dnd5e-cm-proficiency', colors.proficiency);
        root.style.setProperty('--dnd5e-cm-ability', colors.ability);

        const showGmOnly = game.settings.get(moduleName, "showGMonly");
        const allowPlayerView = game.settings.get(moduleName, "allowPlayerView");

        const display = ((showGmOnly && !game.user.isGM && !allowPlayerView) ? 'none' : 'flex');
        root.style.setProperty('--dnd5e-cm-display', display);
    }

    // Hooks --------
    static registerInitHooks() {

        // Add control toggle to enable/disable Character Monitor
        if (game.settings.get(moduleName, "showToggle")) {
            Hooks.on("getSceneControlButtons", controls => {

                const bar = controls.find(c => c.name === "token");
                bar.tools.push({
                    name: "Character Monitor",
                    title: game.i18n.localize("characterMonitor.control.title"),
                    icon: "fas fa-exchange-alt",
                    visible: game.user.isGM,
                    toggle: true,
                    active: game.settings.get(moduleName, "cmToggle"),
                    onClick: async toggled => await game.settings.set(moduleName, "cmToggle", toggled)
                });
            });
        }

        // Apply custom CSS to Character Monitor chat messages
        Hooks.on("renderChatMessage", (app, html, data) => {
            const flags = data?.message?.flags[moduleName];
            if (!flags) return;

            if ("equip" in flags) {
                html.addClass(`dnd5e-cm-message dnd5e-cm-${flags.equip ? "on" : "off"}`);
            } else if ("feat" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-feats");
            } else if ("slot" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-slots");
            } else if ("currency" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-currency");
            } else if ("proficiency" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-proficiency");
            } else if ("ability" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-ability");
            }

            // Optionally add trash icon
            if (trashIconSetting && game.user.isGM) {
                html.find('div.dnd5e-cm-content').append('<span class="dnd5e-cm-trash"><a class="button message-delete"><i class="fas fa-trash"></i></a></span>');
            }
        });
    }

    static registerReadyHooks() {
        // Equipment, Spell Preparation, and Feature changes
        Hooks.on("preUpdateItem", async (item, data, options, userID) => {
            // If owning character sheet is not open, then change was not made via character sheet, return
            //if (Object.keys(item.parent?.apps || {}).length === 0) return;

            // If item owner is not a PC, return // Potentially change this to be depenent on setting if NPCs should be monitored
            if (item.parent?.type !== "character") return;

            // If Character Monitor disabled via control toggle, return
            if (!game.settings.get(moduleName, "cmToggle")) return;

            // Get currently monitored changes
            const monitoredChangesDict = {};
            for (const monitor of ["monitorEquip", "monitorSpellPrep", "monitorFeats", "monitorAttune"]) {
                monitoredChangesDict[monitor] = game.settings.get(moduleName, monitor);
            }

            // Parse changes
            const isEquip = monitoredChangesDict["monitorEquip"] && (item.type === "equipment" || item.type === "weapon") && "equipped" in (data.system || {});
            const isSpellPrep = monitoredChangesDict["monitorSpellPrep"] && item.type === "spell" && "prepared" in (data?.system?.preparation || {});
            const isFeat = monitoredChangesDict["monitorFeats"] && item.type === "feat" && ("value" in (data?.system?.uses || {}) || "max" in (data?.system?.uses || {}));
            const isAttune = monitoredChangesDict["monitorAttune"] && (item.type === "equipment" || item.type === "weapon") && "attunement" in (data.system || {});

            if (!(isEquip || isSpellPrep || isFeat || isAttune)) return;

            // If "showGMonly" setting enabled, whisper to all owners (this includes the GM).
            // Players may or may not actually see the message depending on the allowPlayerView setting.
            // Potentially change this to be depenent on setting if NPCs should be monitored (See health-monitor.js line 213)
            const whisper = game.settings.get(moduleName, "showGMonly")
                ? game.users.filter(u => item.parent.testUserPermission(u, CONST.DOCUMENT_PERMISSION_LEVELS.OWNER)).map(u => u.id)
                : null;

            // Prepare common content for handlebars templates
            const hbsData = {
                characterName: item.parent.name,
                itemName: item.name
            };

            if (isEquip) {
                hbsData.equipped = data.system.equipped;
                renderTemplate(ITEM_EQUIP_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { equip: data.system.equipped } }
                    });
                });
            }

            if (isSpellPrep) {
                hbsData.prepared = data.system.preparation.prepared;
                renderTemplate(SPELL_PREPARE_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { equip: data.system.preparation.prepared } }
                    });
                });
            }

            if (isFeat) {
                const newUses = data.system.uses;
                const oldUses = item.system.uses;
                const hasValue = ("value" in newUses);
                const hasMax = ("max" in newUses);
                if (!hasValue && !hasMax) return;

                // Ignore any updates that attempt to change values between zero <--> null.
                const isValueUnchanged = (!hasValue || (!newUses.value && !oldUses.value));
                const isMaxUnchanged = (!hasMax || (!newUses.max && !oldUses.max));
                if (isValueUnchanged && isMaxUnchanged) return;

                // Determine if update was initiated by item being rolled, or a rest
                checkSecondHooks({ itemId: item.id }).then(async (didFire) => {
                    if (didFire) return;

                    hbsData.uses = {
                        value: (hasValue ? newUses.value : oldUses.value) || 0,
                        max: (hasMax ? newUses.max : oldUses.max) || 0
                    };
                    if (game.settings.get(moduleName, "showPrevious")) hbsData.uses.old = oldUses.value;
                    const content = await renderTemplate(FEAT_USES_TEMPLATE, hbsData);

                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { feat: true } }
                    });
                });
            }

            if (isAttune && (CONFIG.DND5E.attunementTypes.NONE !== data.system.attunement)) {
                hbsData.attuned = (CONFIG.DND5E.attunementTypes.ATTUNED === data.system.attunement);
                renderTemplate(ITEM_ATTUNE_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { equip: hbsData.attuned } }
                    });
                });
            }
        });

        // Spell Slot, Resource, Currency, Proficiency, Ability changes
        Hooks.on("preUpdateActor", async (actor, data, options, userID) => {
            if (actor.type !== "character") return;

            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];

            const hbsData = {
                characterName: actor.name
            };

            // Spell Slot changes
            if (game.settings.get(moduleName, "monitorSpellSlots") && ("spells" in (data.system || {}))) {
                for (const [spellLevel, newSpellData] of Object.entries(data.system.spells)) {
                    const oldSpellData = actor.system.spells[spellLevel];
                    const hasValue = ("value" in newSpellData);
                    const hasMax = ("override" in newSpellData) || ("max" in newSpellData);
                    if (!hasValue && !hasMax) continue;

                    const newMax = newSpellData.override ?? newSpellData.max;

                    // Ignore any updates that attempt to change values between zero <--> null.
                    const isValueUnchanged = (!hasValue || (!newSpellData.value && !oldSpellData.value));
                    const isMaxUnchanged = (!hasMax || (!newMax && !oldSpellData.max));
                    if (isValueUnchanged && isMaxUnchanged) continue;

                    const levelNum = parseInt(spellLevel.slice(-1));

                    // Determine if update was initiated by item being rolled, or a rest.
                    checkSecondHooks({ spellLevel: levelNum }).then(async (didFire) => {
                        if (didFire) return;

                        hbsData.spellSlot = {
                            label: CONFIG.DND5E.spellLevels[levelNum],
                            value: (hasValue ? newSpellData.value : oldSpellData.value) || 0,
                            max: (newMax ?? oldSpellData.max) || 0
                        }
                        if (game.settings.get(moduleName, "showPrevious")) hbsData.spellSlot.old = oldSpellData.value;
                        const content = await renderTemplate(SPELL_SLOTS_TEMPLATE, hbsData);

                        await ChatMessage.create({
                            content,
                            whisper,
                            flags: { [moduleName]: { slot: levelNum } }
                        });
                    });
                }
            }

            // Resource changes
            if (game.settings.get(moduleName, "monitorResources") && ("resources" in (data.system || {}))) {
                for (const [resource, newResourceData] of Object.entries(data.system.resources)) {
                    const hasValue = ("value" in newResourceData);
                    const hasMax = ("max" in newResourceData);
                    if (!hasValue && !hasMax) continue;

                    const oldResourceData = actor.system.resources[resource];

                    // Ignore any updates that attempt to change values between zero <--> null.
                    const isValueUnchanged = (!hasValue || (!newResourceData.value && !oldResourceData.value));
                    const isMaxUnchanged = (!hasMax || (!newResourceData.max && !oldResourceData.max));
                    if (isValueUnchanged && isMaxUnchanged) continue;

                    // Determine if update was initiated by item being rolled, or a rest.
                    checkSecondHooks({ resourceName: resource }).then(async (didFire) => {
                        if (didFire) return;

                        hbsData.resource = {
                            label: oldResourceData.label || resource,
                            value: (hasValue ? newResourceData.value : oldResourceData.value) || 0,
                            max: (hasMax ? newResourceData.max : oldResourceData.max) || 0
                        };
                        if (game.settings.get(moduleName, "showPrevious")) hbsData.resource.old = oldResourceData.value;
                        const content = await renderTemplate(RESOURCE_USES_TEMPLATE, hbsData);

                        await ChatMessage.create({
                            content,
                            whisper,
                            flags: { [moduleName]: { feat: true } }
                        });
                    });
                }
            }
            
            // Currency changes
            if (game.settings.get(moduleName, "monitorCurrency") && ("currency" in (data.system || {}))) {
                for (const [currency, newValue] of Object.entries(data.system.currency)) {
                    const oldValue = actor.system.currency[currency];

                    // Ignore any updates that attempt to change values between zero <--> null.;
                    if (newValue === null || newValue == oldValue) continue;

                    hbsData.currency = {
                        label: currency,
                        value: newValue
                    };
                    if (game.settings.get(moduleName, "showPrevious")) hbsData.currency.old = oldValue;
                    const content = await renderTemplate(CURRENCY_TEMPLATE, hbsData);

                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { currency: true } }
                    });
                }
            }

            // Proficiency changes
            if (game.settings.get(moduleName, "monitorProficiency") && ("skills" in (data.system || {}))) {
                for (const [skl, changes] of Object.entries(data.system.skills)) {
                    if (!("value" in changes)) continue;
                    if (typeof changes.value !== "number") continue;

                    hbsData.proficiency = {
                        label: CONFIG.DND5E.skills[skl],
                        value: CONFIG.DND5E.proficiencyLevels[changes.value]
                    };
                    const content = await renderTemplate(PROFICIENCY_TEMPLATE, hbsData);

                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { proficiency: true } }
                    });
                }
            }

            // Ability changes
            if (game.settings.get(moduleName, "monitorAbility") && ("abilities" in (data.system || {}))) {
                for (const [abl, changes] of Object.entries(data.system.abilities)) {
                    if (!("value" in changes)) continue;
                    if (typeof changes.value !== "number") continue;

                    const oldValue = actor.system.abilities[abl].value;

                    hbsData.ability = {
                        label: CONFIG.DND5E.abilities[abl],
                        value: changes.value
                    };
                    if (game.settings.get(moduleName, "showPrevious")) hbsData.ability.old = oldValue;
                    const content = await renderTemplate(ABILITY_TEMPLATE, hbsData);

                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { ability: true } }
                    });
                }
            }
        });

        // Party Inventory compatibility
        if (game.modules.get("party-inventory")?.active) {
            Hooks.on("preUpdateSetting", async (setting, data, options, userID) => {
                const whisper = game.settings.get(moduleName, "showGMonly") ?
                    game.users.filter(u => u.isGM).map(u => u.id) : [];

                // Currency changes
                if (setting.data.key === "party-inventory.currency" && game.settings.get(moduleName, "monitorCurrency")) {
                    if (game.user.id !== game.users.find(u => u.active && u.isGM).id) return;

                    const previousCurrency = game.settings.get("party-inventory", "currency");
                    const newCurrency = JSON.parse(data.value);
                    const changes = {};
                    for (const xp of Object.keys(previousCurrency)) {
                        if (previousCurrency[xp] !== newCurrency[xp]) changes[xp] = { old: previousCurrency[xp], new: newCurrency[xp] };
                    }

                    for (const xp of Object.keys(changes)) {
                        const hbsData = {
                            characterName: "Party Inventory",
                            currency: {
                                value: changes[xp].new,
                                label: xp
                            }
                        };
                        if (game.settings.get(moduleName, "showPrevious")) hbsData.currency.old = changes[xp].old;
                        const content = await renderTemplate(CURRENCY_TEMPLATE, hbsData);
                        await ChatMessage.create({
                            content,
                            whisper,
                            flags: { [moduleName]: { currency: true } }
                        });    
                    }
                }
            });
        }
    }

}

class CharacterMonitorColorMenu extends FormApplication {

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Customize Character Monitor Colors",
            template: `/modules/${moduleName}/templates/colorMenu.hbs`
        }
    }

    getData() {
        const settingsData = game.settings.get(moduleName, "cmColors");
        const data = {
            on: {
                color: settingsData.on,
                label: game.i18n.localize("characterMonitor.colorMenu.on")
            },
            off: {
                color: settingsData.off,
                label: game.i18n.localize("characterMonitor.colorMenu.off")
            },
            slots: {
                color: settingsData.slots,
                label: game.i18n.localize("characterMonitor.chatMessage.SpellSlots")
            },
            feats: {
                color: settingsData.feats,
                label: game.i18n.localize("DND5E.Features")
            },
            currency: {
                color: settingsData.currency,
                label: game.i18n.localize("DND5E.Currency")
            },
            proficiency: {
                color: settingsData.proficiency,
                label: game.i18n.localize("DND5E.Proficiency")
            },
            ability: {
                color: settingsData.ability,
                label: game.i18n.localize("DND5E.Ability")
            }
        };

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.on("click", `button[name="reset"]`, () => {
            html.find(`input[name="on"]`).val("#06a406");
            html.find(`input[data-edit="on"]`).val("#06a406");
            html.find(`input[name="off"]`).val("#c50d19");
            html.find(`input[data-edit="off"]`).val("#c50d19");
            html.find(`input[name="slots"]`).val("#b042f5");
            html.find(`input[data-edit="slots"]`).val("#b042f5");
            html.find(`input[name="feats"]`).val("#425af5");
            html.find(`input[data-edit="feats"]`).val("#425af5");
            html.find(`input[name="currency"]`).val("#b59b3c");
            html.find(`input[data-edit="currency"]`).val("#b59b3c");
            html.find(`input[name="proficiency"]`).val("#37908a");
            html.find(`input[data-edit="proficiency"]`).val("#37908a");
            html.find(`input[name="ability"]`).val("#37908a");
            html.find(`input[data-edit="ability"]`).val("#37908a");
        });
    }

    async _updateObject(event, formData) {
        await game.settings.set(moduleName, "cmColors", formData);
    }
}

async function checkSecondHook(secondHookName, { itemId, spellLevel, resourceName, delay = 500 } = {}) {
    let secondHookCalled = false;

    const hookID = Hooks.on(secondHookName, (...args) => {
        if (secondHookName === "preCreateChatMessage") {
            const html = $($.parseHTML(args[1].content));

            if (itemId) {
                secondHookCalled ||= html.is(`[data-item-id="${itemId}"]`);

            } else if (spellLevel) {
                secondHookCalled ||= html.is(`[data-spell-level="${spellLevel}"]`);

            } else if (resourceName) {
                const actor = game.actors.get(args[1].speaker.actor);
                if (!actor) return;

                const item = actor.items.get(html.attr("data-item-id"));
                if (!item) return;

                secondHookCalled ||= (item.system.consume.target === `resources.${resourceName}.value`);

            } else {
                secondHookCalled = true;
            }
        } else {
            secondHookCalled = true;
        }
    });

    await new Promise(resolve => {
        setTimeout(resolve, delay);
    });

    Hooks.off(secondHookName, hookID);

    return secondHookCalled;
}

async function checkSecondHooks(params = {}) {
    const promises = [
        checkSecondHook("preCreateChatMessage", params),
        checkSecondHook("restCompleted", params)
    ];

    const res = await Promise.all(promises);
    return res.includes(true);
}
