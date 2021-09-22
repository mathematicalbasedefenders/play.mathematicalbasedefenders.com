// ORIGINAL IN CLIENT SIDE
class Enemy {
	constructor(xPosition, yPosition, width, height, requestedValue, defaultSpeed, defaultAttack, defaultHealth, enemyNumber) {

		this.xPosition = xPosition;
		this.yPosition = yPosition;
		this.width = width;
		this.height = height;
		this.requestedValue = requestedValue.toString();
		this.defaultSpeed = defaultSpeed;
		this.defaultAttack = defaultAttack;
		this.defaultHealth = defaultHealth;
		this.enemyNumber = enemyNumber;
		this.sPosition = 10;
		this.reachedBase = false;
		this.toDestroy = false;

	}

	move(speed) {
		this.sPosition -= (speed === undefined ? 0.25 : speed);
		this.sPosition = this.sPosition.toFixed(3);
	}
}

module.exports = {
	Enemy,
}

