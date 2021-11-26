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
	MULTIPLAYER_LOBBY_SCREEN: "multiplayerLobbyScreen",
	DEFAULT_MULTIPLAYER_ROOM_LOBBY_SCREEN: "defaultMultiplayerRoomLobbyScreen",
	MULTIPLAYER_GAME_SCREEN: "multiplayerGameScreen",
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
	enemiesSentIndicatorRenderStatus: {},
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
var multiplayerScreenContainer = new PIXI.Container();

app.stage.addChild(mainMenuScreenContainer);
mainMenuScreenContainer.visible = false; // for now
app.stage.addChild(singleplayerScreenContainer);
singleplayerScreenContainer.visible = false; // for now
app.stage.addChild(multiplayerScreenContainer);
multiplayerScreenContainer.visible = false; // for now

switch (currentScreen) {
	case screens.MAIN_MENU_SCREEN: {
		break;
	}
	case screens.SINGLEPLAYER_GAME_SCREEN: {
		document.getElementById("pixi-canvas").style.display = "block";
		singleplayerScreenContainer.visible = true; // for now
		break;
	}
}

// Constants so this is easier

const textStyles = {
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

var baseTexture = new PIXI.Texture.from("assets/images/singleplayer-screen/base.png");

// Text

var singleplayerScreenContainerItems = {
	sendButtonSprite: new PIXI.Sprite(sendButtonTexture),

	baseSprite: new PIXI.Sprite(baseTexture),

	currentProblemText: new PIXI.Text("", textStyles.SIZE_72_MATH_FONT),
	scoreLabelerText: new PIXI.Text("Score", textStyles.SIZE_24_FONT),

	currentScoreText: new PIXI.Text("0", textStyles.SIZE_64_FONT),
	timeLabelerText: new PIXI.Text("Time", textStyles.SIZE_24_FONT),

	currentTimeText: new PIXI.Text("0:00.000", textStyles.SIZE_40_FONT),
	baseHealthText: new PIXI.Text("Base Health: 10/10", textStyles.SIZE_24_FONT),
	enemiesText: new PIXI.Text("Enemies: 0/0", textStyles.SIZE_24_FONT),
	valueOfVariableAText: new PIXI.Text("a = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableBText: new PIXI.Text("b = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableCText: new PIXI.Text("c = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableDText: new PIXI.Text("d = ?", textStyles.SIZE_32_MATH_FONT),
	actionsPerMinuteLabelerText: new PIXI.Text("Actions Per Minute", textStyles.SIZE_24_FONT),
	actionsPerMinuteText: new PIXI.Text("0.000", textStyles.SIZE_40_FONT),
	currentComboText: new PIXI.Text("", textStyles.SIZE_40_FONT),
};

singleplayerScreenContainerItems.sendButtonSprite.x = initialWindowWidth / 2 + 64 * -4 + 16;
singleplayerScreenContainerItems.sendButtonSprite.y = initialWindowHeight / 2 + 64 * 3 + 176;
singleplayerScreenContainerItems.sendButtonSprite.interactive = true;
singleplayerScreenContainerItems.sendButtonSprite.on("click", function () {
	sendProblem();
});

singleplayerScreenContainerItems.baseSprite.x = initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.baseSprite.y = initialWindowHeight / 2 - 465;

singleplayerScreenContainerItems.currentProblemText.style.align = "center";
singleplayerScreenContainerItems.currentProblemText.tint = 0x000000;
singleplayerScreenContainerItems.currentProblemText.y = initialWindowHeight / 2 - 200;

singleplayerScreenContainerItems.scoreLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.scoreLabelerText.y = initialWindowHeight / 2 - 100;

singleplayerScreenContainerItems.currentScoreText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.currentScoreText.y = initialWindowHeight / 2 - 80;

singleplayerScreenContainerItems.timeLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.timeLabelerText.y = initialWindowHeight / 2 - 10;

singleplayerScreenContainerItems.currentTimeText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.currentTimeText.y = initialWindowHeight / 2 + 10;

singleplayerScreenContainerItems.baseHealthText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.baseHealthText.y = initialWindowHeight / 2 + 60;

singleplayerScreenContainerItems.enemiesText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.enemiesText.y = initialWindowHeight / 2 + 90;

singleplayerScreenContainerItems.valueOfVariableAText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableAText.y = initialWindowHeight / 2 + 120;

singleplayerScreenContainerItems.valueOfVariableBText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableBText.y = initialWindowHeight / 2 + 150;

singleplayerScreenContainerItems.valueOfVariableCText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableCText.y = initialWindowHeight / 2 + 180;

singleplayerScreenContainerItems.valueOfVariableDText.x = initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableDText.y = initialWindowHeight / 2 + 210;

// Left of grid

singleplayerScreenContainerItems.actionsPerMinuteLabelerText.x = initialWindowWidth / 2 - 465;
singleplayerScreenContainerItems.actionsPerMinuteLabelerText.y = initialWindowHeight / 2 - 10;

singleplayerScreenContainerItems.actionsPerMinuteText.x = initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.actionsPerMinuteText.y = initialWindowHeight / 2 + 10;

singleplayerScreenContainerItems.currentComboText.x = initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.currentComboText.y = initialWindowHeight / 2 - 80;

// Images

var multiplayerScreenContainerItems = {
	sendButtonSprite: new PIXI.Sprite(sendButtonTexture),

	baseSprite: new PIXI.Sprite(baseTexture),

	currentProblemText: new PIXI.Text("", textStyles.SIZE_72_MATH_FONT),
	enemiesSentLabelerText: new PIXI.Text("Enemies Sent", textStyles.SIZE_24_FONT),
	currentEnemiesSentText: new PIXI.Text("0", textStyles.SIZE_64_FONT),
	numberOfPendingEnemiesText: new PIXI.Text("0", textStyles.SIZE_40_FONT),
	timeLabelerText: new PIXI.Text("Time", textStyles.SIZE_24_FONT),
	currentTimeText: new PIXI.Text("0:00.000", textStyles.SIZE_40_FONT),
	baseHealthText: new PIXI.Text("Base Health: 10/10", textStyles.SIZE_24_FONT),
	enemiesText: new PIXI.Text("Enemies: 0/0", textStyles.SIZE_24_FONT),
	valueOfVariableAText: new PIXI.Text("a = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableBText: new PIXI.Text("b = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableCText: new PIXI.Text("c = ?", textStyles.SIZE_32_MATH_FONT),
	valueOfVariableDText: new PIXI.Text("d = ?", textStyles.SIZE_32_MATH_FONT),
	actionsPerMinuteLabelerText: new PIXI.Text("Actions Per Minute", textStyles.SIZE_24_FONT),
	actionsPerMinuteText: new PIXI.Text("0.000", textStyles.SIZE_40_FONT),
	currentComboText: new PIXI.Text("", textStyles.SIZE_40_FONT),
};

multiplayerScreenContainerItems.sendButtonSprite.x = initialWindowWidth / 2 + 64 * -4 + 16;
multiplayerScreenContainerItems.sendButtonSprite.y = initialWindowHeight / 2 + 64 * 3 + 176;
multiplayerScreenContainerItems.sendButtonSprite.interactive = true;
multiplayerScreenContainerItems.sendButtonSprite.on("click", function () {
	sendProblem();
});

multiplayerScreenContainerItems.baseSprite.x = initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.baseSprite.y = initialWindowHeight / 2 - 465;

multiplayerScreenContainerItems.numberOfPendingEnemiesText.x = initialWindowWidth / 2 + 500;
multiplayerScreenContainerItems.numberOfPendingEnemiesText.y = initialWindowHeight / 2 - 400;

multiplayerScreenContainerItems.currentProblemText.style.align = "center";
multiplayerScreenContainerItems.currentProblemText.tint = 0x000000;
multiplayerScreenContainerItems.currentProblemText.y = initialWindowHeight / 2 - 200;

multiplayerScreenContainerItems.enemiesSentLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.enemiesSentLabelerText.y = initialWindowHeight / 2 - 100;

multiplayerScreenContainerItems.currentEnemiesSentText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.currentEnemiesSentText.y = initialWindowHeight / 2 - 80;

multiplayerScreenContainerItems.timeLabelerText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.timeLabelerText.y = initialWindowHeight / 2 - 10;

multiplayerScreenContainerItems.currentTimeText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.currentTimeText.y = initialWindowHeight / 2 + 10;

multiplayerScreenContainerItems.baseHealthText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.baseHealthText.y = initialWindowHeight / 2 + 60;

multiplayerScreenContainerItems.enemiesText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.enemiesText.y = initialWindowHeight / 2 + 90;

multiplayerScreenContainerItems.valueOfVariableAText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableAText.y = initialWindowHeight / 2 + 120;

multiplayerScreenContainerItems.valueOfVariableBText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableBText.y = initialWindowHeight / 2 + 150;

multiplayerScreenContainerItems.valueOfVariableCText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableCText.y = initialWindowHeight / 2 + 180;

multiplayerScreenContainerItems.valueOfVariableDText.x = initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableDText.y = initialWindowHeight / 2 + 210;

// Left of grid

multiplayerScreenContainerItems.actionsPerMinuteLabelerText.x = initialWindowWidth / 2 - 465;
multiplayerScreenContainerItems.actionsPerMinuteLabelerText.y = initialWindowHeight / 2 - 10;

multiplayerScreenContainerItems.actionsPerMinuteText.x = initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.actionsPerMinuteText.y = initialWindowHeight / 2 + 10;

multiplayerScreenContainerItems.currentComboText.x = initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.currentComboText.y = initialWindowHeight / 2 - 80;

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
addThingsToSingleplayerScreenContainer();
addThingsToMultiplayerScreenContainer();
resizeContainer();

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
			singleplayerScreenContainerItems.currentProblemText.x =
				(initialWindowWidth -
					PIXI.TextMetrics.measureText(singleplayerScreenContainerItems.currentProblemText.text === undefined ? "" : singleplayerScreenContainerItems.currentProblemText.text.toString(), textStyles.SIZE_72_MATH_FONT).width) /
				2;
			singleplayerScreenContainerItems.actionsPerMinuteText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(singleplayerScreenContainerItems.actionsPerMinuteText.text, textStyles.SIZE_40_FONT).width;
			singleplayerScreenContainerItems.currentComboText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(singleplayerScreenContainerItems.currentComboText.text, textStyles.SIZE_40_FONT).width;
			break;
		}

		case screens.MULTIPLAYER_GAME_SCREEN: {
			// Update Text Positions
			multiplayerScreenContainerItems.currentProblemText.x =
				(initialWindowWidth - PIXI.TextMetrics.measureText(multiplayerScreenContainerItems.currentProblemText.text === undefined ? "" : multiplayerScreenContainerItems.currentProblemText.text.toString(), textStyles.SIZE_72_MATH_FONT).width) /
				2;
			multiplayerScreenContainerItems.actionsPerMinuteText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(multiplayerScreenContainerItems.actionsPerMinuteText.text, textStyles.SIZE_40_FONT).width;
			multiplayerScreenContainerItems.currentComboText.x = initialWindowWidth / 2 - 260 - PIXI.TextMetrics.measureText(multiplayerScreenContainerItems.currentComboText.text, textStyles.SIZE_40_FONT).width;
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

	$("#hub-container").hide(0);

	$("#main-menu-screen-container").hide(0);
	$("#information-screen-container").hide(0);
	$("#multiplayer-lobby-screen-container").hide(0);
	$("#default-multiplayer-room-lobby-screen-container").hide(0);
	$("#settings-screen-container").hide(0);
	$("#game-over-screen-container").hide(0);

	$("#bottom-user-interface-container").hide(0);

	$("#pixi-canvas").hide(0);
	currentScreen = newScreen; // might remove later
	// mainMenuScreenContainer.visible = false;
	singleplayerScreenContainer.visible = false;
	multiplayerScreenContainer.visible = false;
	switch (newScreen) {
		case screens.MAIN_MENU_SCREEN: {
			// set properties
			removeAllRenderedEnemies();
			// mainMenuScreenContainer.visible = true;
			document.body.style.overflow = "visible";

			$("#hub-container").show(0);
			$("#main-menu-screen-container").show(0);
			$("#bottom-user-interface-container").show(0);
			$(".main-menu-screen-button").animate({ opacity: 1 });
			break;
		}
		case screens.INFORMATION_SCREEN: {
			// set properties
			$("#hub-container").show(0);
			$("#information-screen-container").show(0);
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
		case screens.MULTIPLAYER_LOBBY_SCREEN: {
			document.body.style.overflow = "none";
			$("#hub-container").show(0);
			$("#multiplayer-lobby-screen-container").show(0);
			break;
		}
		case screens.MULTIPLAYER_GAME_SCREEN: {
			// set properties
			removeAllRenderedEnemies();

			document.body.style.overflow = "none";
			document.getElementById("pixi-canvas").style.display = "block";
			multiplayerScreenContainer.visible = true; // for now
			break;
		}
		case screens.DEFAULT_MULTIPLAYER_ROOM_LOBBY_SCREEN: {
			document.body.style.overflow = "none";
			$("#hub-container").show(0);
			$("#default-multiplayer-room-lobby-screen-container").show(0);
			break;
		}
		case screens.SETTINGS_SCREEN: {
			// set properties

			/*
			document.getElementById("enemy-color-setting-drop-down-menu").value = settings === null ? "randomForEach" : settings.video.enemyColor;
			document.getElementById("multiplication-sign-form-setting-drop-down-menu").value = settings === null ? "cross" : settings.video.multiplicationSignForm;
*/
			document.body.style.overflow = "hidden";
			$("#hub-container").show(0);
			$("#settings-screen-container").show(0);
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
	socket.emit("createAndJoinSingleplayerRoom");
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

function addThingsToSingleplayerScreenContainer() {
	for (let item in singleplayerScreenContainerItems) {
		singleplayerScreenContainer.addChild(singleplayerScreenContainerItems[item]);
	}
}

function addThingsToMultiplayerScreenContainer() {
	for (let item in multiplayerScreenContainerItems) {
		multiplayerScreenContainer.addChild(multiplayerScreenContainerItems[item]);
	}
}

function generateRandomColor() {
	return parseInt("0x" + Math.floor(Math.random() * 16777215).toString(16));
}

// Rendering Helpers

function resizeContainer() {
	var ratio = Math.min(window.innerWidth / initialWindowWidth, window.screen.availHeight - (window.outerHeight - window.innerHeight) / initialWindowHeight);

	mainMenuScreenContainer.scale.x = ratio;
	mainMenuScreenContainer.scale.y = ratio;
	mainMenuScreenContainer.position.y = (window.innerHeight-mainMenuScreenContainer.height)/2;

	singleplayerScreenContainer.scale.x = ratio;
	singleplayerScreenContainer.scale.y = ratio;
	singleplayerScreenContainer.position.y = (window.innerHeight-singleplayerScreenContainer.height)/2;


	multiplayerScreenContainer.scale.x = ratio;
	multiplayerScreenContainer.scale.y = ratio;
	multiplayerScreenContainer.position.y = (window.innerHeight-multiplayerScreenContainer.height)/2;




	renderer.resize(Math.ceil(initialWindowWidth * ratio), Math.ceil(initialWindowHeight * ratio));
}

function removeAllRenderedEnemies() {
	for (let enemy in game.enemyRenderStatus) {
		if (game.enemyRenderStatus.hasOwnProperty(enemy)) {
			singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["enemySprite"]);
			singleplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["textSprite"]);
			multiplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["enemySprite"]);
			multiplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy]["textSprite"]);
			delete game.enemyRenderStatus[enemy];
		}
	}
	game.renderedEnemiesOnField = [];
	game.spritesOfRenderedEnemiesOnField = [];
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
