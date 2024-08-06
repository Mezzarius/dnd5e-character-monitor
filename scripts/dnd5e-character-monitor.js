const moduleID = 'dnd5e-character-monitor';
let socket;

const lg = x => console.log(x);


Hooks.once('init', async () => {
    game.settings.registerMenu(moduleID, 'cmColorsMenu', {
        name: game.i18n.localize('characterMonitor.settings.cmColorsMenu.name'),
        label: game.i18n.localize('characterMonitor.settings.cmColorsMenu.label'),
        icon: 'fas fa-palette',
        type: CharacterMonitorColorMenu,
        restricted: true
    });
    game.settings.register(moduleID, 'cmColors', {
        name: 'Character Monitor Colors',
        hint: '',
        scope: 'world',
        type: Object,
        default: {
            hpPlus: '#06a406',
            hpMinus: '#c50d19',
            on: '#06a406',
            off: '#c50d19',
            slots: '#b042f5',
            feats: '#425af5',
            effects: '#c86400',
            currency: '#b59b3c',
            proficiency: '#37908a',
            ability: '#37908a'
        },
        config: false
        // onChange: debounce(CharacterMonitor.setCssVariables, 500)
    });

    const monitorTypes = [,
        'HP',
        'Equip',
        'Quantity',
        'Attune',
        'SpellPrep',
        'SpellSlots',
        'Feats',
        'Resources',
        'ActiveEffects',
        'Currency',
        'Proficiency',
        'Ability'
    ];

    for (const monitorType of monitorTypes) {
        game.settings.register(moduleID, `monitor${monitorType}`, {
            name: game.i18n.localize(`characterMonitor.settings.monitor${monitorType}.name`),
            hint: game.i18n.localize(`characterMonitor.settings.monitor${monitorType}.hint`),
            scope: 'world',
            type: Boolean,
            default: true,
            config: true
        });
    }

    game.settings.register(moduleID, 'showGMonly', {
        name: game.i18n.localize('characterMonitor.settings.showGMonly.name'),
        hint: game.i18n.localize('characterMonitor.settings.showGMonly.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true
        // onChange: debounce(CharacterMonitor.setCssVariables, 500)
    });

    game.settings.register(moduleID, 'allowPlayerView', {
        name: game.i18n.localize('characterMonitor.settings.allowPlayerView.name'),
        hint: game.i18n.localize('characterMonitor.settings.allowPlayerView.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true
        // onChange: debounce(CharacterMonitor.setCssVariables, 500)
    });

    game.settings.register(moduleID, 'showToggle', {
        name: game.i18n.localize('characterMonitor.settings.showToggle.name'),
        hint: game.i18n.localize('characterMonitor.settings.showToggle.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            if (!game.user.isGM) return;

            await game.settings.set(moduleID, 'cmToggle', true);
            setTimeout(() => window.location.reload(), 500);
        }
    });

    game.settings.register(moduleID, 'showPrevious', {
        name: 'Show Previous Values',
        hint: '',
        scope: 'world',
        type: Boolean,
        default: false,
        config: true

    });

    game.settings.register(moduleID, 'cmToggle', {
        name: 'Toggle Character Monitor',
        hint: '',
        scope: 'world',
        type: Boolean,
        default: true,
        config: false
    });

    game.settings.register(moduleID, 'useTokenName', {
        name: game.i18n.localize('healthMonitor.settings.useTokenName.name'),
        hint: game.i18n.localize('healthMonitor.settings.useTokenName.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(moduleID, 'hideNPCs', {
        name: game.i18n.localize('healthMonitor.settings.hideNPCs.name'),
        hint: game.i18n.localize('healthMonitor.settings.hideNPCs.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true
    });
    game.settings.register(moduleID, 'hideNPCname', {
        name: game.i18n.localize('healthMonitor.settings.hideNPCname.name'),
        hint: game.i18n.localize('healthMonitor.settings.hideNPCname.hint'),
        scope: 'world',
        type: Boolean,
        default: false,
        config: true
    });
    game.settings.register(moduleID, 'replacementName', {
        name: game.i18n.localize('healthMonitor.settings.replacementName.name'),
        hint: game.i18n.localize('healthMonitor.settings.replacementName.hint'),
        scope: 'world',
        type: String,
        default: '???',
        config: true
    });


    const templateDir = `modules/${moduleID}/templates`;
    await loadTemplates([
        `${templateDir}/hp.hbs`,
        `${templateDir}/itemEquip.hbs`,
        `${templateDir}/itemQuantity.hbs`,
        `${templateDir}/itemAttune.hbs`,
        `${templateDir}/spellPrepare.hbs`,
        `${templateDir}/featUses.hbs`,
        `${templateDir}/spellSlots.hbs`,
        `${templateDir}/resourceUses.hbs`,
        `${templateDir}/currency.hbs`,
        `${templateDir}/proficiency.hbs`,
        `${templateDir}/ability.hbs`,
        `${templateDir}/effectEnabled.hbs`,
        `${templateDir}/effectDuration.hbs`,
        `${templateDir}/effectEffects.hbs`,
    ]);
});

Hooks.once('setup', async () => {
    if (game.settings.get(moduleID, 'showToggle')) {
        Hooks.on('getSceneControlButtons', controls => {
            const bar = controls.find(c => c.name === 'token');
            bar.tools.push({
                name: 'Character Monitor',
                title: game.i18n.localize('characterMonitor.control.title'),
                icon: 'fas fa-exchange-alt',
                visible: game.user.isGM,
                toggle: true,
                active: game.settings.get(moduleID, 'cmToggle'),
                onClick: async toggled => await game.settings.set(moduleID, 'cmToggle', toggled)
            });
        });
    }

    setCSSvariables();
});

Hooks.once('socketlib.ready', () => {
    socket = socketlib.registerModule(moduleID);
    console.log(socket)
    socket.register('createMessage', createMessage);
});


Hooks.on('renderChatMessage', (app, [html], appData) => {
    if (!appData.message.flags[moduleID] || !html) return;
    
    const message = game.messages.get(appData.message._id);
    const monitorType = message.getFlag(moduleID, 'monitorType');
    if (monitorType) {
        html.classList.add('dnd5e-cm', `dnd5e-cm-${monitorType}`);
        html.querySelector('header').style.display = 'none';
    }
});

Hooks.on('preUpdateActor', async (actor, diff, options, userID) => {
    if (!game.settings.get(moduleID, 'cmToggle')) return;

    lg(diff)
    let processHP = Boolean(diff.system?.attributes?.hp);
    if (actor.type === 'npc' && game.settings.get(moduleID, 'hideNPCs')) processHP = false;

    if (processHP) {
        const previousData = {
            value: actor.system.attributes.hp.value,
            max: actor.system.attributes.hp.max,
            temp: actor.system.attributes.hp.temp
        };
        const data = {
            previous: game.settings.get(moduleID, 'showPrevious'),
            characterName: actor.name
        };
        
        for (const healthType of ['value', 'max', 'temp']) {
            const value = diff.system.attributes.hp[healthType];
            const previousValue = previousData[healthType];
            const delta = value - previousValue;
            if (delta) {
                const direction = delta > 0 ? 'Plus' : 'Minus';
                const flags = {
                    [moduleID]: {
                        monitorType: `hp${direction}`
                    }
                };
                data.type = game.i18n.localize(`characterMonitor.chatMessage.hp.${healthType}`, flags);
                data.direction = direction;
                data.value = value;
                data.previousValue = previousValue;
                const content = await renderTemplate(`modules/${moduleID}/templates/hp.hbs`, data);
                await socket.executeAsGM('createMessage', flags, content);    
            }
        }
    }
    
    if (actor.type !== 'character') return;

    
});


function createMessage(flags, content) {
    return ChatMessage.create({ flags, content });
}

function setCSSvariables() {
    const root = document.querySelector(':root');
    const colors = game.settings.get(moduleID, 'cmColors');
    for (const [monitorType, color] of Object.entries(colors)) {
        root.style.setProperty(`--dnd5e-cm-${monitorType}`, color);
    }

    const showGmOnly = game.settings.get(moduleID, 'showGMonly');
    const allowPlayerView = game.settings.get(moduleID, 'allowPlayerView');

    const display = ((showGmOnly && !game.user.isGM && !allowPlayerView) ? 'none' : 'flex');
    // root.style.setProperty('--dnd5e-cm-display', display);
}

class CharacterMonitorColorMenu extends FormApplication {

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: 'Customize Character Monitor Colors',
            template: `/modules/${moduleID}/templates/colorMenu.hbs`,
            width: 700
        }
    }

    getData() {
        const settingsData = game.settings.get(moduleID, 'cmColors');
        const data = {
            hpPlus: {
                color: settingsData.on,
                label: game.i18n.localize('characterMonitor.colorMenu.hpPlus')
            },
            hpMinus: {
                color: settingsData.on,
                label: game.i18n.localize('characterMonitor.colorMenu.hpMinus')
            },
            on: {
                color: settingsData.on,
                label: game.i18n.localize('characterMonitor.colorMenu.on')
            },
            off: {
                color: settingsData.off,
                label: game.i18n.localize('characterMonitor.colorMenu.off')
            },
            slots: {
                color: settingsData.slots,
                label: game.i18n.localize('characterMonitor.chatMessage.SpellSlots')
            },
            feats: {
                color: settingsData.feats,
                label: game.i18n.localize('DND5E.Features')
            },
            effects: {
                color: settingsData.effects,
                label: game.i18n.localize('DND5E.Effects')
            },
            currency: {
                color: settingsData.currency,
                label: game.i18n.localize('DND5E.Currency')
            },
            proficiency: {
                color: settingsData.proficiency,
                label: game.i18n.localize('DND5E.Proficiency')
            },
            ability: {
                color: settingsData.ability,
                label: game.i18n.localize('DND5E.Ability')
            }
        };

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.on('click', `button[name='reset']`, () => {
            html.find(`input[name='on']`).val('#06a406');
            html.find(`input[data-edit='on']`).val('#06a406');
            html.find(`input[name='off']`).val('#c50d19');
            html.find(`input[data-edit='off']`).val('#c50d19');
            html.find(`input[name='slots']`).val('#b042f5');
            html.find(`input[data-edit='slots']`).val('#b042f5');
            html.find(`input[name='feats']`).val('#425af5');
            html.find(`input[data-edit='feats']`).val('#425af5');
            html.find(`input[name='effects']`).val('#c86400');
            html.find(`input[data-edit='effects']`).val('#c86400');
            html.find(`input[name='currency']`).val('#b59b3c');
            html.find(`input[data-edit='currency']`).val('#b59b3c');
            html.find(`input[name='proficiency']`).val('#37908a');
            html.find(`input[data-edit='proficiency']`).val('#37908a');
            html.find(`input[name='ability']`).val('#37908a');
            html.find(`input[data-edit='ability']`).val('#37908a');
        });
    }

    async _updateObject(event, formData) {
        await game.settings.set(moduleID, 'cmColors', formData);
    }
}