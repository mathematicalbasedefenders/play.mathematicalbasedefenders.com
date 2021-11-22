class Tile {
	constructor(termID, slot, selected, tileID) {

		// check if tile already exists on slot
		if (game.tilesOnBoard[slot] !== undefined){
			singleplayerScreenContainer.removeChild(game.tilesOnBoard[slot].sprite);
		}


		this.slot = slot;
		this.selected = selected;
		this.termID = termID;
		this.tileID = tileID;

		this.sprite = new PIXI.Sprite(tileTextures[selected ? 1 : 0][(termID==12&&settings.video.multiplicationSignForm == "dot")?23:termID]);
		this.sprite.x = initialWindowWidth / 2 + 64 * ((slot % 7) - 4) + 16;
		this.sprite.y = initialWindowHeight / 2 + 64 * (Math.floor(slot / 7) - 4) + 156;
		this.sprite.interactive = true;

	}
}

function processTileClick(slot) {
	// socket.emit("action");
	socket.emit("tileClick", slot);
	// move this to server soon
	game.tilesOnBoard[slot].selected = !game.tilesOnBoard[slot].selected;
	
}
