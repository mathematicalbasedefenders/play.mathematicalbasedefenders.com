// ORIGINAL IN CLIENT SIDE
class Enemy {
	constructor(enemyInformation){

		this.xPosition = enemyInformation.xPosition;
		this.yPosition = enemyInformation.yPosition;
		this.width = enemyInformation.width;
		this.height = enemyInformation.height;
		this.requestedValue = enemyInformation.requestedValue.toString();
		this.defaultSpeed = enemyInformation.defaultSpeed || 1;
		this.defaultAttack = enemyInformation.defaultAttack || 1;
		this.defaultHealth = enemyInformation.defaultHealth || 1;
		this.enemyNumber = enemyInformation.enemyNumber;
		this.sPosition = enemyInformation.sPosition || 10;
		this.reachedBase = false;
		this.toDestroy = false;
		this.senderName = enemyInformation.senderName || "";

	}

	move(speed) {
		this.sPosition -= (speed === undefined ? 0.25 : speed);
		this.sPosition = this.sPosition.toFixed(3);
	}
}

module.exports = {
	Enemy,
}

