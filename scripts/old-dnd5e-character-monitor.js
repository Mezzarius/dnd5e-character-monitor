let trashIconSetting;

Hooks.once("setup", async () => {

    // Determine module setting states
    trashIconSetting = game.settings.get(moduleName, "trashIcon");

    // Register init hooks
    window.CharacterMonitor.registerInitHooks();
});

Hooks.once("ready", () => {
    window.CharacterMonitor.registerReadyHooks();
});


class CharacterMonitor {


    // Enable / disable inputs in a set of divs.
	static toggleDivs(divs, enabled) {
		const inputs = divs.find("input,select");
		const labels = divs.find("label>span");

		// Disable all inputs in the divs (checkboxes and dropdowns)
		inputs.prop("disabled", !enabled);
		// Disable TidyUI's on click events for the labels.
		labels.css("pointer-events", enabled ? "auto" : "none");
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
            } else if ("effects" in flags) {
                html.addClass("dnd5e-cm-message dnd5e-cm-effects");
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
            for (const monitor of ["monitorEquip", "monitorQuantity", "monitorSpellPrep", "monitorFeats", "monitorAttune"]) {
                monitoredChangesDict[monitor] = game.settings.get(moduleName, monitor);
            }

            // Parse changes
            const isEquip = monitoredChangesDict["monitorEquip"] && (item.type === "equipment" || item.type === "weapon") && "equipped" in (data.system || {});
            const isQuantity = monitoredChangesDict["monitorQuantity"] && "quantity" in (data.system || {});
            const isSpellPrep = monitoredChangesDict["monitorSpellPrep"] && item.type === "spell" && "prepared" in (data?.system?.preparation || {});
            const isFeat = monitoredChangesDict["monitorFeats"] && item.type === "feat" && ("value" in (data?.system?.uses || {}) || "max" in (data?.system?.uses || {}));
            const isAttune = monitoredChangesDict["monitorAttune"] && (item.type === "equipment" || item.type === "weapon") && "attunement" in (data.system || {});

            if (!(isEquip || isQuantity || isSpellPrep || isFeat || isAttune)) return;

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

            if (isQuantity) {
                const newQuantity = data.system.quantity;
                const oldQuantity = item.system.quantity;

                checkSecondHooks({ itemId: item.id }).then(async (didFire) => {
                    if (didFire) return;

                    hbsData.quantity = {
                        value: newQuantity
                    };
                    if (game.settings.get(moduleName, "showPrevious")) hbsData.quantity.old = oldQuantity;
                    const content = await renderTemplate(ITEM_QUANTITY_TEMPLATE, hbsData);

                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { equip: data.system.quantity } }
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
            // Ignore updates from the dnd5e advancement system
            if (game.system.id === 'dnd5e' && "isAdvancement" in options) return;

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
                        label: CONFIG.DND5E.skills[skl].label,
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
                        label: CONFIG.DND5E.abilities[abl].label,
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

        // Active Effect changes
        Hooks.on("preUpdateActiveEffect", async (activeEffect, changes, options, userID) => {
            if (!game.settings.get(moduleName, "monitorActiveEffects")) return;
            
            const actor = activeEffect.parent;
            if (actor.type !== "character") return;

            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];

            const hbsData = {
                characterName: actor.name,
                activeEffectName: activeEffect.name
            };

            // Parse changes
            const isDisabled = "disabled" in (changes || {});
            const isDuration = "duration" in (changes || {});
            const isEffects = Object.values(changes).some(key => Array.isArray(key));
  
            // Enabled/Disabled change
            if (isDisabled) {
                hbsData.disabled = changes.disabled;
                renderTemplate(EFFECT_ENABLED_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { effects: changes.disabled } }
                    });
                });
            }

            // Duration change
            if (isDuration) {
                hbsData.duration = {};
                for (let type in changes.duration) {
                    // Excludes value changes from null to 0 and viceversa
                    const newVal = changes.duration[type] === null ? 0 : changes.duration[type];
                    const oldVal = activeEffect.duration[type] === null ? 0 : activeEffect.duration[type];
                    if (newVal === oldVal) continue;
                    
                    hbsData.duration[type] = {
                        label: game.i18n.localize(`characterMonitor.chatMessage.duration.${type}`),
                        value: newVal
                    }
                    if (game.settings.get(moduleName, "showPrevious")) hbsData.duration[type].old = oldVal;
                }
                // New line variable
                if (Object.keys(changes.duration).length > 1) hbsData.multivalues = true;
                
                // Prevent empty messages
                if (Object.keys(hbsData.duration).length < 1) return;
                renderTemplate(EFFECT_DURATION_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { effects: true } }
                    });
                });
            }

            // Effects change
            if (isEffects) {
                const effects = Object.values(changes).find(Array.isArray);
                var old_effects = [...activeEffect.changes];
                var parsedEffects = [];

                // Handling key changes
                for (let effect of effects) {
                    const matchedEffectIndex = old_effects.findIndex(e => e.key === effect.key);
                    if (matchedEffectIndex !== -1) {
                        var matchedEffect = old_effects[matchedEffectIndex];
                        old_effects.splice(matchedEffectIndex, 1);
                    }
                    parsedEffects.push({ new: effect, old: matchedEffect });
                }
                if (old_effects.length > 0) {
                    const unmatchedEffectIndex = parsedEffects.findIndex(e => e.old === undefined);
                    if (unmatchedEffectIndex !== -1) parsedEffects[unmatchedEffectIndex].old = old_effects[0];
                }
                
                hbsData.effects = {}
                for (let effect of parsedEffects) {
                    const newEffect = { label: effect.new.key, mode: effect.new.mode, value: effect.new.value };
                    const oldEffect = { label: effect.old.key, mode: effect.old.mode, value: effect.old.value };
                    
                    for (let keyName in newEffect) {
                        if (newEffect[keyName] !== oldEffect[keyName]) {
                            hbsData.effects[effect.new.key] = { ...hbsData.effects[effect.new.key], [keyName]: newEffect[keyName] }
                            if (!hbsData.effects[effect.new.key].label) hbsData.effects[effect.new.key].label = newEffect.label;
                            if (game.settings.get(moduleName, "showPrevious")) {
                                const oldKeyName = `old_${keyName}`;
                                hbsData.effects[effect.new.key] = { ...hbsData.effects[effect.new.key], [oldKeyName]: oldEffect[keyName] };
                            }
                        }
                    }
                }

                if (Object.keys(hbsData.effects).length < 1) return;
                renderTemplate(EFFECT_EFFECTS_TEMPLATE, hbsData).then(async (content) => {
                    await ChatMessage.create({
                        content,
                        whisper,
                        flags: { [moduleName]: { effects: true } }
                    });
                });
            }
        });

        // Effect is created
        Hooks.on("preCreateActiveEffect", async (activeEffect, data, options, userID) => {
            if (!game.settings.get(moduleName, "monitorActiveEffects")) return;

            const actor = activeEffect.parent;
            if (actor.type !== "character") return;
            if (activeEffect.origin && activeEffect.origin.includes("Item")) return;

            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];

            const hbsData = {
                characterName: actor.name,
                activeEffectName: activeEffect.name,
                disabled: false
            };

            renderTemplate(EFFECT_ENABLED_TEMPLATE, hbsData).then(async (content) => {
                await ChatMessage.create({
                    content,
                    whisper,
                    flags: { [moduleName]: { effects: true } }
                });
            });
        });

        // Effect is deleted
        Hooks.on("preDeleteActiveEffect", async (activeEffect, options, userID) => {
            if (!game.settings.get(moduleName, "monitorActiveEffects")) return;

            const actor = activeEffect.parent;
            if (actor.type !== "character") return;
            if (activeEffect.origin && activeEffect.origin.includes("Item")) return;

            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];

            const hbsData = {
                characterName: actor.name,
                activeEffectName: activeEffect.name,
                disabled: true
            };

            renderTemplate(EFFECT_ENABLED_TEMPLATE, hbsData).then(async (content) => {
                await ChatMessage.create({
                    content,
                    whisper,
                    flags: { [moduleName]: { effects: true } }
                });
            });
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