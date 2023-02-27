import { variables } from "./index";

const SETTINGS_KEYS = [
  {
    storageStringKey: "multiplicationSign",
    htmlName: "settings__multiplication-sign",
    defaultValue: "middle-dot"
  },
  {
    storageStringKey: "beautifulScore",
    htmlName: "settings__beautiful-score-display",
    defaultValue: "off"
  }
];

function getSettings(storageString: string) {
  let settings = JSON.parse(storageString);
  for (let entry of SETTINGS_KEYS) {
    let value = settings[entry.storageStringKey];
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

function setSettings() {
  let toSave: any = {};
  for (let entry of SETTINGS_KEYS) {
    let value = $(`input[name="${variables.settings[entry.htmlName]}"]`).val();
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
