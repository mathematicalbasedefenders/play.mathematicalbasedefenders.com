let enemyNumber = 0;

class Enemy {
    // create object
    constructor(enemyInformation) {
        // other stuff
        this.xPosition = enemyInformation.xPosition;
        this.yPosition = enemyInformation.yPosition;
        this.sPosition = enemyInformation.sPosition;
        this.width = enemyInformation.width;
        this.height = enemyInformation.height;
        this.requestedValue = enemyInformation.requestedValue;
        this.enemyNumber = enemyInformation.enemyNumber;
        this.senderName = enemyInformation.senderName;
        this.minified = enemyInformation.minified;
        // create sprite

        this.enemySprite;
        let enemyColor = createEnemyColor();
        if (
            document.querySelector("#custom-enemy-picture").querySelector("img")
        ) {
            if (
                document
                    .querySelector("#custom-enemy-picture")
                    .querySelector("img").src
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

        this.enemySprite.width = enemyInformation.width;
        this.enemySprite.height = enemyInformation.height;

        let red = (enemyColor & 0xff0000) >> 16;
        let green = (enemyColor & 0x00ff00) >> 8;
        let blue = enemyColor & 0x0000ff;
        let minimum = Math.min(Math.min(red, green), blue) / 255;
        let maximum = Math.max(Math.max(red, green), blue) / 255;

        // create text sprite for value
        let requestedValueTextStyleToUse = new PIXI.TextStyle({
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


        if (!this.minified){
        this.requestedValueTextSprite = new PIXI.Text(
            enemyInformation.requestedValue.toString().replace("-", "\u2013"),
            requestedValueTextStyleToUse
        );
        this.requestedValueTextMetrics = PIXI.TextMetrics.measureText(
            enemyInformation.requestedValue.toString(),
            requestedValueTextStyleToUse
        );
        this.requestedValueTextSprite.x =
            enemyInformation.xPosition +
            (enemyInformation.width - this.requestedValueTextMetrics.width) / 2;
        this.requestedValueTextSprite.y =
            enemyInformation.yPosition +
            (enemyInformation.height - this.requestedValueTextMetrics.height) /
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
            enemyInformation.senderName.toString(),
            senderNameTextStyleToUse
        );
        this.senderNameTextMetrics = PIXI.TextMetrics.measureText(
            enemyInformation.senderName.toString(),
            senderNameTextStyleToUse
        );
        this.senderNameTextSprite.x =
            enemyInformation.xPosition +
            (enemyInformation.width - this.senderNameTextMetrics.width) / 2;
        this.senderNameTextSprite.y =
            enemyInformation.yPosition +
            (enemyInformation.height - this.senderNameTextMetrics.height) / 2 +
            35;
        this.senderNameTextSprite.color =
            enemyColor == "blind" ? "#eeeeee" : enemyColor;
        }
    }
}
