function performDataValidationForCustomSingleplayerMode(settings) {
    let toReturn = {
        good: true,
        problems: {}
    };

    let allowedValueRanges = {
        baseHealth: {
            minimum: 1,
            maximum: 100
        },
        allowedComboTimeInMilliseconds: {
            minimum: 1,
            maximum: 60 * 1000
        },
        enemyGenerationThreshold: {
            minimum: 1,
            maximum: 100
        },
        enemyGenerationIntervalInMilliseconds: {
            minimum: 10,
            maximum: 60 * 1000
        },
        enemySpeedMultiplier: {
            minimum: 0.1,
            maximum: 100
        },
        enemyLimit: {
            minimum: 1,
            maximum: 250
        },
        valueOfVariableA: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableB: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableC: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableD: {
            minimum: -2147483648,
            maximum: 2147483647
        }
    };

    let keys = Object.keys(settings);

    for (i = 0; i < keys.length; i++) {
        // check that supplied value is a number
        if (
            /^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) ||
            (/(valueOfVariable)[A-D]/.test(Object.keys(settings)[i]) &&
                (/^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) ||
                    "" == settings[keys[i]]))
        ) {
            // good - check if value is within limit
            if (allowedValueRanges[keys[i]]) {
                if (
                    allowedValueRanges[keys[i]].minimum <=
                        parseInt(settings[keys[i]]) &&
                    parseInt(settings[keys[i]]) <=
                        allowedValueRanges[keys[i]].maximum
                ) {
                    // good
                } else {
                    // bad - check one more time that its a variable
                    if (
                        /(valueOfVariable)[A-D]/.test(
                            Object.keys(settings)[i]
                        ) &&
                        (/^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) ||
                            "" == settings[keys[i]])
                    ) {
                        // good
                    } else {
                        toReturn.good = false;
                        toReturn.problems[keys[i]] = {
                            message: `Value for ${
                                keys[i]
                            } must be in the range [${
                                allowedValueRanges[keys[i]].minimum
                            }, ${allowedValueRanges[keys[i]].maximum}].`
                        };
                    }
                }
            }
        } else {
            // bad
            toReturn.good = false;
            toReturn.problems[keys[i]] = {
                message: `Value for ${keys[i]} is not a number.`
            };
        }
    }

    return toReturn;
}
module.exports = { performDataValidationForCustomSingleplayerMode}