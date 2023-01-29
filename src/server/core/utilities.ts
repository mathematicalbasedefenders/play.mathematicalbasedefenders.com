import * as universal from "../universal";

function checkIfPropertyWithValueExists(
  dataset: unknown,
  targetProperty: string,
  targetValue: string
) {
  if (Array.isArray(dataset)) {
    for (let i = 0; i < dataset.length; i++) {
      if (dataset[i][targetProperty] === targetValue) {
        return true;
      }
    }
  }
  return false;
}

export { checkIfPropertyWithValueExists };
