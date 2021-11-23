const moduleName = "dnd5e-character-monitor";
// Setting CONSTS
let trashIconSetting;
const classToColorSettingDict = {
    "cm-on": "on",
    "cm-off": "off",
    "cm-slots": "slots",
    "cm-feats": "feats"
};


Hooks.once("init", () => {
    console.log(`${moduleName} | Initializing`);

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
                feats: "#425af5"
            },
            config: false,
            onChange: () => window.location.reload()
        });


        game.settings.register(moduleName, "monitorEquip", {
            name: game.i18n.localize("characterMonitor.settings.monitorEquip.name"),
            hint: game.i18n.localize("characterMonitor.settings.monitorEquip.hint"),
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

        game.settings.register(moduleName, "showGMonly", {
            name: game.i18n.localize("characterMonitor.settings.showGMonly.name"),
            hint: game.i18n.localize("characterMonitor.settings.showGMonly.hint"),
            scope: "world",
            type: Boolean,
            default: false,
            config: true
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
                ui.controls.initialize();
            }
        });

        game.settings.register(moduleName, "trashIcon", {
            name: game.i18n.localize("characterMonitor.settings.trashIcon.name"),
            hint: "",
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: () => window.location.reload()
        });


        game.settings.register(moduleName, "cmToggle", {
            name: "Toggle Character Monitor",
            hint: "",
            scope: "world",
            type: Boolean,
            default: true,
            config: false
        });
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
            const cmMessage = html.find(`.cm-message`);
            if (!cmMessage.length) return;

            const cmClass = cmMessage[0].classList[1];
            const settingKey = classToColorSettingDict[cmClass]
            const backgroundColor = game.settings.get(moduleName, "cmColors")[settingKey];
            html.css("background", backgroundColor); // TODO: figure out coloring mechanism
            html.css("text-shadow", "-1px -1px 0 #000 , 1px -1px 0 #000 , -1px 1px 0 #000 , 1px 1px 0 #000");
            html.css("color", "white");
            html.css("text-align", "center");
            html.css("font-size", "12px");
            html.css("margin", "2px");
            html.css("padding", "2px");
            html.css("border", "2px solid #191813d6");
            html.find(".message-sender").text("");
            html.find(".message-metadata")[0].style.display = "none";

            // Optionally add trash icon
            if (trashIconSetting && game.user.isGM) {
                const cmMessageDiv = html.find(`div.cm-message`);
                cmMessageDiv.css("position", "relative");
                $(cmMessageDiv).find(`span`).after(`<span><a class="button message-delete"><i class="fas fa-trash"></i></a></span>`);

                html.find(`a.message-delete`).closest(`span`).css("position", "absolute");
                html.find(`a.message-delete`).closest(`span`).css("left", "95%");
            }
        });
    }

    static registerReadyHooks() {
        // Equipment, Spell Preparation, and Feature changes
        Hooks.on("updateItem", async (item, data, options, userID) => {
            // If owning character sheet is not open, then change was not made via character sheet, return
            if (Object.keys(item.parent?.apps || {}).length === 0) return;

            // If item owner is not a PC, return // Potentially change this to be depenent on setting if NPCs should be monitored
            if (item.parent.type !== "character") return;

            // If Character Monitor disabled via control toggle, return
            if (!game.settings.get(moduleName, "cmToggle")) return;

            // Get currently monitored changes
            const monitoredChangesDict = {};
            for (const monitor of ["monitorEquip", "monitorSpellPrep", "monitorFeats"]) {
                monitoredChangesDict[monitor] = game.settings.get(moduleName, monitor);
            }

            // Parse changes
            const isEquip = monitoredChangesDict["monitorEquip"] && (item.type === "equipment" || item.type === "weapon") && "equipped" in (data.data || {});
            const isSpellPrep = monitoredChangesDict["monitorSpellPrep"] && item.type === "spell" && "prepared" in (data?.data?.preparation || {});
            const isFeat = monitoredChangesDict["monitorFeats"] && item.type === "feat" && ("value" in (data?.data?.uses || {}) || "max" in (data?.data?.uses || {}));

            if (!(isEquip || isSpellPrep || isFeat)) return;

            // If "showGMonly" setting enabled, whisper to GM users // Potentially change this to be depenent on setting if NPCs should be monitored (See health-monitor.js line 213)
            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];

            // Prepare common chat message content
            const characterName = item.parent.name;
            const itemName = item.name;

            if (isEquip) {
                const content = `
                    <div class="cm-message cm-${data.data.equipped ? "on" : "off"}">
                        <span>
                            ${characterName} ${data.data.equipped ? game.i18n.localize("characterMonitor.chatMessage.equipped") : game.i18n.localize("characterMonitor.chatMessage.unequipped")}: ${itemName}
                        </span>
                    </div>
                `;

                await ChatMessage.create({
                    content,
                    whisper
                });
            }

            if (isSpellPrep) {
                const content = `
                    <div class="cm-message cm-${data.data.preparation.prepared ? "on" : "off"}">
                        <span>
                            ${characterName} ${data.data.preparation.prepared ? game.i18n.localize("characterMonitor.chatMessage.prepared") : game.i18n.localize("characterMonitor.chatMessage.unprepared")} ${game.i18n.localize("characterMonitor.chatMessage.aSpell")}: ${itemName}
                        </span>
                    </div>
                `;

                await ChatMessage.create({
                    content,
                    whisper
                });
            }

            if (isFeat) {
                const content = `
                    <div class="cm-message cm-feats">
                        <span>
                            ${characterName} | ${itemName}: ${item.data.data.uses.value}/${item.data.data.uses.max} ${game.i18n.localize("characterMonitor.chatMessage.uses")}
                        </span>
                    </div>
                `;

                // Determine if update was initiated by item being rolled
                const itemRolled = await checkSecondHook("createChatMessage");
                if (itemRolled) return;

                await ChatMessage.create({
                    content,
                    whisper
                });
            }
        });

        // Spell Slot changes
        Hooks.on("updateActor", async (actor, data, options, userID) => {
            const whisper = game.settings.get(moduleName, "showGMonly") ?
                game.users.filter(u => u.isGM).map(u => u.id) : [];
            const characterName = actor.name;

            if (game.settings.get(moduleName, "monitorSpellSlots") && ("spells" in (data.data || {}))) {
                // Determine if update was initiated by item being rolled
                const itemRolled = await checkSecondHook("createChatMessage");
                if (itemRolled) return;

                for (const spellLevel of Object.keys(data.data.spells)) {
                    const levelNum = parseInt(spellLevel.slice(-1));
                    const levelLabel = CONFIG.DND5E.spellLevels[levelNum];
                    const content = `
                        <div class="cm-message cm-slots">
                            <span>
                                ${characterName} | ${levelLabel} ${game.i18n.localize("characterMonitor.chatMessage.SpellSlots")}: ${actor.data.data.spells[spellLevel].value}/${actor.data.data.spells[spellLevel].max}
                            </span>
                        </div>
                    `;

                    await ChatMessage.create({
                        content,
                        whisper
                    });
                }
            }

            if (game.settings.get(moduleName, "monitorResources") && ("resources" in (data.data || {}))) {
                const isRest = checkSecondHook("restCompleted");
                const itemRolled = checkSecondHook("createChatMessage");
                const res = await Promise.all([isRest, itemRolled]);
                if (res.includes(true)) return;

                for (const resource of Object.keys(data.data.resources)) {
                    if (!(("value" in data.data.resources[resource]) || ("max" in data.data.resources[resource]))) continue;

                    const content = `
                        <div class="cm-message cm-slots">
                            <span>
                                ${characterName} | ${actor.data.data.resources[resource].label || resource}: ${actor.data.data.resources[resource].value} / ${actor.data.data.resources[resource].max || "0"}
                            </span>
                        </div>
                    `;

                    await ChatMessage.create({
                        content,
                        whisper
                    });
                }
            }
        });
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
                label: "Equip/Prepare"
            },
            off: {
                color: settingsData.off,
                label: "Unequip/Unprepare"
            },
            slots: {
                color: settingsData.slots,
                label: "Spell Slots"
            },
            feats: {
                color: settingsData.feats,
                label: "Features"
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
        });
    }

    async _updateObject(event, formData) {
        await game.settings.set(moduleName, "cmColors", formData);
    }
}


async function checkSecondHook(secondHookName, delay = 500) {
    let secondHookCalled = false;
    const hookID = Hooks.once(secondHookName, () => {
        secondHookCalled = true;
    });

    await new Promise(resolve => {
        setTimeout(resolve, delay);
    });

    if (!secondHookCalled) Hooks.off(secondHookName, hookID);

    return secondHookCalled;
}
