class Tile {
  constructor(termID, slot, selected, tileID) {
    // check if tile already exists on slot
    if (game.tilesOnBoard[slot] !== undefined) {
      singleplayerScreenContainer.removeChild(game.tilesOnBoard[slot].sprite);
    }

    this.slot = slot;
    this.selected = selected;
    this.termID = termID;
    this.tileID = tileID;

    this.sprite = new PIXI.Sprite(
      tileTextures[selected ? 1 : 0][
        termID == 12 && settings.video.multiplicationSignForm == "dot"
          ? 23
          : termID
      ]
    );

    // TODO: i feel like this is going to break really easily

    this.sprite.x =
      initialWindowWidth / 2 +
      64 * ((slot % 7) - 4) +
      16 +
      game.offsets[game.currentGameModePlaying].x;
    this.sprite.y =
      initialWindowHeight / 2 +
      64 * (Math.floor(slot / 7) - 4) +
      156 +
      game.offsets[game.currentGameModePlaying].y;
    this.sprite.interactive = true;
  }
}

function processTileClick(slot) {
  socket.send(
    JSON.stringify({ action: "tileClick", arguments: { slot: slot } })
  );
  game.tilesOnBoard[slot].selected = !game.tilesOnBoard[slot].selected;
}
