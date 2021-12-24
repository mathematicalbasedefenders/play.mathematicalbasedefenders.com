let enemyNumber = 0;

class Enemy {
	// create object
	constructor(xPosition, yPosition, sPosition, width, height, requestedValue, enemyNumber, senderName) {
		// other stuff
		this.xPosition = xPosition;
		this.yPosition = yPosition;
		this.sPosition = sPosition;
		this.width = width;
		this.height = height;
		this.requestedValue = requestedValue;
		this.enemyNumber = enemyNumber;
		this.senderName = senderName;

		// create sprite

		this.enemySprite;
		let enemyColor = createEnemyColor();
		if (document.querySelector("#custom-enemy-picture").querySelector("img")) {
			if (document.querySelector("#custom-enemy-picture").querySelector("img").src != null) {
				let customEnemyPictureURL = document.querySelector("#custom-enemy-picture").querySelector("img").src;
				let customEnemyPictureTexture = PIXI.Texture.from(customEnemyPictureURL);
				this.enemySprite = new PIXI.Sprite(customEnemyPictureTexture);
			} else {
				this.enemySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
				this.enemySprite.tint = enemyColor;
			}
		} else {
			this.enemySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
			this.enemySprite.tint = enemyColor;
		}

		this.enemySprite.width = width;
		this.enemySprite.height = height;

		let red = (enemyColor & 0xff0000) >> 16;
		let green = (enemyColor & 0x00ff00) >> 8;
		let blue = enemyColor & 0x0000ff;
		let minimum = Math.min(Math.min(red, green), blue) / 255;
		let maximum = Math.max(Math.max(red, green), blue) / 255;

		// create text sprite for value
		let requestedValueTextStyleToUse = new PIXI.TextStyle({
			fontFamily: '"Computer Modern Math Italic", Computer Modern Unicode Serif',
			fill: settings.video.enemyColor == "blind" ? "#eeeeee" : (maximum + minimum) / 2 >= 0.5 ? "#000000" : "#ffffff",
			fontSize: 32,
		});
		this.requestedValueTextSprite = new PIXI.Text(requestedValue.toString().replace("-", "\u2013"), requestedValueTextStyleToUse);
		this.requestedValueTextMetrics = PIXI.TextMetrics.measureText(requestedValue.toString(), requestedValueTextStyleToUse);
		this.requestedValueTextSprite.x = xPosition + (width - this.requestedValueTextMetrics.width) / 2;
		this.requestedValueTextSprite.y = yPosition + (height - this.requestedValueTextMetrics.height) / 2;
		this.requestedValueTextSprite.color = enemyColor == "blind" ? "#eeeeee" : (maximum + minimum) / 2 >= 0.5 ? "#000000" : "#ffffff";

		// create text sprite for sender name
		let senderNameTextStyleToUse = textStyles.SIZE_16_FONT;
		this.senderNameTextSprite = new PIXI.Text(senderName.toString(), senderNameTextStyleToUse);
		this.senderNameTextMetrics = PIXI.TextMetrics.measureText(senderName.toString(), senderNameTextStyleToUse);
		this.senderNameTextSprite.x = xPosition + (width - this.senderNameTextMetrics.width) / 2;
		this.senderNameTextSprite.y = yPosition + (height - this.senderNameTextMetrics.height) / 2 + 35;
		this.senderNameTextSprite.color = enemyColor == "blind" ? "#eeeeee" : enemyColor;
	}
}
