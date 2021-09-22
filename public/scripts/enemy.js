let enemyNumber = 0;

class Enemy {
	constructor(xPosition, yPosition, width, height, requestedValue, defaultSpeed, defaultAttack, defaultHealth, color) {
		enemyNumber++;

		var red = (color & 0xff0000) >> 16;
		var green = (color & 0x00ff00) >> 8;
		var blue = color & 0x0000ff;
		var minimum = Math.min(Math.min(red, green), blue) / 255;
		var maximum = Math.max(Math.max(red, green), blue) / 255;

		var textStyle = new PIXI.TextStyle({
			fontFamily: '"Computer Modern Math Italic", Computer Modern Unicode Serif',
			fill: settings.video.enemyColor == "blind" ? "#eeeeee" : ((maximum + minimum) / 2 >= 0.5 ? "#000000" : "#ffffff"),
			fontSize: 40,
		});

		var textMetrics = PIXI.TextMetrics.measureText(requestedValue.toString(), textStyle);

		this.requestedValue = requestedValue.toString();
		this.defaultSpeed = defaultSpeed;
		this.defaultAttack = defaultAttack;
		this.defaultHealth = defaultHealth;
		this.enemyNumber = enemyNumber;
		this.sPosition = Math.max((yPosition - 100) / 10, 1);

		this.textSprite = new PIXI.Text(requestedValue.toString().replace("-", "\u2013"), textStyle);

		this.textSprite.x = xPosition + (width - textMetrics.width) / 2;
		this.textSprite.y = yPosition + (height - textMetrics.height) / 2;

		this.sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.sprite.tint = color;
		this.sprite.x = xPosition;
		this.sprite.y = yPosition;
		this.sprite.width = width;
		this.sprite.height = height;
	}

	move(speed) {
		this.sprite.x -= (speed === undefined ? 2 : speed);
		this.textSprite.x -= (speed === undefined ? 2 : speed);

		if (this.sprite.x < 550) {
			singleplayerScreenContainer.removeChild(this.sprite);
			singleplayerScreenContainer.removeChild(this.textSprite);
			game.enemiesOnField.splice(game.enemiesOnField.indexOf(this), 1);
			game.baseHealth -= 1;
		}
	}
}

