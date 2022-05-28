

function generateRandomTileTermID(room, player) {
    let roll =
        room.data.currentGame.players[player].currentGame.availableTermsIndexes[
            Math.floor(
                Math.random() *
                    room.data.currentGame.players[player].currentGame
                        .availableTermsIndexes.length
            )
        ];
    let toReturn = roll;
    room.data.currentGame.players[player].currentGame.bagQuantities[roll]--;
    if (
        room.data.currentGame.players[player].currentGame.bagQuantities[roll] <=
        0
    ) {
        room.data.currentGame.players[
            player
        ].currentGame.availableTermsIndexes.splice(
            room.data.currentGame.players[
                player
            ].currentGame.availableTermsIndexes.indexOf(roll),
            1
        );
        if (
            room.data.currentGame.players[player].currentGame
                .availableTermsIndexes.length <= 0
        ) {
            room.data.currentGame.players[player].currentGame.bagQuantities  [
                4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
            ];
            room.data.currentGame.players[
                player
            ].currentGame.availableTermsIndexes = [
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
            ];
        }
    }
    return toReturn;
}

module.exports = {
    generateRandomTileTermID,
}