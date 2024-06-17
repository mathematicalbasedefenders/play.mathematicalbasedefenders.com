import { variables } from "./index";

enum SettingsType {
  Radio,
  Custom,
  Dropdown
}

const SETTINGS_KEYS = [
  {
    storageStringKey: "multiplicationSign",
    htmlName: "settings__multiplication-sign",
    defaultValue: "middle-dot",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "beautifulScore",
    htmlName: "settings__beautiful-score-display",
    defaultValue: "on",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "enemyColor",
    htmlName: "settings__enemy-color",
    defaultValue: "randomForEach",
    settingsType: SettingsType.Custom
  },
  {
    storageStringKey: "enemyWidthCoefficient",
    htmlName: "settings__enemy-size-ratio",
    defaultValue: "2",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "displayScore",
    htmlName: "settings__score-display",
    defaultValue: "on",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "sound",
    htmlName: "settings__sound",
    defaultValue: "on",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "displayLevel",
    htmlName: "settings__level-display",
    defaultValue: "high",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "forceHideTutorialText",
    htmlName: "settings__force-hide-tutorial-text",
    defaultValue: "off",
    settingsType: SettingsType.Radio
  },
  {
    storageStringKey: "selectedColorPalette",
    htmlName: "settings-enemy-color__selected-enemy-color-palette",
    htmlID: "selected-enemy-color-palette",
    defaultValue: "fire",
    settingsType: SettingsType.Dropdown
  },
  {
    storageStringKey: "enemySizeCoefficient",
    htmlName: "settings-enemy-scale",
    defaultValue: 1,
    settingsType: SettingsType.Radio
  }
];

/**
 * Gets the stored settings from `localStorage`, then updates the HTML with the data.
 * @param {string} storageString The stored string. This should be from `localStorage`.
 */
function getSettings(storageString: string) {
  let settings = JSON.parse(storageString);
  for (let entry of SETTINGS_KEYS) {
    let value = settings[entry.storageStringKey];

    // special cases
    // color picker
    if (entry.storageStringKey === "enemyColor") {
      const palette = variables.settings["selectedColorPalette"];
      $("#selected-enemy-color-palette").val(palette);
      if (/\#[0-9a-f]{6}/.test(value)) {
        $(`input[name="${entry.htmlName}"][value="setColor"]`).prop(
          "checked",
          true
        );
        $("#settings__enemy-color__forced-color").text(value);
        variables.settings[entry.storageStringKey] = value;
      } else if (
        variables.settings[entry.storageStringKey] === "randomFromPalette"
      ) {
        $(`input[name="${entry.htmlName}"][value="randomFromPalette"]`).prop(
          "checked",
          true
        );
        $(`input[name="${entry.htmlName}"][value="randomFromPalette"]`).prop(
          "checked",
          true
        );
      } else {
        variables.settings[entry.storageStringKey] = "randomForEach";
        $("#settings__enemy-color__forced-color").text("#ff0000");
      }
      continue;
    }

    // normal cases
    if (typeof value !== "undefined") {
      variables.settings[entry.storageStringKey] = value;
      $(`input[name="${entry.htmlName}"][value="${value}"]`).prop(
        "checked",
        true
      );
    } else {
      variables.settings[entry.storageStringKey] = entry.defaultValue;
      $(`input[name="${entry.htmlName}"][value="${entry.defaultValue}"]`).prop(
        "checked",
        true
      );
    }
  }
  console.log("Got settings!");
}

/**
 * Gets the stored settings from `localStorage`, then updates the client-side variables with the data.
 * @param {string} storageString The stored string. This should be from `localStorage`.
 */
function loadSettings(storageString: string) {
  let settings = JSON.parse(storageString);
  for (let entry of SETTINGS_KEYS) {
    let value = settings[entry.storageStringKey];
    if (typeof value !== "undefined") {
      $(`input[name="${entry.htmlName}"][value="${value}"]`).prop(
        "checked",
        true
      );
    } else {
      $(`input[name="${entry.htmlName}"][value="${entry.defaultValue}"]`).prop(
        "checked",
        true
      );
    }
  }
  console.log("Loaded settings!");
}

/**
 * Sets the new settings and writes them into `localStorage`.
 */
function setSettings() {
  let toSave: any = {};
  for (let entry of SETTINGS_KEYS) {
    // special cases
    // enemy color
    if (entry.storageStringKey === "enemyColor") {
      let selectValue = $(`input[name="${entry.htmlName}"]:checked`).val();
      if (selectValue === "setColor") {
        let forcedValue = $("#settings__enemy-color__forced-color-picker")
          .val()
          ?.toString();
        variables.settings[entry.storageStringKey] = forcedValue;
        toSave[entry.storageStringKey] = forcedValue;
      } else if (selectValue === "randomFromPalette") {
        variables.settings[entry.storageStringKey] = "randomFromPalette";
        toSave[entry.storageStringKey] = "randomFromPalette";
        const palette = $("#selected-enemy-color-palette").val();
        toSave["selectedColorPalette"] = palette;
      } else {
        variables.settings[entry.storageStringKey] = "randomForEach";
        toSave[entry.storageStringKey] = "randomForEach";
      }
      continue;
    }

    // normal cases
    let value;
    if (entry.settingsType === SettingsType.Radio) {
      value = $(`input[name="${entry.htmlName}"]:checked`).val();
    } else if (entry.settingsType === SettingsType.Dropdown) {
      value = $(`#${entry.htmlID}`).val();
    }
    if (typeof value !== "undefined") {
      variables.settings[entry.storageStringKey] = value;
      toSave[entry.storageStringKey] = value;
    } else {
      variables.settings[entry.storageStringKey] = entry.defaultValue;
      toSave[entry.storageStringKey] = entry.defaultValue;
    }
  }
  let newString = JSON.stringify(toSave);
  localStorage.setItem("settings", newString);
  console.log("Saved settings!");
}

export { getSettings, loadSettings, setSettings };
