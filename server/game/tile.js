class Tile {
	constructor(termID, slot, selected, tileID) {




		this.slot = slot;
		this.selected = selected;
		this.termID = termID;
		this.tileID = tileID;

	}
}

// fix
/*
function processTileClick(tile) {
	processAction();
	room.data.tilesOnBoard[tile.slot].selected = !room.data.tilesOnBoard[tile.slot].selected;
	room.data.tilesOnBoard[tile.slot].sprite.texture = tileTextures[room.data.tilesOnBoard[tile.slot].selected ? 1 : 0][(room.data.tilesOnBoard[tile.slot].termID==12&&settings.video.multiplicationSignForm == "dot")?23:room.data.tilesOnBoard[tile.slot].termID];
	if (tile.selected) {
		room.data.tilesInCurrentProblem.push(tile);
		room.data.currentProblemAsText += convertTermIDToTerm(tile.termID);
		room.data.currentProblemAsBeautifulText += convertTermIDToBeautifulString(tile.termID);
	} else {
		var index = room.data.tilesInCurrentProblem.indexOf(tile.slot);
		room.data.tilesInCurrentProblem.splice(index, 1);
		var temp = room.data.currentProblemAsText.split("");
		temp.splice(index, 1);
		room.data.currentProblemAsText = temp.join("");
		var temp2 = room.data.currentProblemAsBeautifulText.split("");
		temp2.splice(index, 1);
		room.data.currentProblemAsBeautifulText = temp2.join("");
	}
}
*/

module.exports = {
	Tile,
}