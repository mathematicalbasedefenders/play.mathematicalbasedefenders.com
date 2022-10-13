class OpponentGameInstance {
  constructor(minifiedGameData) {
    this.playerIndex = minifiedGameData.playerIndex;

    this.enemySprites = {};
    this.tileSprites = [];
    this.statisticsText = new PIXI.Text(
      minifiedGameData.actionsPerMinute +
        " " +
        minifiedGameData.baseHealth +
        "/10 " +
        minifiedGameData.enemiesPending,
      textStyles.SIZE_16_FONT
    );
    this.nameText = new PIXI.Text(
      minifiedGameData.playerName,
      textStyles.SIZE_16_FONT
    );
    // TODO: pass by reference
    // this.nameText.style."fill" = minifiedGameData.nameColor;
    changePIXIJSTextStyle(this.nameText, "fill", minifiedGameData.nameColor);
    this.problemText = new PIXI.Text(
      minifiedGameData.problem,
      textStyles.SIZE_16_FONT
    );

    this.baseHealth = minifiedGameData.baseHealth;

    this.xPosition = 490;
    this.yPosition = 490;

    this.container;

    this.setPositions = () => {
      for (let i = 0; i < 49; i++) {
        this.tileSprites[i] = new Tile(
          minifiedGameData.tiles[i].termID,
          i,
          minifiedGameData.tiles[i].selected,
          minifiedGameData.tiles[i].tileID
        ).sprite;
        this.tileSprites[i].scale.x = 0.25 * game.opponentGameInstanceScale;
        this.tileSprites[i].scale.y = 0.25 * game.opponentGameInstanceScale;

        this.tileSprites[i].position.x =
          initialWindowWidth / 2 +
          (this.playerIndex %
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
            game.opponentGameInstanceSettings
              .opponentGameInstancePositionIncrements.x *
            game.opponentGameInstanceScale +
          game.renderingOffsets.multiplayer.opponents.x +
          this.xPosition +
          (i % 7) * 16 * game.opponentGameInstanceScale;
        this.tileSprites[i].position.y =
          Math.floor(
            this.playerIndex /
              game.opponentGameInstanceSettings.opponentGameInstancesPerRow
          ) *
            game.opponentGameInstanceSettings
              .opponentGameInstancePositionIncrements.y *
            game.opponentGameInstanceScale +
          game.renderingOffsets.multiplayer.opponents.y +
          this.yPosition +
          30 +
          Math.floor(i / 7) * 16 * game.opponentGameInstanceScale;
      }

      for (let i = 0; i < minifiedGameData.enemies.length; i++) {
        let enemy = minifiedGameData.enemies[i];

        if (enemy.enemyNumber >= -0.1) {
          this.enemySprites[enemy.enemyNumber] = {};
          this.enemySprites[enemy.enemyNumber]["sprite"] = new Enemy(
            enemy
          ).enemySprite;
          this.enemySprites[enemy.enemyNumber]["sprite"].position.x =
            initialWindowWidth / 2 +
            (this.playerIndex %
              game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
              game.opponentGameInstanceSettings
                .opponentGameInstancePositionIncrements.x *
              game.opponentGameInstanceScale +
            game.renderingOffsets.multiplayer.opponents.x +
            this.xPosition +
            enemy.sPosition * 11.2;
          this.enemySprites[enemy.enemyNumber]["sprite"].position.y =
            Math.floor(
              this.playerIndex /
                game.opponentGameInstanceSettings.opponentGameInstancesPerRow
            ) *
              game.opponentGameInstanceSettings
                .opponentGameInstancePositionIncrements.y *
              game.opponentGameInstanceScale +
            game.renderingOffsets.multiplayer.opponents.y +
            this.yPosition;
          this.enemySprites[enemy.enemyNumber]["sprite"].scale.x =
            0.585 * game.opponentGameInstanceScale;
          this.enemySprites[enemy.enemyNumber]["sprite"].scale.y =
            0.585 * game.opponentGameInstanceScale;

          this.enemySprites[enemy.enemyNumber]["sPosition"] =
            enemy.sPosition * game.opponentGameInstanceScale;
        }
      }

      // FIXME: refer to commit a2aec2f
      this.problemText.position.x =
        initialWindowWidth / 2 +
        (this.playerIndex %
          game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.x *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.x +
        this.xPosition;
      this.problemText.position.y =
        Math.floor(
          this.playerIndex /
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow
        ) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.y *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.y +
        this.yPosition +
        10 * game.opponentGameInstanceScale;

      this.statisticsText.position.x =
        initialWindowWidth / 2 +
        (this.playerIndex %
          game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.x *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.x +
        this.xPosition;
      this.statisticsText.position.y =
        Math.floor(
          this.playerIndex /
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow
        ) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.y *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.y +
        this.yPosition +
        145 * game.opponentGameInstanceScale;

      this.nameText.position.x =
        initialWindowWidth / 2 +
        (this.playerIndex %
          game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.x *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.x +
        this.xPosition;
      this.nameText.position.y =
        Math.floor(
          this.playerIndex /
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow
        ) *
          game.opponentGameInstanceSettings
            .opponentGameInstancePositionIncrements.y *
          game.opponentGameInstanceScale +
        game.renderingOffsets.multiplayer.opponents.y +
        this.yPosition +
        165 * game.opponentGameInstanceScale;
    };

    this.setPositions();
  }

  update(minifiedGameData) {
    for (let i = 0; i < 49; i++) {
      this.tileSprites[i].texture = new Tile(
        minifiedGameData.tiles[i][1],
        i,
        minifiedGameData.tiles[i][2],
        null
      ).sprite.texture;
    }

    for (let i = 0; i < minifiedGameData.enemies.length; i++) {
      let minifiedEnemy = minifiedGameData.enemies[i];

      let enemy = {
        sPosition: minifiedEnemy[0],
        enemyNumber: minifiedEnemy[1],
        minified: true
      };

      if (!this.enemySprites[enemy.enemyNumber]) {
        this.enemySprites[enemy.enemyNumber] = {};
        this.enemySprites[enemy.enemyNumber]["sprite"] = new Enemy(
          enemy
        ).enemySprite;
        this.enemySprites[enemy.enemyNumber]["sprite"].position.x =
          initialWindowWidth / 2 +
          (this.playerIndex %
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
            game.opponentGameInstanceSettings
              .opponentGameInstancePositionIncrements.x *
            game.opponentGameInstanceScale +
          game.renderingOffsets.multiplayer.opponents.x +
          this.xPosition +
          enemy.sPosition * 11.2;
        this.enemySprites[enemy.enemyNumber]["sprite"].position.y =
          Math.floor(
            this.playerIndex /
              game.opponentGameInstanceSettings.opponentGameInstancesPerRow
          ) *
            game.opponentGameInstanceSettings
              .opponentGameInstancePositionIncrements.y *
            game.opponentGameInstanceScale +
          game.renderingOffsets.multiplayer.opponents.y +
          this.yPosition;
        this.enemySprites[enemy.enemyNumber]["sprite"].scale.x =
          0.585 * game.opponentGameInstanceScale;
        this.enemySprites[enemy.enemyNumber]["sprite"].scale.y =
          0.585 * game.opponentGameInstanceScale;

        this.enemySprites[enemy.enemyNumber]["sPosition"] =
          enemy.sPosition * game.opponentGameInstanceScale;
      }

      this.enemySprites[enemy.enemyNumber]["sPosition"] =
        enemy.sPosition * game.opponentGameInstanceScale;
      if (enemy.sPosition >= -0.01) {
        if (!this.enemySprites[enemy.enemyNumber].appeared) {
          this.container.addChild(
            this.enemySprites[enemy.enemyNumber]["sprite"]
          );
          this.enemySprites[enemy.enemyNumber]["appeared"] = true;
        } else {
          this.enemySprites[enemy.enemyNumber]["sprite"].position.x =
            initialWindowWidth / 2 +
            (this.playerIndex %
              game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
              game.opponentGameInstanceSettings
                .opponentGameInstancePositionIncrements.x *
              game.opponentGameInstanceScale +
            game.renderingOffsets.multiplayer.opponents.x +
            this.xPosition +
            this.enemySprites[enemy.enemyNumber]["sPosition"] * 11.2;
        }
      } else {
        this.container.removeChild(
          this.enemySprites[enemy.enemyNumber]["sprite"]
        );
        delete this.enemySprites[enemy.enemyNumber];
      }
    }

    this.problemText.text = minifiedGameData.problem;
    this.baseHealth = minifiedGameData.baseHealth;
    this.statisticsText.text =
      minifiedGameData.actionsPerMinute.toFixed(3) +
      " " +
      minifiedGameData.baseHealth +
      "/10 " +
      minifiedGameData.enemiesPending;
    this.nameText.text = minifiedGameData.name;

    // scale text
    this.problemText.scale.x = game.opponentGameInstanceScale;
    this.problemText.scale.y = game.opponentGameInstanceScale;
    this.statisticsText.scale.x = game.opponentGameInstanceScale;
    this.statisticsText.scale.y = game.opponentGameInstanceScale;
    this.nameText.scale.x = game.opponentGameInstanceScale;
    this.nameText.scale.y = game.opponentGameInstanceScale;

    // this.nameText.style."fill" = minifiedGameData.nameColor;
    changePIXIJSTextStyle(this.nameText, "fill", minifiedGameData.nameColor);
  }

  render(container) {
    this.container = container;

    // remove old

    for (let i = 0; i < 49; i++) {
      this.container.addChild(this.tileSprites[i]);
    }

    for (let i = 0; i < this.enemySprites.length; i++) {
      if (!this.enemySprites[i].appeared) {
        container.addChild(this.enemySprites[i]["sprite"]);
        this.enemySprites[i]["appeared"] = true;
      } else {
        this.enemySprites[i]["sprite"].position.x =
          initialWindowWidth / 2 +
          (Math.floor(
            this.playerIndex /
              game.opponentGameInstanceSettings.opponentGameInstancesPerRow
          ) %
            game.opponentGameInstanceSettings.opponentGameInstancesPerRow) *
            game.opponentGameInstanceSettings
              .opponentGameInstancePositionIncrements.y +
          game.renderingOffsets.multiplayer.opponents.x +
          this.xPosition * game.opponentGameInstanceScale +
          this.enemySprites[i]["sPosition"] * 11.2;
      }
    }

    this.container.addChild(this.statisticsText);
    this.container.addChild(this.nameText);
    this.container.addChild(this.problemText);
  }

  // TODO: Find better function name
  destroy(keepEnemies, resetEnemies) {
    let enemySpritesToDestroy = Object.keys(this.enemySprites);
    if (!keepEnemies) {
      for (let enemy of enemySpritesToDestroy) {
        this.container.removeChild(this.enemySprites[enemy]["sprite"]);
      }
    }
    if (resetEnemies) {
      for (let enemy of enemySpritesToDestroy) {
        this.enemySprites[enemy]["sprite"].appeared = false;
      }
    }
    for (let i = 0; i < 49; i++) {
      this.container.removeChild(this.tileSprites[i]);
    }

    this.container.removeChild(this.statisticsText);
    this.container.removeChild(this.nameText);
    this.container.removeChild(this.problemText);
  }

  rerender(newPlayerIndex, newContainer) {
    this.playerIndex = newPlayerIndex;
    this.destroy(false, true);
    this.setPositions();
    this.render(newContainer);
  }
}
