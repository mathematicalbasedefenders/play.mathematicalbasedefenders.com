import _ from "lodash";

/**
 * Formats the milliseconds.
 * @param {number} milliseconds The milliseconds.
 * @returns {string} The formatted string, in `m:s.ms` format.
 */
function millisecondsToTime(milliseconds: number) {
  let m = Math.floor(milliseconds / 60000);
  let s = Math.floor((milliseconds % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  let ms = Math.floor((milliseconds % 60000) % 1000)
    .toString()
    .padStart(3, "0");
  return `${m}:${s}.${ms}`;
}

/**
 * Calculates the level according to `experiencePoints`.
 * @param {number} experiencePoints The experience points.
 * @returns {object} An object with the keys `level`, which is the level, and `progressToNext`, which is an integer in the range [0,1).
 */
function calculateLevel(experiencePoints: number) {
  let level = 0;
  let stock = experiencePoints;
  while (stock > 100 * 1.1 ** level) {
    stock -= 100 * 1.1 ** level;
    level++;
  }
  return {
    level: level,
    progressToNext: stock / (100 * 1.1 ** level + 1)
  };
}

/**
 * Calculates n Choose r.
 * @param {number} n n
 * @param {number} r r
 * @returns
 */
function nCr(n: number, r: number) {
  return factorial(n) / (factorial(n - r) * factorial(r));
}

/**
 * Calculates n!
 * If n mod 1 != 0, decimal part is ignored.
 * @param {number} n The number to calculate the factorial of.
 * @returns The result.
 */
function factorial(n: number) {
  let result = 1;
  for (let i = 1; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Formats the number (ideally floats) according to the game's conventions.
 * en-US locale, 3 decimal places.
 */
function formatNumber(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

function checkPlayerListCacheEquality(
  oldData: { [key: string]: unknown },
  data: Array<{ [key: string]: string }>,
  prefix: string,
  suffix: string
) {
  if (oldData.playerCount !== data.length) {
    return false;
  }
  const registeredPlayers = data.filter((e) => {
    return e.isRegistered;
  });
  const formattedSelectors = new Set(
    registeredPlayers.map((e) => {
      return prefix + e.userID + suffix;
    })
  );
  if (!_.isEqual(oldData.registeredPlayers, formattedSelectors)) {
    return false;
  }
  return true;
}

export {
  millisecondsToTime,
  calculateLevel,
  nCr,
  formatNumber,
  checkPlayerListCacheEquality
};
