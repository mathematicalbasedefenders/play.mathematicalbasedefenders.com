// Developer Configurations

const developerConfiguration = {
    // TODO: WHEN PUSHING TO PRODUCTION, TURN ALL OF THESE TO false!
    settings: {
        // Developer Mode
        developerMode: false,

        // Speed Mode
        // Enemies move 10x faster.
        speedMode: false,

        // Impatient Mode
        // Multiplayer game intermission times is now 250ms instead of 30000ms
        impatientMode: false,

        // Tank Mode
        // All players have 1,000 BHP instead of 10 BHP.
        tankMode: false,

        // All Correct Mode
        // All valid problems will kill every enemy on the field, regardless of if it matches requested values or not.
        allCorrectMode: false,

        // Log Data Sent
        // Logs the egress sent every second.
        logAmountOfDataSent: false
    }
};

const defaultMultiplayerRoomConfiguration = {
    settings: {
        // ???
    }
};

module.exports = { developerConfiguration: developerConfiguration };
