/**
 * Settings manager (LocalStorage).
 */
class Settings {
    static SETTINGS_ROOT_KEY = "newtab-bookmarks";
    settings = Object.create(null);
    constructor() {
        this.settings = {
            firstRun: true,
            rootFolderName: '',
            bookmarksWidth: 'full-screen',
            bookmarkItemIcon: 'yes',
            bookmarkItemSize: 'small',
            bookmarksShowSubfolders: 'no',
            bookmarksReordering: 'yes',
            bookmarksSearchBar: 'yes'
        };
    }

    async init() {
        const settings =  await chrome.storage.local.get(Settings.SETTINGS_ROOT_KEY) || Object.create(null);
        this.settings = {...this.settings, ...settings[Settings.SETTINGS_ROOT_KEY]};
        return this;
    }

    isOn(settingName) {
        return this.settings[settingName] === 'yes';
    }

    isOff(settingName) {
        return !this.settings[settingName] || this.settings[settingName] === 'no';
    }

    getValue(settingName) {
        return this.settings[settingName];
    }

    setValue(settingName, settingValue) {
        this.settings[settingName] = settingValue;
    }

    async saveOne(key, value) {
        this.setValue(key, value);
        await this.save();
    }

    getAll() {
        return this.settings;
    }

    async save(newSettings) {
        if (newSettings) {
            await chrome.storage.local.set({[Settings.SETTINGS_ROOT_KEY]: { ...this.settings, ...newSettings, ...{firstRun: false}}});
        } else {
            await chrome.storage.local.set({[Settings.SETTINGS_ROOT_KEY]: {...this.settings}});
        }
    }
}