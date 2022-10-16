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

    Enemy.instances.push(this);
  }

  checkIfOverlapping(other) {
    // console.debug(this, other);

    // don't compare with itself
    if (this.enemyNumber === other.enemyNumber) {
      return false;
    }

    let thisLeft = game.enemyRenderStatus[this.enemyNumber].enemySprite.x;
    let thisRight =
      game.enemyRenderStatus[this.enemyNumber].enemySprite.x +
      game.enemyRenderStatus[this.enemyNumber].enemySprite.width;

    let thisTop = game.enemyRenderStatus[this.enemyNumber].y;
    let thisBottom =
      game.enemyRenderStatus[this.enemyNumber].enemySprite.y +
      game.enemyRenderStatus[this.enemyNumber].enemySprite.height;

    let otherLeft = game.enemyRenderStatus[other.enemyNumber].enemySprite.x;
    let otherRight =
      game.enemyRenderStatus[other.enemyNumber].enemySprite.x +
      game.enemyRenderStatus[other.enemyNumber].enemySprite.width;

    let otherTop = game.enemyRenderStatus[other.enemyNumber].enemySprite.y;
    let otherBottom =
      game.enemyRenderStatus[other.enemyNumber].enemySprite.y +
      game.enemyRenderStatus[other.enemyNumber].enemySprite.height;

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

  changeStackLevel() {
    this.stackLevel = 0;
    let sortedEnemies = Object.keys(game.enemyRenderStatus)
      .sort()
      .reduce((object, key) => {
        object[key] = game.enemyRenderStatus[key];
        return object;
      }, {});

    // console.debug(sortedEnemies);
    for (let enemyNumber in sortedEnemies) {
      // console.debug(`Current #: ${enemyNumber}`);
      if ([enemyNumber] === this.enemyNumber) {
        // don't compare with itself
        continue;
      }

      // if (this.checkIfOverlapping(enemy)) {
      //   this.stackLevel++;
      //   enemy.stackLevel++;
      //   if (this.enemySprite.x < enemy.enemySprite.x) {
      //     // this is leftmost
      //     this.stackLevel--;
      //   } else {
      //     // enemy (i.e., other is left most)
      //     enemy.stackLevel--;
      //   }
      // }
      // console.debug(Enemy.instances);
      let initialEnemy = Enemy.findEnemyWithNumber(enemyNumber);

      if (this.checkIfOverlapping(initialEnemy)) {
        // first element is rightmost enemy, which should have highest stack value
        let stack = [this, Enemy.findEnemyWithNumber(enemyNumber)];
        let index = 0;
        while (
          stack[index] &&
          stack[index + 1] &&
          stack[index].checkIfOverlapping(stack[index + 1])
        ) {
          // if (
          //   game.enemyRenderStatus[this.enemyNumber].enemySprite.x <
          //   game.enemyRenderStatus[enemyNumber].enemySprite.x
          // ) {
          //   // this is leftmost
          //   stack[index + 1].stackLevel++;
          // } else {
          //   // enemy (i.e., other is left most)
          //   stack[index].stackLevel++;
          // }

          for (let i = index; i >= 0; i--) {
            stack[i].stackLevel++;
          }

          for (let i = index + 1; i < stack.length; i++) {
            stack[i].stackLevel > 0 && stack[i].stackLevel--;
          }

          // make every enemy before this lose 1 stack level
          for (let i = 0; i < index; i++) {
            stack[i].stackLevel--;
          }

          let nearestEnemyToTheRight =
            stack[index + 1].findNearestEnemyToTheLeft();
          if (nearestEnemyToTheRight) {
            stack.push(nearestEnemyToTheRight);
          }
          index += 1;
        }
      }
    }
  }

  static updateSprites() {
    for (let enemy of Enemy.instances) {
      enemy.changeStackLevel();
    }
    for (let enemy of Enemy.instances) {
      if (!this.minified) {
        game.enemyRenderStatus[enemy.enemyNumber].enemySprite.zIndex =
          -enemy.stackLevel;
        game.enemyRenderStatus[enemy.enemyNumber][
          "requestedValueTextSprite"
        ].zIndex = -enemy.stackLevel;

        if (
          game.enemyRenderStatus[enemy.enemyNumber]["senderNameTextSprite"]
            ?.zIndex
        ) {
          game.enemyRenderStatus[enemy.enemyNumber][
            "senderNameTextSprite"
          ].zIndex = -enemy.stackLevel;
        }

        if (enemy.stackLevel <= 0 || settings.enableStackedEnemies !== "off") {
          game.enemyRenderStatus[enemy.enemyNumber].enemySprite.y =
            enemy.enemyInformation.yPosition;

          enemy.requestedValueTextSprite.y =
            enemy.enemyInformation.yPosition +
            (enemy.enemyInformation.height -
              enemy.requestedValueTextMetrics.height) /
              2;

          enemy.senderNameTextSprite.y =
            enemy.enemyInformation.yPosition +
            (enemy.enemyInformation.height -
              enemy.senderNameTextMetrics.height) /
              2 +
            35;
        } else {
          game.enemyRenderStatus[enemy.enemyNumber].enemySprite.y =
            enemy.enemyInformation.yPosition + enemy.stackLevel * -40;

          enemy.requestedValueTextSprite.y =
            enemy.enemyInformation.yPosition +
            (enemy.enemyInformation.height -
              enemy.requestedValueTextMetrics.height) /
              2 +
            enemy.stackLevel * -40 -
            24;
          enemy.senderNameTextSprite.y =
            enemy.enemyInformation.yPosition +
            (enemy.enemyInformation.height -
              enemy.senderNameTextMetrics.height) /
              2 +
            35 +
            enemy.stackLevel * -40 -
            48;
        }
      }
    }
  }

  findNearestEnemyToTheLeft(ignoreSelf = true) {
    let sorted = Enemy.instances
      .sort((a, b) => parseFloat(a.sPosition) - parseFloat(b.sPosition))
      .reverse();
    let filtered = sorted.filter(
      (element) =>
        parseFloat(element.sPosition) < this.sPosition &&
        (ignoreSelf ? this.enemyNumber != element.enemyNumber : true)
    );
    for (let i = 0; i < filtered; i++) {
      if (filtered[i].sPosition >= this.sPosition) {
        return filtered[i];
      }
    }
  }

  findNearestEnemyToTheRight(ignoreSelf = true) {
    let sorted = Enemy.instances.sort(
      (a, b) => parseFloat(a.sPosition) - parseFloat(b.sPosition)
    );
    let filtered = sorted.filter(
      (element) =>
        parseFloat(element.sPosition) > this.sPosition &&
        (ignoreSelf ? this.enemyNumber != element.enemyNumber : true)
    );
    for (let i = 0; i < filtered; i++) {
      if (filtered[i].sPosition >= this.sPosition) {
        return filtered[i];
      }
    }
  }

  static findEnemyWithNumber(target) {
    return Enemy.instances.find(
      (enemy) => enemy.enemyNumber.toString() === target.toString()
    );
  }

  static clean() {
    Enemy.instances = [];
  }
}
