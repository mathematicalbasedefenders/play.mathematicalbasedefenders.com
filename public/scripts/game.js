// ======================================================================================== START OF INITIALIZATION =====================================================================

// Initialization

// Variables that for some reason need to be loaded first
var initializationFinished = false;

var computerModernUnicodeSerifFont = new FontFaceObserver("Computer Modern Unicode Serif");
var computerModernMathItalicFont = new FontFaceObserver("Computer Modern Math Italic");

Promise.all([computerModernUnicodeSerifFont.load(), computerModernMathItalicFont.load()]).then(function () {
	console.log("Loaded fonts!");
});

var socket = io();

// socket.io functions
socket.on("connect", () => {
	// either with send()
	console.log("Connected to server!");
});

const screens = {
	MAIN_MENU_SCREEN: "mainMenuScreen",
	INFORMATION_SCREEN: "informationScreen",
	SINGLEPLAYER_GAME_SCREEN: "singleplayerGameScreen",
	SETTINGS_SCREEN: "settingsScreen",
	GAME_OVER_SCREEN: "gameOverScreen",
};

const settingsScreens = {
	VIDEO_SETTINGS_SCREEN: "videoSettingsScreen",
	AUDIO_SETTINGS_SCREEN: "audioSettingsScreen",
	INPUT_SETTINGS_SCREEN: "inputSettingsScreen",
	ONLINE_SETTINGS_SCREEN: "onlineSettingsScreen",
};

var pixiCanvas = document.getElementById("pixi-canvas");
document.getElementById("pixi-canvas").style.display = "none";
// IMPORTANT VARIABLES
var currentScreen = screens.MAIN_MENU_SCREEN;
var settings = {};

restoreSettings();

// "Logical" Variables

var framesRenderedSinceLaunch = 0.0;
var initialWindowWidth = window.screen.width;
var initialWindowHeight = window.screen.availHeight - (window.outerHeight - window.innerHeight);
var initialRatio = initialWindowWidth / initialWindowHeight;

var enemyGenerationElapsedFramesCounter = 0;

// Game Variables
var game = {
	renderedEnemiesOnField: [],
	spritesOfRenderedEnemiesOnField: [],
	enemiesRenderedLastUpdate: [],
	enemyRenderStatus: {},
	scoreGainIndicatorRenderStatus: {},
	tilesOnBoard: [],
};

var finalGameData;

// Constants

const TERMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "*", "/", "=", "a", "b", "c", "d", "n", "x", "y", "z"];
const TERMS_AS_BEAUTIFUL_STRINGS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "\u2013", "×", "÷", "=", "a", "b", "c", "d", "n", "x", "y", "z"];

// PIXI Variables
var app = new PIXI.Application({
	width: window.screen.width,
	height: window.screen.height,
	backgroundColor: 0xeeeeee,
	autoResize: true,
	resizeTo: window,
	resolution: devicePixelRatio,
	view: pixiCanvas,
});

renderer = PIXI.autoDetectRenderer(initialWindowWidth, initialWindowHeight);

document.body.appendChild(app.renderer.view);
app.renderer.plugins.accessibility.destroy();

var mainMenuScreenContainer = new PIXI.Container();
var singleplayerScreenContainer = new PIXI.Container();

app.stage.addChild(mainMenuScreenContainer);
mainMenuScreenContainer.visible = false; // for now
app.stage.addChild(singleplayerScreenContainer);
singleplayerScreenContainer.visible = false; // for now

switch (currentScreen) {
	case screens.MAIN_MENU_SCREEN: {
		console.log("hit!");
		// mainMenuScreenContainer.visible = true; // for now
		break;
	}
	case screens.SINGLEPLAYER_GAME_SCREEN: {
		document.getElementById("pixi-canvas").style.display = "block";
		singleplayerScreenContainer.visible = true; // for now
		break;
	}
}

// Constants so this is easier

var textStyles = {
	SIZE_24_FONT: new PIXI.TextStyle({ fontFamily: "Computer Modern Unicode Serif", fontSize: 24 }),
	SIZE_32_FONT: new PIXI.TextStyle({ fontFamily: "Computer Modern Unicode Serif", fontSize: 32 }),
	SIZE_40_FONT: new PIXI.TextStyle({ fontFamily: "Computer Modern Unicode Serif", fontSize: 40 }),
	SIZE_64_FONT: new PIXI.TextStyle({ fontFamily: "Computer Modern Unicode Serif", fontSize: 64 }),
	SIZE_72_FONT: new PIXI.TextStyle({ fontFamily: "Computer Modern Unicode Serif", fontSize: 72 }),

	SIZE_32_MATH_FONT: new PIXI.TextStyle({ fontFamily: '"Computer Modern Math Italic", Computer Modern Unicode Serif', fontSize: 32 }),
	SIZE_72_MATH_FONT: new PIXI.TextStyle({ fontFamily: '"Computer Modern Math Italic", Computer Modern Unicode Serif', fontSize: 72 }),
};

// =============== START OF SINGLEPLAYER SCREEN ITEMS ====================

// Sprites
var sendButtonTexture = PIXI.Texture.from("assets/images/singleplayer-screen/sendbutton.png");
var sendButtonSprite = new PIXI.Sprite(sendButtonTexture);
sendButtonSprite.x = initialWindowWidth / 2 + 64 * -4 + 16;
sendButtonSprite.y = initialWindowHeight / 2 + 64 * 3 + 176;
sendButtonSprite.interactive = true;
sendButtonSprite.on("click", function () {
	sendProblem();
});

// Text

var currentProblemText = new PIXI.Text("", textStyles.SIZE_72_MATH_FONT);
currentProblemText.style.align = "center";
currentProblemText.tint = 0x000000;
currentProblemText.y = initialWindowHeight / 2 - 200;

var scoreLabelerText = new PIXI.Text("Score", textStyles.SIZE_24_FONT);
scoreLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
scoreLabelerText.y = initialWindowHeight / 2 - 100;

var currentScoreText = new PIXI.Text("0", textStyles.SIZE_64_FONT);
currentScoreText.x = initialWindowWidth / 2 + 64 * 2 + 96;
currentScoreText.y = initialWindowHeight / 2 - 80;

var timeLabelerText = new PIXI.Text("Time", textStyles.SIZE_24_FONT);
timeLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
timeLabelerText.y = initialWindowHeight / 2 - 10;

var currentTimeText = new PIXI.Text("0:00.000", textStyles.SIZE_40_FONT);
currentTimeText.x = initialWindowWidth / 2 + 64 * 2 + 96;
currentTimeText.y = initialWindowHeight / 2 + 10;

var baseHealthText = new PIXI.Text("Base Health: 10/10", textStyles.SIZE_24_FONT);
baseHealthText.x = initialWindowWidth / 2 + 64 * 2 + 96;
baseHealthText.y = initialWindowHeight / 2 + 60;

var enemiesText = new PIXI.Text("Enemies: 0/0", textStyles.SIZE_24_FONT);
enemiesText.x = initialWindowWidth / 2 + 64 * 2 + 96;
enemiesText.y = initialWindowHeight / 2 + 90;

var valueOfVariableAText = new PIXI.Text("a = ?", textStyles.SIZE_32_MATH_FONT);
valueOfVariableAText.x = initialWindowWidth / 2 + 64 * 2 + 96;
valueOfVariableAText.y = initialWindowHeight / 2 + 120;

var valueOfVariableBText = new PIXI.Text("b = ?", textStyles.SIZE_32_MATH_FONT);
valueOfVariableBText.x = initialWindowWidth / 2 + 64 * 2 + 96;
valueOfVariableBText.y = initialWindowHeight / 2 + 150;

var valueOfVariableCText = new PIXI.Text("c = ?", textStyles.SIZE_32_MATH_FONT);
valueOfVariableCText.x = initialWindowWidth / 2 + 64 * 2 + 96;
valueOfVariableCText.y = initialWindowHeight / 2 + 180;

var valueOfVariableDText = new PIXI.Text("d = ?", textStyles.SIZE_32_MATH_FONT);
valueOfVariableDText.x = initialWindowWidth / 2 + 64 * 2 + 96;
valueOfVariableDText.y = initialWindowHeight / 2 + 210;

// Left of grid

var actionsPerMinuteLabelerText = new PIXI.Text("Actions Per Minute", textStyles.SIZE_24_FONT);
actionsPerMinuteLabelerText.x = initialWindowWidth / 2 - 465;
actionsPerMinuteLabelerText.y = initialWindowHeight / 2 - 10;

var actionsPerMinuteText = new PIXI.Text("0.000", textStyles.SIZE_40_FONT);
actionsPerMinuteText.x = initialWindowWidth / 2 - 450;
actionsPerMinuteText.y = initialWindowHeight / 2 + 10;

var currentComboText = new PIXI.Text("", textStyles.SIZE_40_FONT);
currentComboText.x = initialWindowWidth / 2 - 450;
currentComboText.y = initialWindowHeight / 2 - 80;

// Images
var baseTexture = new PIXI.Texture.from("assets/images/singleplayer-screen/base.png");
var baseSprite = new PIXI.Sprite(baseTexture);
baseSprite.x = initialWindowWidth / 2 - 450;
baseSprite.y = initialWindowHeight / 2 - 465;

var tileTextures = [[], []];

for (i = 0; i < 2; i++) {
	for (j = 0; j < 24; j++) {
		var s1 = i == 1 ? "selected" : "";
		var tile = PIXI.Texture.from("assets/images/singleplayer-screen/tile" + j.toString() + s1 + ".png");
		tileTextures[i][j] = tile;
	}
}

// =============== END OF SINGLEPLAYER SCREEN ITEMS ====================

// =============== START OF OTHER STUFF ===============================
// Input
var keyRebindProcessUnderway = false;
$(document).keydown(function (event) {
	if (event.code != "Tab") {
		if (keyRebindProcessUnderway || keyRebindProcessUnderway === "0") {
			// 3 equal signs or it wont work!!!!
			let keyAlreadyHasATile = false;
			for (let i = 0; i < 19; i++) {
				if (event.code == $("#key-to-force-select-tile-" + i).text()) {
					keyAlreadyHasATile = true;
					break;
				}
			}
			if (keyAlreadyHasATile) {
				alert("Key already has a tile assigned to it!");
				keyRebindProcessUnderway = false;
			} else {
				$("#key-to-force-select-tile-" + keyRebindProcessUnderway).text(event.code);
				keyRebindProcessUnderway = false;
			}
		} else {
			processKeypress(event);
		}
	} else {
	}
});
// =============== END OF OTHER STUFF ===============================

// Initialization Finished
initializationFinished = true;

// ======================================================================================== END OF INITIALIZATION =====================================================================
console.log("Initialization finished!");
resizeContainer();
var game = JSON.parse(JSON.stringify(game));
setPropertiesAndChangeScreen(currentScreen);
addThingsToScreen();

let resize = function resize() {
	resizeContainer();
};

window.addEventListener("resize", resize);

// Rendering Loop

app.ticker.add((delta) => {
	// delta = frames "skipped" (1 frame = 1/60 seconds)

	switch (currentScreen) {
		case screens.SINGLEPLAYER_GAME_SCREEN: {
			// Update Text Positions
			currentProblemText.x = (initialWindowWidth - PIXI.TextMetrics.measureText(currentProblemText.text === undefined ? "" : currentProblemText.text.toString(), textStyles.SIZE_72_MATH_FONT).width) / 2;
			actionsPerMinuteText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(actionsPerMinuteText.text, textStyles.SIZE_40_FONT).width;
			currentComboText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(currentComboText.text, textStyles.SIZE_40_FONT).width;
			break;
		}
	}
});

// Functions

// Important Functions

/**
 * Changes the screen. (i.e. changes the container shown)
 * @param {*} newScreen
 */
function setPropertiesAndChangeScreen(newScreen) {
	// animate currentScreen first
	switch (currentScreen) {
		case screens.MAIN_MENU_SCREEN: {
			$(".main-menu-screen-button").animate({ opacity: 0 });
		}
		case screens.SETTINGS_SCREEN: {
			$(".settings-screen-navigation-button").animate({ opacity: 0 });
		}
	}

	document.getElementById("hub-container").style.display = "none";

	document.getElementById("main-menu-screen-container").style.display = "none";
	document.getElementById("information-screen-container").style.display = "none";
	document.getElementById("settings-screen-container").style.display = "none";
	document.getElementById("game-over-screen-container").style.display = "none";

	document.getElementById("bottom-user-interface-container").style.display = "none";

	document.getElementById("pixi-canvas").style.display = "none";
	currentScreen = newScreen; // might remove later
	// mainMenuScreenContainer.visible = false;
	singleplayerScreenContainer.visible = false;

	switch (newScreen) {
		case screens.MAIN_MENU_SCREEN: {
			// set properties
			removeAllRenderedEnemies();
			// mainMenuScreenContainer.visible = true;
			document.body.style.overflow = "visible";

			document.getElementById("hub-container").style.display = "block";
			document.getElementById("main-menu-screen-container").style.display = "block";
			document.getElementById("bottom-user-interface-container").style.display = "block";
			$(".main-menu-screen-button").animate({ opacity: 1 });
			break;
		}
		case screens.INFORMATION_SCREEN: {
			// set properties
			document.getElementById("hub-container").style.display = "block";
			document.getElementById("information-screen-container").style.display = "block";
			break;
		}
		case screens.SINGLEPLAYER_GAME_SCREEN: {
			// set properties
			removeAllRenderedEnemies();

			document.body.style.overflow = "none";
			document.getElementById("pixi-canvas").style.display = "block";
			singleplayerScreenContainer.visible = true; // for now
			break;
		}
		case screens.SETTINGS_SCREEN: {
			// set properties

			/*
			document.getElementById("enemy-color-setting-drop-down-menu").value = settings === null ? "randomForEach" : settings.video.enemyColor;
			document.getElementById("multiplication-sign-form-setting-drop-down-menu").value = settings === null ? "cross" : settings.video.multiplicationSignForm;
*/
			document.body.style.overflow = "hidden";
			document.getElementById("hub-container").style.display = "block";
			document.getElementById("settings-screen-container").style.display = "block";
			$(".settings-screen-navigation-button").animate({ opacity: 1 });
			if (settings === null) {
				settings = {
					video: {
						enemyColor: "randomForEach",
						multiplicationSignForm: "cross",
					},
				};
			}

			break;
		}
		case screens.GAME_OVER_SCREEN: {
			// set properties
			document.body.style.overflow = "hidden";
			document.getElementById("hub-container").style.display = "block";
			document.getElementById("game-over-screen-container").style.display = "block";
			break;
		}
	}
}

function setPropertiesAndChangeSettingsScreen(newSettingsScreen) {
	document.getElementById("video-settings-screen-container").style.display = "none";
	// document.getElementById("audio-settings-screen-container").style.display = "none";
	document.getElementById("input-settings-screen-container").style.display = "none";
	document.getElementById("online-settings-screen-container").style.display = "none";
	switch (newSettingsScreen) {
		case settingsScreens.VIDEO_SETTINGS_SCREEN: {
			document.getElementById("video-settings-screen-container").style.display = "block";
			break;
		}
		case settingsScreens.AUDIO_SETTINGS_SCREEN: {
			document.getElementById("audio-settings-screen-container").style.display = "block";
			break;
		}
		case settingsScreens.INPUT_SETTINGS_SCREEN: {
			document.getElementById("input-settings-screen-container").style.display = "block";
			break;
		}
		case settingsScreens.ONLINE_SETTINGS_SCREEN: {
			document.getElementById("online-settings-screen-container").style.display = "block";
			break;
		}
		default: {
			break;
		}
	}
}

// socket.io functions
socket.on("roomData", (compressedStringifiedJSONRoomData) => {
	var roomData = JSON.parse(LZString.decompressFromUTF16(compressedStringifiedJSONRoomData));
	// delta = frames "skipped" (1 frame = 1/60 seconds)
	switch (roomData.mode) {
		case "singleplayer":
			{
				if (roomData.currentGame.gameIsOver && !roomData.currentGame.gameOverScreenShown) {
					setPropertiesAndChangeScreen(screens.GAME_OVER_SCREEN);
					$("#final-score").text(roomData.currentGame.currentScore);
					$("#final-time").text(turnMillisecondsToTime(roomData.currentGame.currentInGameTimeInMilliseconds));
					$("#final-enemies").text(roomData.currentGame.enemiesKilled + "/" + roomData.currentGame.enemiesCreated);
					$("#final-actions-per-minute").text(((roomData.currentGame.actionsPerformed / (roomData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString());
				} else {
					// text

					// interface
					currentScoreText.text = roomData.currentGame.currentScore;
					currentProblemText.text = settings.video.multiplicationSignForm == "dot" ? roomData.currentGame.currentProblemAsBeautifulText.replaceAll("×", "·") : roomData.currentGame.currentProblemAsBeautifulText;
					baseHealthText.text = "Base Health: " + roomData.currentGame.baseHealth + "/10";
					enemiesText.text = "Enemies: " + roomData.currentGame.enemiesKilled + "/" + roomData.currentGame.enemiesCreated;
					actionsPerMinuteText.text = ((roomData.currentGame.actionsPerformed / (roomData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString();
					currentComboText.text = roomData.currentGame.currentCombo < 1 ? "" : roomData.currentGame.currentCombo + " Combo";
					valueOfVariableAText.text = roomData.currentGame.valueOfVariableA === undefined ? "a = ?" : "a = " + roomData.currentGame.valueOfVariableA;
					valueOfVariableBText.text = roomData.currentGame.valueOfVariableB === undefined ? "b = ?" : "b = " + roomData.currentGame.valueOfVariableB;
					valueOfVariableCText.text = roomData.currentGame.valueOfVariableC === undefined ? "c = ?" : "c = " + roomData.currentGame.valueOfVariableC;
					valueOfVariableDText.text = roomData.currentGame.valueOfVariableD === undefined ? "d = ?" : "d = " + roomData.currentGame.valueOfVariableD;
					currentTimeText.text = turnMillisecondsToTime(roomData.currentGame.currentInGameTimeInMilliseconds);

					// tiles
					for (let i = 0; i < 49; i++) {
						// why?
						if (roomData.currentGame.tilesOnBoard[i]) {
							let t = new Tile(roomData.currentGame.tilesOnBoard[i].termID, i, roomData.currentGame.tilesOnBoard[i].selected, roomData.currentGame.tilesOnBoard[i].tileID);

							if (!game.tilesOnBoard[i] || game.tilesOnBoard[i].tileID != t.tileID) {
								game.tilesOnBoard[i] = t;
								game.tilesOnBoard[i].sprite.on("click", function () {
									processTileClick(i);
								});
							}
							game.tilesOnBoard[i].sprite.texture =
								tileTextures[roomData.currentGame.tilesOnBoard[i].selected ? 1 : 0][
									roomData.currentGame.tilesOnBoard[i].termID == 12 && settings.video.multiplicationSignForm == "dot" ? 23 : roomData.currentGame.tilesOnBoard[i].termID
								];
							singleplayerScreenContainer.addChild(game.tilesOnBoard[i].sprite);
						}
					}

					// enemies
					let renderedEnemiesOnFieldToDelete = [];
					for (let i = 0; i < roomData.currentGame.enemiesOnField.length; i++) {
						let enemy = roomData.currentGame.enemiesOnField[i];
						if (enemy !== undefined && enemy !== null && !enemy.toDestroy) {
							if (game.enemyRenderStatus[enemy.enemyNumber.toString()] === undefined) {
								// add enemy to array
								if (!game.renderedEnemiesOnField.includes(enemy.enemyNumber.toString())) {
									game.renderedEnemiesOnField.push(enemy.enemyNumber.toString());
								}

								// create object
								game.enemyRenderStatus[enemy.enemyNumber.toString()] = {};

								// create sprite
								let enemySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
								enemySprite.width = enemy.width;
								enemySprite.height = enemy.height;

								let enemyColor = createEnemyColor();
								let red = (enemyColor & 0xff0000) >> 16;
								let green = (enemyColor & 0x00ff00) >> 8;
								let blue = enemyColor & 0x0000ff;
								let minimum = Math.min(Math.min(red, green), blue) / 255;
								let maximum = Math.max(Math.max(red, green), blue) / 255;
								enemySprite.tint = enemyColor;
								// create text sprite
								let textStyleToUse = new PIXI.TextStyle({
									fontFamily: '"Computer Modern Math Italic", Computer Modern Unicode Serif',
									fill: settings.video.enemyColor == "blind" ? "#eeeeee" : (maximum + minimum) / 2 >= 0.5 ? "#000000" : "#ffffff",
									fontSize: 32,
								});
								let textSprite = new PIXI.Text(enemy.requestedValue.toString().replace("-", "\u2013"), textStyleToUse);
								let textMetrics = PIXI.TextMetrics.measureText(enemy.requestedValue.toString(), textStyleToUse);
								textSprite.x = enemy.xPosition + (enemy.width - textMetrics.width) / 2;
								textSprite.y = enemy.yPosition + (enemy.height - textMetrics.height) / 2;
								textSprite.color = enemyColor == "blind" ? "#eeeeee" : (maximum + minimum) / 2 >= 0.5 ? "#000000" : "#ffffff";
								// add to render

								game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"] = enemySprite;
								game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"].enemyNumber = enemy.enemyNumber.toString();
								game.enemyRenderStatus[enemy.enemyNumber.toString()]["textSprite"] = textSprite;
								game.enemyRenderStatus[enemy.enemyNumber.toString()]["textMetrics"] = textMetrics;
								game.enemyRenderStatus[enemy.enemyNumber.toString()]["rendered"] = true;
								game.spritesOfRenderedEnemiesOnField.push(enemySprite);
								singleplayerScreenContainer.addChild(game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"]);
								singleplayerScreenContainer.addChild(game.enemyRenderStatus[enemy.enemyNumber.toString()]["textSprite"]);
							}
							// render
							game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"].x = initialWindowWidth / 2 + 80 * (enemy.sPosition - 5); // (enemy.sPosition / 10) * 800 + 560;

							game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"].y = enemy.yPosition;
							game.enemyRenderStatus[enemy.enemyNumber.toString()]["textSprite"].x = initialWindowWidth / 2 + 80 * (enemy.sPosition - 5) + (enemy.width - game.enemyRenderStatus[enemy.enemyNumber.toString()]["textMetrics"].width) / 2;
							game.enemyRenderStatus[enemy.enemyNumber.toString()]["textSprite"].y = enemy.yPosition + (enemy.height - game.enemyRenderStatus[enemy.enemyNumber.toString()]["textMetrics"].height) / 2;
							if (enemy.reachedBase || enemy.destroyed) {
								game.enemyRenderStatus[enemy.enemyNumber.toString()].toDestroy = true;
							}
						} else {
							renderedEnemiesOnFieldToDelete.push(enemy.enemyNumber.toString());
						}
					}

					for (let enemy in game.enemyRenderStatus) {
						if (game.enemyRenderStatus[enemy].toDestroy) {
							singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy].enemySprite);
							singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy].textSprite);
						}
					}

					for (let enemySprite of game.spritesOfRenderedEnemiesOnField) {
						if (!game.enemyRenderStatus.hasOwnProperty(enemySprite.enemyNumber.toString())) {
							renderedEnemiesOnFieldToDelete.push(enemySprite.enemyNumber.toString());
						}
					}

					// score indicators
					let scoreGainIndicatorsToDelete = [];
					for (let i = 0; i < roomData.currentGame.scoreGainIndicators.length; i++) {
						let indicator = roomData.currentGame.scoreGainIndicators[i];
						if (indicator !== undefined && indicator !== null && indicator.ageInMilliseconds < 500) {
							if (game.scoreGainIndicatorRenderStatus[indicator.number.toString()] === undefined) {
								// ???
								// create object
								game.scoreGainIndicatorRenderStatus[indicator.number.toString()] = {};
								// create the indicator
								let scoreGainIndicator = new PIXI.Text(roomData.currentGame.scoreGainIndicators[i].content, textStyles.SIZE_24_FONT);
								scoreGainIndicator.x = initialWindowWidth / 2 + 80 * (roomData.currentGame.scoreGainIndicators[i].sPosition - 5);
								scoreGainIndicator.y = 60 * (roomData.currentGame.scoreGainIndicators[i].age / 600 - 5) * -1 + 300;
								// add to render

								game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"] = scoreGainIndicator;
								game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["rendered"] = true;
								// game.spritesOfRenderedEnemiesOnField.push(enemySprite);
								singleplayerScreenContainer.addChild(game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"]);
							}
							game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"].y = -24 * (roomData.currentGame.scoreGainIndicators[i].ageInMilliseconds / 100 - 5) + 50;
						} else {
							scoreGainIndicatorsToDelete.push(indicator.number.toString());
						}
					}

					// delete
					for (let numberToRemoveAsString of renderedEnemiesOnFieldToDelete) {
						game.enemyRenderStatus[numberToRemoveAsString.toString()] === undefined || singleplayerScreenContainer.removeChild(game.enemyRenderStatus[numberToRemoveAsString.toString()]["enemySprite"]);
						game.enemyRenderStatus[numberToRemoveAsString.toString()] === undefined || singleplayerScreenContainer.removeChild(game.enemyRenderStatus[numberToRemoveAsString.toString()]["textSprite"]);
						delete game.enemyRenderStatus[numberToRemoveAsString.toString()];
						game.renderedEnemiesOnField.splice(game.renderedEnemiesOnField.indexOf(numberToRemoveAsString), 1);
						game.spritesOfRenderedEnemiesOnField.splice(game.spritesOfRenderedEnemiesOnField.indexOf(numberToRemoveAsString), 1);
					}
					for (let numberToRemoveAsString of scoreGainIndicatorsToDelete) {
						game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()] === undefined || singleplayerScreenContainer.removeChild(game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()]["textSprite"]);
						delete game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()];
					}
				}
			}
			break;
	}
});
socket.on("finalRanks", (personalBestBroken, finalGlobalRank, scoreSaved) => {
	console.log(scoreSaved ? "Score saved!" : "Score not saved!");
	if (scoreSaved) {
		$("#personal-best-broken").text(personalBestBroken ? "New Personal Best!" : "");
		$("#final-global-rank").text(calculateMessageForGlobalRank(finalGlobalRank));
	} else {
		$("#personal-best-broken").text("Score not saved! Register for an account to save your scores!");
	}
});

socket.on("loginResult", (username, success) => {
	alert(success ? "Successfully logged in as " + username + "!" : " Failed to log in as" + " " + username + "!");
	$("#login-button").removeClass("disabled-button").text("Login");
	if (success) {
		$("#login-button").hide();
	}
});

// Logical Functions

function startKeyRebindProcess(tileID) {
	keyRebindProcessUnderway = tileID;
}

function endSingleplayerGame() {
	finalGameData = {
		score: game.currentScore,
		inGameTimeInMilliseconds: game.currentInGameTimeInMilliseconds,
		enemiesKilled: game.enemiesKilled,
		enemiesCreated: game.enemiesCreated,
		actionsPerformed: game.actionsPerformed,
	};

	socket.emit("scoreSubmission", finalGameData);

	setPropertiesAndChangeScreen(screens.GAME_OVER_SCREEN);
}

function processKeypress(event) {
	// console.log(event);
	socket.emit("keypress", event.code, settings.input.keybinds.tiles);
	switch (currentScreen) {
		case screens.MAIN_MENU_SCREEN: {
			break;
		}
		case screens.SINGLEPLAYER_GAME_SCREEN: {
			// check if input is from numpad
			if (event.key != "Escape") {
			} else {
				setPropertiesAndChangeScreen(screens.MAIN_MENU_SCREEN);
				socket.emit("leaveRoom");
			}
		}
		case screens.SETTINGS_SCREEN: {
			switch (event.key) {
				case "Escape": {
					setPropertiesAndChangeScreen(screens.MAIN_MENU_SCREEN);
				}
			}
		}
	}
}

function startSingleplayerGame() {
	socket.emit("createAndJoinRoom");
	socket.emit("startSingleplayerGame");
	setPropertiesAndChangeScreen(screens.SINGLEPLAYER_GAME_SCREEN);
}

function processAction() {
	game.actionsPerformed++;
}

function forceSelectTileWithTermID(termIDToSelect) {
	for (i = 0; i < 49; i++) {
		if (game.tilesOnBoard[i].termID == termIDToSelect && game.tilesOnBoard[i].selected == false) {
			processTileClick(game.tilesOnBoard[i]);
			return; // break
		}
	}
	// None found
}

function deleteLastSelectedTerm() {
	if (game.tilesInCurrentProblem.length > 0) {
		processTileClick(game.tilesInCurrentProblem[game.tilesInCurrentProblem.length - 1]);
	}
}

function sendProblem() {
	socket.emit("action");
	socket.emit("sendProblem");
}

// Random Generators

function addThingsToScreen() {
	singleplayerScreenContainer.addChild(currentProblemText);

	singleplayerScreenContainer.addChild(scoreLabelerText);
	singleplayerScreenContainer.addChild(currentScoreText);
	singleplayerScreenContainer.addChild(timeLabelerText);
	singleplayerScreenContainer.addChild(currentTimeText);
	singleplayerScreenContainer.addChild(baseHealthText);
	singleplayerScreenContainer.addChild(enemiesText);
	singleplayerScreenContainer.addChild(actionsPerMinuteLabelerText);
	singleplayerScreenContainer.addChild(actionsPerMinuteText);
	singleplayerScreenContainer.addChild(currentComboText);

	singleplayerScreenContainer.addChild(valueOfVariableAText);
	singleplayerScreenContainer.addChild(valueOfVariableBText);
	singleplayerScreenContainer.addChild(valueOfVariableCText);
	singleplayerScreenContainer.addChild(valueOfVariableDText);

	singleplayerScreenContainer.addChild(sendButtonSprite);

	singleplayerScreenContainer.addChild(baseSprite);
}

function generateRandomColor() {
	return parseInt("0x" + Math.floor(Math.random() * 16777215).toString(16));
}

// Rendering Helpers

function resizeContainer() {
	var ratio = Math.min(window.innerWidth / initialWindowWidth, window.screen.availHeight - (window.outerHeight - window.innerHeight) / initialWindowHeight);

	mainMenuScreenContainer.scale.x = mainMenuScreenContainer.scale.y = ratio;
	singleplayerScreenContainer.scale.x = singleplayerScreenContainer.scale.y = ratio;

	renderer.resize(Math.ceil(initialWindowWidth * ratio), Math.ceil(initialWindowHeight * ratio));
}

function removeAllRenderedEnemies() {
	for (let enemy in game.enemyRenderStatus) {
		if (game.enemyRenderStatus.hasOwnProperty(enemy)) {
			singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["enemySprite"]);
			singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["textSprite"]);
			delete game.enemyRenderStatus[enemy];
			game.renderedEnemiesOnField = [];
			game.spritesOfRenderedEnemiesOnField = [];
		}
	}
}

// "Predetermined" Generators

// Converters

function convertTermIDToBeautifulString(id) {
	return id == 12 && settings.video.multiplicationSignForm == "dot" ? "·" : TERMS_AS_BEAUTIFUL_STRINGS[id];
}

function turnMillisecondsToTime(milliseconds) {
	let h = Math.floor(milliseconds / (60 * 60 * 1000));
	let dm = milliseconds % (60 * 60 * 1000);
	let m = Math.floor(dm / (60 * 1000));
	let ds = dm % (60 * 1000);
	let s = Math.floor(ds / 1000);

	let hh = h < 10 ? "0" + h : h;
	let mm = m < 10 ? "0" + m : m;
	let ss = s < 10 ? "0" + s : s;
	let ms = String(Math.floor(ds % 1000)).padStart(3, "0");

	if (h >= 1) {
		return hh + ":" + mm + ":" + ss + "." + ms;
	} else {
		return mm + ":" + ss + "." + ms;
	}
}

function calculateMessageForGlobalRank(rank) {
	if (rank == 1) {
		return "New World Record!";
	} else if (rank >= 2 && rank <= 50) {
		return "Global Rank #" + rank;
	} else {
		return "";
	}
}

function createEnemyColor() {
	switch (settings.video.enemyColor) {
		case "randomForEach": {
			return generateRandomColor();
		}
		case "random": {
			if (typeof fixedEnemyColor === "undefined") {
				fixedEnemyColor = generateRandomColor();
			}
			return fixedEnemyColor;
		}
		case "red": {
			return 0xff0000;
		}
		case "orange": {
			return 0xff8800;
		}
		case "yellow": {
			return 0xffd900;
		}
		case "green": {
			return 0x00ff00;
		}
		case "blue": {
			return 0x0000ff;
		}
		case "purple": {
			return 0xa600ff;
		}
		case "white": {
			return 0xffffff;
		}
		case "gray": {
			return 0x3c3c3c;
		}
		case "black": {
			return 0x000000;
		}
		case "backgroundColor": {
			return 0xeeeeee;
		}
		case "blind": {
			return 0xeeeeee;
		}
	}
}

// io

function restoreSettings() {
	settings = localStorage.getItem("settings");

	if (settings === undefined || settings == null) {
		settings = {
			video: {
				enemyColor: "randomForEach",
				multiplicationSignForm: "cross",
			},
			input: {
				keybinds: {
					tiles: ["KeyM", "KeyJ", "KeyK", "KeyL", "KeyU", "KeyI", "KeyO", "Digit7", "Digit8", "Digit9", "Slash", "Semicolon", "KeyP", "Digit0", "Quote", "KeyW", "KeyE", "KeyS", "KeyD"],
				},
			},
		};
		localStorage.setItem("settings", JSON.stringify(settings));
	} else {
		settings = JSON.parse(settings);
	}
}

function updateSettingsSelections() {
	// video
	$("#enemy-color-setting-drop-down-menu").val(settings.video.enemyColor);
	$("#multiplication-sign-form-setting-drop-down-menu").val(settings.video.multiplicationSignForm);
	// input
	for (let i = 0; i < 19; i++) {
		$("#key-to-force-select-tile-" + i).text(settings.input.keybinds.tiles[i]);
	}
}

function resetKeybinds() {
	settings.input.keybinds.tiles = ["KeyM", "KeyJ", "KeyK", "KeyL", "KeyU", "KeyI", "KeyO", "Key7", "Key8", "Key9", "Slash", "Semicolon", "KeyP", "Key0", "Quote", "KeyW", "KeyE", "KeyS", "KeyD"];
	updateSettingsSelections();
	saveSettings();
}

function changeSettings() {
	settings = {
		video: {
			enemyColor: $("#enemy-color-setting-drop-down-menu").val(),
			multiplicationSignForm: $("#multiplication-sign-form-setting-drop-down-menu").val(),
		},
		input: {
			keybinds: {
				tiles: [
					$("#key-to-force-select-tile-0").text(),
					$("#key-to-force-select-tile-1").text(),
					$("#key-to-force-select-tile-2").text(),
					$("#key-to-force-select-tile-3").text(),
					$("#key-to-force-select-tile-4").text(),
					$("#key-to-force-select-tile-5").text(),
					$("#key-to-force-select-tile-6").text(),
					$("#key-to-force-select-tile-7").text(),
					$("#key-to-force-select-tile-8").text(),
					$("#key-to-force-select-tile-9").text(),
					$("#key-to-force-select-tile-10").text(),
					$("#key-to-force-select-tile-11").text(),
					$("#key-to-force-select-tile-12").text(),
					$("#key-to-force-select-tile-13").text(),
					$("#key-to-force-select-tile-14").text(),
					$("#key-to-force-select-tile-15").text(),
					$("#key-to-force-select-tile-16").text(),
					$("#key-to-force-select-tile-17").text(),
					$("#key-to-force-select-tile-18").text(),
					$("#key-to-force-select-tile-19").text(),
				],
			},
		},
	};
}

function saveSettings() {
	localStorage.setItem("settings", JSON.stringify(settings));
}

// DEBUG
socket.on("debugData", (what) => {
	console.log(what);
});
