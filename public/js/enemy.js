let enemyNumber = 0;

class Enemy {
  // create object
  static instances = [];

  constructor(enemyInformation) {
    this.enemyInformation = enemyInformation;

    // other stuff
    this.xPosition = this.enemyInformation.xPosition;
    this.yPosition = this.enemyInformation.yPosition;
    this.sPosition = this.enemyInformation.sPosition;
    this.width = this.enemyInformation.width;
    this.height = this.enemyInformation.height;
    this.requestedValue = this.enemyInformation.requestedValue;
    this.enemyNumber = this.enemyInformation.enemyNumber;
    this.senderName = this.enemyInformation.senderName;
    this.minified = this.enemyInformation.minified;

    this.stackLevel = 0;

    this.enemySprite;

    let enemyColor = createEnemyColor();
    if (document.querySelector("#custom-enemy-picture").querySelector("img")) {
      if (
        document.querySelector("#custom-enemy-picture").querySelector("img")
          .src &&
        JSON.parse(localStorage.getItem("settings"))?.video
          ?.customEnemyPictureURL
      ) {
        let customEnemyPictureURL = document
          .querySelector("#custom-enemy-picture")
          .querySelector("img").src;
        let customEnemyPictureTexture = PIXI.Texture.from(
          customEnemyPictureURL
        );
        this.enemySprite = new PIXI.Sprite(customEnemyPictureTexture);
      } else {
        this.enemySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        this.enemySprite.tint = enemyColor;
      }
    } else {
      this.enemySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.enemySprite.tint = enemyColor;
    }

    let red = (enemyColor & 0xff0000) >> 16;
    let green = (enemyColor & 0x00ff00) >> 8;
    let blue = enemyColor & 0x0000ff;
    let minimum = Math.min(Math.min(red, green), blue) / 255;
    let maximum = Math.max(Math.max(red, green), blue) / 255;

    this.requestedValueTextStyleToUse = new PIXI.TextStyle({
      fontFamily:
        '"Computer Modern Math Italic", Computer Modern Unicode Serif',
      fill:
        settings.video.enemyColor == "blind"
          ? "#eeeeee"
          : (maximum + minimum) / 2 >= 0.5
          ? "#000000"
          : "#ffffff",
      fontSize: 32
    });

    this.enemySprite.width = enemyInformation.width;
    this.enemySprite.height = enemyInformation.height;

    this.requestedValueTextSprite = new PIXI.Text(
      this.enemyInformation.requestedValue.toString().replace("-", "\u2013"),
      this.requestedValueTextStyleToUse
    );
    this.requestedValueTextMetrics = PIXI.TextMetrics.measureText(
      this.enemyInformation.requestedValue.toString(),
      this.requestedValueTextStyleToUse
    );
    this.requestedValueTextSprite.x =
      this.enemyInformation.xPosition +
      (this.enemyInformation.width - this.requestedValueTextMetrics.width) / 2;
    this.requestedValueTextSprite.y =
      this.enemyInformation.yPosition +
      (this.enemyInformation.height - this.requestedValueTextMetrics.height) /
        2;
    this.requestedValueTextSprite.color =
      enemyColor == "blind"
        ? "#eeeeee"
        : (maximum + minimum) / 2 >= 0.5
        ? "#000000"
        : "#ffffff";

    // create text sprite for sender name
    let senderNameTextStyleToUse = textStyles.SIZE_16_FONT;
    this.senderNameTextSprite = new PIXI.Text(
      this.enemyInformation.senderName.toString(),
      senderNameTextStyleToUse
    );
    this.senderNameTextMetrics = PIXI.TextMetrics.measureText(
      this.enemyInformation.senderName.toString(),
      senderNameTextStyleToUse
    );
    this.senderNameTextSprite.x =
      this.enemyInformation.xPosition +
      (this.enemyInformation.width - this.senderNameTextMetrics.width) / 2;
    this.senderNameTextSprite.y =
      this.enemyInformation.yPosition +
      (this.enemyInformation.height - this.senderNameTextMetrics.height) / 2 +
      35;
    this.senderNameTextSprite.color =
      enemyColor == "blind" ? "#eeeeee" : enemyColor;

    if (!this.minified) {
      this.updateSpriteAccordingToStackLayer();
    }

    Enemy.instances.push(this);
  }

  checkIfOverlapping(other) {
    let thisLeft = this.xPosition;
    let thisRight = this.xPosition + this.width;

    let thisTop = this.yPosition;
    let thisBottom = this.yPosition + this.height;

    let otherLeft = other.xPosition;
    let otherRight = other.xPosition + other.width;

    let otherTop = other.yPosition;
    let otherBottom = other.yPosition + other.height;

    if (
      thisLeft < otherRight &&
      thisRight > otherLeft // &&
      // thisTop < otherBottom &&
      // thisBottom > otherTop
    ) {
      return true;
    }
    return false;
  }

  countOverlapping() {
    let total = 0;
    for (let enemy in game.enemyRenderStatus) {
      if (enemy.enemyNumber === this.enemyNumber) {
        // don't compare with itself
        continue;
      }
      if (this.checkIfOverlapping(this, enemy.enemySprite)) {
        total++;
      }
    }
    return total;
  }

  static updateSprites() {
    this.stackLevel = this.countOverlapping();

    // debug only
    this.requestedValueTextSprite.text = this.stackLevel;

    if (this.stackLevel === 0) {
      this.requestedValueTextSprite.x =
        this.enemyInformation.xPosition +
        (this.enemyInformation.width - this.requestedValueTextMetrics.width) /
          2;
      this.requestedValueTextSprite.y =
        this.enemyInformation.yPosition +
        (this.enemyInformation.height - this.requestedValueTextMetrics.height) /
          2;

      this.senderNameTextSprite.x =
        this.enemyInformation.xPosition +
        (this.enemyInformation.width - this.senderNameTextMetrics.width) / 2;
      this.senderNameTextSprite.y =
        this.enemyInformation.yPosition +
        (this.enemyInformation.height - this.senderNameTextMetrics.height) / 2 +
        35;
    } else {
      this.requestedValueTextSprite.y =
        this.enemyInformation.yPosition +
        (this.enemyInformation.height - this.requestedValueTextMetrics.height) /
          2 +
        this.stackLevel * 40;
      this.senderNameTextSprite.y =
        this.enemyInformation.yPosition +
        (this.enemyInformation.height - this.senderNameTextMetrics.height) / 2 +
        35 +
        this.stackLevel * 40;
    }
  }

  static clean() {
    Enemy.instances = [];
  }
}
