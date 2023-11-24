import { Howl } from "howler";
import { variables } from ".";

/**
 * Plays a sound, if it should.
 * @param {string} path The path to the sound.
 * @param {boolean} check Whether to check if the game should play sound.
 * @returns
 */
function playSound(path: string, check: boolean) {
  if (!checkSoundPlayingEligibility(check)) {
    return;
  }
  const sound = new Howl({
    src: [`${window.location.href}/${path}`]
  });

  sound.play();
}

/**
 * Checks if the game should play sound.
 * @param {boolean} checkType true for full check, `"playing"` for only playing, and false for no check
 */
function checkSoundPlayingEligibility(checkType: boolean) {
  if (checkType === false) {
    return true;
  }
  if (checkType === true) {
    return variables.playing && variables.settings.sound === "on";
  }
}

export { playSound, checkSoundPlayingEligibility };
