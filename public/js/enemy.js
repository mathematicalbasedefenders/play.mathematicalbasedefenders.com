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

    if (this.minified === false) {
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
        (this.enemyInformation.width - this.requestedValueTextMetrics.width) /
          2;
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
    }
    Enemy.instances.push(this);
  }

  checkIfOverlapping(other, leftTrimAmount = 0, rightTrimAmount = 0) {
    // don't compare with itself
    if (this.enemyNumber === other.enemyNumber) {
      return false;
    }

    if (this.minified !== false || other.minified !== false) {
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
      thisLeft + leftTrimAmount - otherRight < 0 &&
      thisRight - rightTrimAmount - otherLeft > 0 // &&
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

    for (let enemyNumber in sortedEnemies) {
      let initialEnemy = Enemy.findEnemyWithNumber(enemyNumber);
      if (
        [enemyNumber] === this.enemyNumber ||
        this.minified !== false ||
        initialEnemy == null ||
        initialEnemy.minified !== false
      ) {
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
      if (enemy.minified === false) {
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

        if (
          enemy.stackLevel <= 0 ||
          settings.video.enableStackedEnemies !== "on"
        ) {
          game.enemyRenderStatus[enemy.enemyNumber].enemySprite.y =
            enemy.enemyInformation.yPosition;

          if (enemy?.requestedValueTextSprite?.y) {
            enemy.requestedValueTextSprite.y =
              enemy.enemyInformation.yPosition +
              (enemy.enemyInformation.height -
                (enemy?.requestedValueTextMetrics?.height ?? 0)) /
                2;
          }
          if (enemy?.senderNameTextSprite?.y) {
            enemy.senderNameTextSprite.y =
              enemy.enemyInformation.yPosition +
              (enemy.enemyInformation.height -
                (enemy?.requestedValueTextMetrics?.height ?? 0)) /
                2 +
              35;
          }
        } else {
          game.enemyRenderStatus[enemy.enemyNumber].enemySprite.y =
            enemy.enemyInformation.yPosition + enemy.stackLevel * -40;
          if (enemy?.requestedValueTextSprite?.y) {
            enemy.requestedValueTextSprite.y =
              enemy.enemyInformation.yPosition +
              (enemy.enemyInformation.height -
                (enemy?.requestedValueTextMetrics?.height ?? 0)) /
                2 +
              enemy.stackLevel * -40 -
              24;
          }
          if (enemy?.senderNameTextSprite?.y) {
            enemy.senderNameTextSprite.y =
              enemy.enemyInformation.yPosition +
              (enemy.enemyInformation.height -
                (enemy?.requestedValueTextMetrics?.height ?? 0)) /
                2 +
              35 +
              enemy.stackLevel * -40 -
              48;
          }
        }
      }
    }
  }

  findNearestEnemyToTheLeft(
    ignoreSelf = true,
    ignoreUndefinedMinified = true,
    ignoreMinified = true
  ) {
    let sorted = Enemy.instances
      .sort(
        (a, b) =>
          parseFloat(a.enemyInformation.sPosition) -
          parseFloat(b.enemyInformation.sPosition)
      )
      .reverse();
    let filtered = sorted.filter(
      (element) =>
        parseFloat(element.enemyInformation.sPosition) < this.sPosition &&
        (ignoreSelf
          ? this.enemyNumber != element.enemyInformation.enemyNumber
          : true) &&
        (ignoreUndefinedMinified
          ? element.enemyInformation.minified != null
          : true) &&
        (ignoreMinified ? element.enemyInformation.minified !== true : true)
    );
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].sPosition <= this.sPosition) {
        return filtered[i];
      }
    }
  }

  findNearestEnemyToTheRight(
    ignoreSelf = true,
    ignoreUndefinedMinified = true,
    ignoreMinified = true
  ) {
    let sorted = Enemy.instances.sort(
      (a, b) =>
        parseFloat(a.enemyInformation.sPosition) -
        parseFloat(b.enemyInformation.sPosition)
    );
    let filtered = sorted.filter(
      (element) =>
        parseFloat(element.enemyInformation.sPosition) > this.sPosition &&
        (ignoreSelf
          ? this.enemyNumber != element.enemyInformation.enemyNumber
          : true) &&
        (ignoreUndefinedMinified
          ? element.enemyInformation.minified != null
          : true) &&
        (ignoreMinified ? element.enemyInformation.minified !== true : true)
    );
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].sPosition >= this.sPosition) {
        return filtered[i];
      }
    }
  }

  static findEnemyWithNumber(
    target,
    ignoreUndefinedMinified = true,
    ignoreMinified = true
  ) {
    return Enemy.instances.find(
      (element) =>
        element.enemyNumber.toString() === target.toString() &&
        (ignoreUndefinedMinified
          ? element.enemyInformation.minified != null
          : true) &&
        (ignoreMinified ? element.enemyInformation.minified !== true : true)
    );
  }

  static clean() {
    Enemy.instances = [];
  }

  static cleanDead() {
    Enemy.instances = Enemy.instances.filter(
      (enemy) => parseFloat(enemy.sPosition) > -0.01 // && !enemy.toDestroy
    );
  }
}
