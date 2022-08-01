// ======================================================================================== START OF INITIALIZATION =====================================================================

// Initialization

// Variables that for some reason need to be loaded first
var initializationFinished = false;

var computerModernUnicodeSerifFont = new FontFaceObserver(
    "Computer Modern Unicode Serif"
);
var computerModernMathItalicFont = new FontFaceObserver(
    "Computer Modern Math Italic"
);

Promise.all([
    computerModernUnicodeSerifFont.load(),
    computerModernMathItalicFont.load()
]).then(function () {
    console.log("Loaded fonts!");
});



var isMobile = false; //initiate as false
// device detection
if (
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
        navigator.userAgent
    ) ||
    /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        navigator.userAgent.substr(0, 4)
    )
) {
    isMobile = true;
}

const screens = {
    MAIN_MENU_SCREEN: "mainMenuScreen",
    INFORMATION_SCREEN: "informationScreen",
    SINGLEPLAYER_LOBBY_SCREEN: "singleplayerLobbyScreen",
    SINGLEPLAYER_GAME_SCREEN: "singleplayerGameScreen",
    MULTIPLAYER_LOBBY_SCREEN: "multiplayerLobbyScreen",
    DEFAULT_MULTIPLAYER_ROOM_LOBBY_SCREEN: "defaultMultiplayerRoomLobbyScreen",
    MULTIPLAYER_GAME_SCREEN: "multiplayerGameScreen",
    STATISTICS_SCREEN: "statisticsScreen",
    SETTINGS_SCREEN: "settingsScreen",
    GAME_OVER_SCREEN: "gameOverScreen"
};

const settingsScreens = {
    VIDEO_SETTINGS_SCREEN: "videoSettingsScreen",
    AUDIO_SETTINGS_SCREEN: "audioSettingsScreen",
    INPUT_SETTINGS_SCREEN: "inputSettingsScreen",
    ONLINE_SETTINGS_SCREEN: "onlineSettingsScreen"
};

// ui
var pixiCanvas = document.getElementById("pixi-canvas");
document.getElementById("pixi-canvas").style.display = "none";
$("#text-modal-container").hide(0);
$("#user-information-modal-container").hide(0);

pixiCanvas.width = window.innerWidth;
pixiCanvas.height = window.innerHeight;
// IMPORTANT VARIABLES
var currentScreen = screens.MAIN_MENU_SCREEN;
var settings = {};

restoreSettings();

// "Logical" Variables

var framesRenderedSinceLaunch = 0.0;
// var initialWindowWidth = window.screen.width;
// var initialWindowHeight = window.screen.availHeight - (window.outerHeight - window.innerHeight);
const initialWindowWidth = 1920;
const initialWindowHeight = 1080;
const initialRatio = initialWindowWidth / initialWindowHeight;

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
    opponentGameInstances: [],
    opponentGameInstanceSettings: {
        opponentGameInstancesPerRow: 3,
        opponentGameInstancePositionIncrements: {
            x: 130,
            y: 210
        }
    },
    cachedLengthOfOpponentGameInstances: 0,
    toastNotifications: {},
    toastNotificationsCreated: 0,
    lastSingleplayerGameModePlayed: null,
    userCurrentUserIsViewing: null
};

var finalGameData;

// Constants

const TERMS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "-",
    "*",
    "/",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];
const TERMS_AS_BEAUTIFUL_STRINGS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "\u2013",
    "×",
    "÷",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];

// PIXI Variables
var app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    backgroundAlpha: 0,
    autoResize: true,
    resizeTo: window,
    resolution: devicePixelRatio,
    view: pixiCanvas
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

const textStyles = {
    SIZE_16_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 16
    }),
    SIZE_24_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 24
    }),
    SIZE_32_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 32
    }),
    SIZE_40_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 40
    }),
    SIZE_64_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 64
    }),
    SIZE_72_FONT: new PIXI.TextStyle({
        fontFamily: "Computer Modern Unicode Serif",
        fontSize: 72
    }),

    SIZE_32_MATH_FONT: new PIXI.TextStyle({
        fontFamily:
            '"Computer Modern Math Italic", Computer Modern Unicode Serif',
        fontSize: 32
    }),
    SIZE_72_MATH_FONT: new PIXI.TextStyle({
        fontFamily:
            '"Computer Modern Math Italic", Computer Modern Unicode Serif',
        fontSize: 72
    })
};

// =============== START OF SINGLEPLAYER SCREEN ITEMS ====================

// Sprites
var sendButtonTexture = PIXI.Texture.from(
    "/public/assets/images/game-screen/sendbutton.png"
);

var baseTexture = new PIXI.Texture.from("/public/assets/images/game-screen/base.png");

// Text

var singleplayerScreenContainerItems = {
    sendButtonSprite: new PIXI.Sprite(sendButtonTexture),

    baseSprite: new PIXI.Sprite(baseTexture),

    currentProblemText: new PIXI.Text("", textStyles.SIZE_72_MATH_FONT),
    scoreLabelerText: new PIXI.Text("Score", textStyles.SIZE_24_FONT),

    currentScoreText: new PIXI.Text("0", textStyles.SIZE_64_FONT),
    timeLabelerText: new PIXI.Text("Time", textStyles.SIZE_24_FONT),

    currentComboTimeLeftText: new PIXI.Text("", textStyles.SIZE_24_FONT),

    currentTimeText: new PIXI.Text("0:00.000", textStyles.SIZE_40_FONT),
    baseHealthText: new PIXI.Text(
        "Base Health: 10/10",
        textStyles.SIZE_24_FONT
    ),
    enemiesText: new PIXI.Text("Enemies: 0/0", textStyles.SIZE_24_FONT),
    valueOfVariableAText: new PIXI.Text("a = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableBText: new PIXI.Text("b = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableCText: new PIXI.Text("c = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableDText: new PIXI.Text("d = ?", textStyles.SIZE_32_MATH_FONT),
    actionsPerMinuteLabelerText: new PIXI.Text(
        "Actions Per Minute",
        textStyles.SIZE_24_FONT
    ),
    actionsPerMinuteText: new PIXI.Text("0.000", textStyles.SIZE_40_FONT),
    currentComboText: new PIXI.Text("", textStyles.SIZE_40_FONT)
};

singleplayerScreenContainerItems.sendButtonSprite.x =
    initialWindowWidth / 2 + 64 * -4 + 16;
singleplayerScreenContainerItems.sendButtonSprite.y =
    initialWindowHeight / 2 + 64 * 3 + 176;
singleplayerScreenContainerItems.sendButtonSprite.interactive = true;
singleplayerScreenContainerItems.sendButtonSprite.on(
    "pointerdown",
    function () {
        sendProblem();
    }
);

singleplayerScreenContainerItems.baseSprite.x = initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.baseSprite.y = initialWindowHeight / 2 - 505;

singleplayerScreenContainerItems.currentProblemText.style.align = "center";
singleplayerScreenContainerItems.currentProblemText.tint = 0x000000;
singleplayerScreenContainerItems.currentProblemText.y =
    initialWindowHeight / 2 - 200;

singleplayerScreenContainerItems.scoreLabelerText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.scoreLabelerText.y =
    initialWindowHeight / 2 - 100;

singleplayerScreenContainerItems.currentScoreText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.currentScoreText.y =
    initialWindowHeight / 2 - 80;

singleplayerScreenContainerItems.timeLabelerText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.timeLabelerText.y =
    initialWindowHeight / 2 - 10;

singleplayerScreenContainerItems.currentTimeText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.currentTimeText.y =
    initialWindowHeight / 2 + 10;

singleplayerScreenContainerItems.baseHealthText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.baseHealthText.y =
    initialWindowHeight / 2 + 60;

singleplayerScreenContainerItems.enemiesText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.enemiesText.y = initialWindowHeight / 2 + 90;

singleplayerScreenContainerItems.valueOfVariableAText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableAText.y =
    initialWindowHeight / 2 + 120;

singleplayerScreenContainerItems.valueOfVariableBText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableBText.y =
    initialWindowHeight / 2 + 150;

singleplayerScreenContainerItems.valueOfVariableCText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableCText.y =
    initialWindowHeight / 2 + 180;

singleplayerScreenContainerItems.valueOfVariableDText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
singleplayerScreenContainerItems.valueOfVariableDText.y =
    initialWindowHeight / 2 + 210;

// Left of grid

singleplayerScreenContainerItems.actionsPerMinuteLabelerText.x =
    initialWindowWidth / 2 - 465;
singleplayerScreenContainerItems.actionsPerMinuteLabelerText.y =
    initialWindowHeight / 2 - 10;

singleplayerScreenContainerItems.actionsPerMinuteText.x =
    initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.actionsPerMinuteText.y =
    initialWindowHeight / 2 + 10;

singleplayerScreenContainerItems.currentComboText.x =
    initialWindowWidth / 2 - 450;
singleplayerScreenContainerItems.currentComboText.y =
    initialWindowHeight / 2 - 80;

singleplayerScreenContainerItems.currentComboTimeLeftText.x =
    initialWindowWidth / 2 - 260;
singleplayerScreenContainerItems.currentComboTimeLeftText.y =
    initialWindowHeight / 2 - 35;

// Images

var multiplayerScreenContainerItems = {
    sendButtonSprite: new PIXI.Sprite(sendButtonTexture),

    baseSprite: new PIXI.Sprite(baseTexture),

    playerNameText: new PIXI.Text("", textStyles.SIZE_24_FONT),

    currentProblemText: new PIXI.Text("", textStyles.SIZE_72_MATH_FONT),
    enemiesSentLabelerText: new PIXI.Text(
        "Enemies Sent",
        textStyles.SIZE_24_FONT
    ),
    currentEnemiesSentText: new PIXI.Text("0", textStyles.SIZE_64_FONT),
    numberOfPendingEnemiesText: new PIXI.Text("0", textStyles.SIZE_40_FONT),
    timeLabelerText: new PIXI.Text("Time", textStyles.SIZE_24_FONT),
    currentTimeText: new PIXI.Text("0:00.000", textStyles.SIZE_40_FONT),
    baseHealthText: new PIXI.Text(
        "Base Health: 10/10",
        textStyles.SIZE_24_FONT
    ),
    enemiesText: new PIXI.Text("Enemies: 0/0", textStyles.SIZE_24_FONT),
    valueOfVariableAText: new PIXI.Text("a = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableBText: new PIXI.Text("b = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableCText: new PIXI.Text("c = ?", textStyles.SIZE_32_MATH_FONT),
    valueOfVariableDText: new PIXI.Text("d = ?", textStyles.SIZE_32_MATH_FONT),
    actionsPerMinuteLabelerText: new PIXI.Text(
        "Actions Per Minute",
        textStyles.SIZE_24_FONT
    ),
    actionsPerMinuteText: new PIXI.Text("0.000", textStyles.SIZE_40_FONT),
    currentComboText: new PIXI.Text("", textStyles.SIZE_40_FONT),
    currentComboTimeLeftText: new PIXI.Text(
        "combo time left",
        textStyles.SIZE_24_FONT
    ),
    currentPlayersRemainingText: new PIXI.Text(
        "players remaining",
        textStyles.SIZE_24_FONT
    )
};

multiplayerScreenContainerItems.sendButtonSprite.x =
    initialWindowWidth / 2 + 64 * -4 + 16;
multiplayerScreenContainerItems.sendButtonSprite.y =
    initialWindowHeight / 2 + 64 * 3 + 176;
multiplayerScreenContainerItems.sendButtonSprite.interactive = true;
multiplayerScreenContainerItems.sendButtonSprite.on("pointerdown", function () {
    sendProblem();
});

multiplayerScreenContainerItems.baseSprite.x = initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.baseSprite.y = initialWindowHeight / 2 - 465;

multiplayerScreenContainerItems.numberOfPendingEnemiesText.x =
    initialWindowWidth / 2 + 500;
multiplayerScreenContainerItems.numberOfPendingEnemiesText.y =
    initialWindowHeight / 2 - 400;

multiplayerScreenContainerItems.playerNameText.style.align = "center";
multiplayerScreenContainerItems.playerNameText.y =
    initialWindowHeight / 2 + 440;

multiplayerScreenContainerItems.currentProblemText.style.align = "center";
multiplayerScreenContainerItems.currentProblemText.tint = 0x000000;
multiplayerScreenContainerItems.currentProblemText.y =
    initialWindowHeight / 2 - 200;

multiplayerScreenContainerItems.enemiesSentLabelerText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.enemiesSentLabelerText.y =
    initialWindowHeight / 2 - 100;

multiplayerScreenContainerItems.currentEnemiesSentText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.currentEnemiesSentText.y =
    initialWindowHeight / 2 - 80;

multiplayerScreenContainerItems.timeLabelerText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.timeLabelerText.y =
    initialWindowHeight / 2 - 10;

multiplayerScreenContainerItems.currentTimeText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.currentTimeText.y =
    initialWindowHeight / 2 + 10;

multiplayerScreenContainerItems.baseHealthText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.baseHealthText.y = initialWindowHeight / 2 + 60;

multiplayerScreenContainerItems.enemiesText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.enemiesText.y = initialWindowHeight / 2 + 90;

multiplayerScreenContainerItems.valueOfVariableAText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableAText.y =
    initialWindowHeight / 2 + 120;

multiplayerScreenContainerItems.valueOfVariableBText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableBText.y =
    initialWindowHeight / 2 + 150;

multiplayerScreenContainerItems.valueOfVariableCText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableCText.y =
    initialWindowHeight / 2 + 180;

multiplayerScreenContainerItems.valueOfVariableDText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.valueOfVariableDText.y =
    initialWindowHeight / 2 + 210;

multiplayerScreenContainerItems.currentPlayersRemainingText.x =
    initialWindowWidth / 2 + 64 * 2 + 96;
multiplayerScreenContainerItems.currentPlayersRemainingText.y =
    initialWindowHeight / 2 + 240;

// Left of grid

multiplayerScreenContainerItems.actionsPerMinuteLabelerText.x =
    initialWindowWidth / 2 - 465;
multiplayerScreenContainerItems.actionsPerMinuteLabelerText.y =
    initialWindowHeight / 2 - 10;

multiplayerScreenContainerItems.actionsPerMinuteText.x =
    initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.actionsPerMinuteText.y =
    initialWindowHeight / 2 + 10;

multiplayerScreenContainerItems.currentComboText.x =
    initialWindowWidth / 2 - 450;
multiplayerScreenContainerItems.currentComboText.y =
    initialWindowHeight / 2 - 80;

multiplayerScreenContainerItems.currentComboTimeLeftText.y =
    initialWindowHeight / 2 - 35;
multiplayerScreenContainerItems.currentComboTimeLeftText.x =
    initialWindowWidth / 2 - 260;

var tileTextures = [[], []];

for (i = 0; i < 2; i++) {
    for (j = 0; j < 24; j++) {
        var s1 = i == 1 ? "selected" : "";
        var tile = PIXI.Texture.from(
            "/public/assets/images/game-screen/tile" + j.toString() + s1 + ".png"
        );
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
                $("#key-to-force-select-tile-" + keyRebindProcessUnderway).text(
                    event.code
                );
                keyRebindProcessUnderway = false;
            }
        } else {
            processKeypress(event);
        }
    } else {
        event.preventDefault();
        toggleStatusBarVisibility();
    }
});
// =============== END OF OTHER STUFF ===============================

// Initialization Finished
initializationFinished = true;

// ======================================================================================== END OF INITIALIZATION =====================================================================
console.log("Initialization finished!");
var game = JSON.parse(JSON.stringify(game));
setPropertiesAndChangeScreen(currentScreen, false);
addThingsToSingleplayerScreenContainer();
addThingsToMultiplayerScreenContainer();
resizeContainer();
$("#status-bar-container").hide(0);
if (isMobile) {
    alert(
        "Hi there! It looks like you are playing on a phone or tablet. Please note that the game might not be fully playable on a phone or tablet."
    );
}
var firstUpdateReceived = false;
let resize = function resize() {
    resizeContainer();
};

var guestNameOfSocketOwner;

window.onload = () => {
    guestNameOfSocketOwner = $("#player-name").text();
    $("#loading-screen-text").html(
        "Mathematical Base Defenders is in its development stage.<br>Features may not work unexpectedly, and current product is not indicative of final product.<br><br>Mathematical Base Defenders is <span style='color:#ff0000;background-color:#000000;'>not</span> a substitute for a legitimate math tutor."
    );
    $("#loading-screen").click(() => $("#loading-screen-container").fadeOut(1000).hide(0) );    
    $("#loading-screen-container").delay(2000).fadeOut(1000).hide(0);
};

window.addEventListener("resize", resize);

// Rendering Loop
let framesPerSecondCounterTimeInMilliseconds = 0;
let framesPerSecondThisSecond = 0;

app.ticker.add((delta) => {
    // delta = frames "skipped" (1 frame = 1/60 seconds)

    // variables
    framesPerSecondCounterTimeInMilliseconds += delta;
    framesPerSecondThisSecond++;

    $("#frames-per-second").text(Math.round(app.ticker.FPS));

    // global
    for (let toastNotification in game.toastNotifications) {
        if (
            game.toastNotifications[toastNotification].expiryTime < Date.now()
        ) {
            $("#toast-notification-" + toastNotification + "-container").remove();

            delete game.toastNotifications[toastNotification];
        }
    }

    // status bar

    // screens
    switch (currentScreen) {
        case screens.SINGLEPLAYER_GAME_SCREEN: {
            // Update Text Positions
            singleplayerScreenContainerItems.currentProblemText.x =
                (initialWindowWidth -
                    PIXI.TextMetrics.measureText(
                        singleplayerScreenContainerItems.currentProblemText
                            .text === undefined
                            ? ""
                            : singleplayerScreenContainerItems.currentProblemText.text.toString(),
                        textStyles.SIZE_72_MATH_FONT
                    ).width) /
                2;
            singleplayerScreenContainerItems.actionsPerMinuteText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    singleplayerScreenContainerItems.actionsPerMinuteText.text,
                    textStyles.SIZE_40_FONT
                ).width;
            singleplayerScreenContainerItems.currentComboText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    singleplayerScreenContainerItems.currentComboText.text,
                    textStyles.SIZE_40_FONT
                ).width;
            singleplayerScreenContainerItems.currentComboTimeLeftText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    singleplayerScreenContainerItems.currentComboTimeLeftText
                        .text,
                    textStyles.SIZE_24_FONT
                ).width;
            break;
        }

        case screens.MULTIPLAYER_GAME_SCREEN: {
            // Update Text Positions
            multiplayerScreenContainerItems.currentProblemText.x =
                (initialWindowWidth -
                    PIXI.TextMetrics.measureText(
                        multiplayerScreenContainerItems.currentProblemText
                            .text === undefined
                            ? ""
                            : multiplayerScreenContainerItems.currentProblemText.text.toString(),
                        textStyles.SIZE_72_MATH_FONT
                    ).width) /
                2;
            multiplayerScreenContainerItems.actionsPerMinuteText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    multiplayerScreenContainerItems.actionsPerMinuteText.text,
                    textStyles.SIZE_40_FONT
                ).width;
            multiplayerScreenContainerItems.currentComboText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    multiplayerScreenContainerItems.currentComboText.text,
                    textStyles.SIZE_40_FONT
                ).width;
            multiplayerScreenContainerItems.currentComboTimeLeftText.x =
                initialWindowWidth / 2 -
                260 -
                PIXI.TextMetrics.measureText(
                    multiplayerScreenContainerItems.currentComboTimeLeftText
                        .text,
                    textStyles.SIZE_24_FONT
                ).width;

            multiplayerScreenContainerItems.playerNameText.x =
                (initialWindowWidth -
                    PIXI.TextMetrics.measureText(
                        multiplayerScreenContainerItems.playerNameText.text ===
                            undefined
                            ? ""
                            : multiplayerScreenContainerItems.playerNameText.text.toString(),
                        textStyles.SIZE_24_FONT
                    ).width) /
                2;
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
function setPropertiesAndChangeScreen(newScreen, forceResizeContainer) {
    if (forceResizeContainer) {
        resizeContainer();
    }

    // // animate currentScreen first
    // switch (currentScreen) {
    //     case screens.MAIN_MENU_SCREEN: {
    //         $(".main-menu-screen-button").animate({ opacity: 0 });
    //     }
    //     case screens.SETTINGS_SCREEN: {
    //         $(".settings-screen-navigation-button").animate({ opacity: 0 });
    //     }
    // }

    setCustomEnemyPictureMetadata(settings.video.customEnemyPictureURL);

    hideEverything();

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
            // $(".main-menu-screen-button").animate({ opacity: 1 });
            break;
        }
        case screens.INFORMATION_SCREEN: {
            // set properties
            $("#hub-container").show(0);
            $("#information-screen-container").show(0);
            break;
        }
        case screens.SINGLEPLAYER_LOBBY_SCREEN: {
            document.body.style.overflow = "none";
            $("#hub-container").show(0);
            $("#singleplayer-lobby-screen-container").show(0);
            break;
        }
        case screens.SINGLEPLAYER_GAME_SCREEN: {
            // set properties
            removeAllRenderedEnemies();
            resizeContainer();
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
            for (let i = 0; i < game.opponentGameInstances.length; i++) {
                console.log(game.opponentGameInstances[i]);
                game.opponentGameInstances[i] &&
                    game.opponentGameInstances[i].destroy();
            }
            game.opponentGameInstances = [];
            game.cachedLengthOfOpponentGameInstances = 0;
            removeAllRenderedEnemies();
            resizeContainer();
            document.body.style.overflow = "none";
            document.getElementById("pixi-canvas").style.display = "block";
            multiplayerScreenContainer.visible = true; // for now
            break;
        }
        case screens.DEFAULT_MULTIPLAYER_ROOM_LOBBY_SCREEN: {
            for (let i = 0; i < game.opponentGameInstances.length; i++) {
                console.log(game.opponentGameInstances[i]);
                game.opponentGameInstances[i] &&
                    game.opponentGameInstances[i].destroy();
            }
            game.opponentGameInstances = [];
            game.cachedLengthOfOpponentGameInstances = 0;
            document.body.style.overflow = "none";
            $("#hub-container").show(0);
            $("#default-multiplayer-room-lobby-screen-container").show(0);
            break;
        }
        case screens.STATISTICS_SCREEN: {
            $("#hub-container").show(0);
            $("#statistics-screen-container").show(0);
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
                        multiplicationSignForm: "cross"
                    }
                };
            }

            break;
        }
        case screens.GAME_OVER_SCREEN: {
            // set properties
            document.body.style.overflow = "hidden";
            document.getElementById("hub-container").style.display = "block";
            document.getElementById(
                "game-over-screen-container"
            ).style.display = "block";
            break;
        }
    }
}

function setPropertiesAndChangeSettingsScreen(newSettingsScreen) {
    document.getElementById("video-settings-screen-container").style.display =
        "none";
    // document.getElementById("audio-settings-screen-container").style.display = "none";
    document.getElementById("input-settings-screen-container").style.display =
        "none";
    document.getElementById("online-settings-screen-container").style.display =
        "none";
    switch (newSettingsScreen) {
        case settingsScreens.VIDEO_SETTINGS_SCREEN: {
            document.getElementById(
                "video-settings-screen-container"
            ).style.display = "block";
            break;
        }
        case settingsScreens.AUDIO_SETTINGS_SCREEN: {
            document.getElementById(
                "audio-settings-screen-container"
            ).style.display = "block";
            break;
        }
        case settingsScreens.INPUT_SETTINGS_SCREEN: {
            document.getElementById(
                "input-settings-screen-container"
            ).style.display = "block";
            break;
        }
        case settingsScreens.ONLINE_SETTINGS_SCREEN: {
            document.getElementById(
                "online-settings-screen-container"
            ).style.display = "block";
            break;
            }
        default: {
            break;
        }
    }
}


function hideEverything(){
    $("#hub-container").hide(0);
    $("#main-menu-screen-container").hide(0);
    $("#information-screen-container").hide(0);
    $("#singleplayer-lobby-screen-container").hide(0);
    $("#multiplayer-lobby-screen-container").hide(0);
    $("#default-multiplayer-room-lobby-screen-container").hide(0);
    $("#statistics-screen-container").hide(0);
    $("#settings-screen-container").hide(0);
    $("#game-over-screen-container").hide(0);

    $(
        "#singleplayer-screen-custom-mode-settings-screen-content-container"
    ).hide(0);

    $("#bottom-user-interface-container").hide(0);

    $("#pixi-canvas").hide(0);
}

function startKeyRebindProcess(tileID) {
    keyRebindProcessUnderway = tileID;
}

function endSingleplayerGame() {
    setPropertiesAndChangeScreen(screens.GAME_OVER_SCREEN, true);
}

function processKeypress(event) {
    // console.log(event);
    socket.send(JSON.stringify({action:"keypress",arguments:{code:event.code, playerTileKeybinds:settings.input.keybinds.tiles}}));
    switch (currentScreen) {
        case screens.MAIN_MENU_SCREEN: {
            break;
        }
        case screens.SINGLEPLAYER_GAME_SCREEN: {
            // check if input is from numpad
            if (event.key != "Escape") {
            } else {
                setPropertiesAndChangeScreen(screens.MAIN_MENU_SCREEN, true);
                socket.send(JSON.stringify({action:"leaveRoom"}));
            }
            break;
        }
        case screens.DEFAULT_MULTIPLAYER_ROOM_LOBBY_SCREEN: {
            // check if input is from numpad
            if (event.key != "Escape") {
                if (event.key == "/") {
                    if ($("#multiplayer-room-message-box").is(":focus")) {
                        return;
                    }
                    $("#multiplayer-room-message-box").focus();
                    event.preventDefault();
                    $("#multiplayer-room-message-box").val("");
                }

                if (event.key == "Enter") {
                    if (
                        document.activeElement ==
                        document.getElementById("multiplayer-room-message-box")
                    ) {
                        sendChatMessage();
                        $("#multiplayer-room-message-box").val("");
                    }
                }
            } else {
                socket.send(JSON.stringify({action:"leaveRoom"}));
                setPropertiesAndChangeScreen(screens.MAIN_MENU_SCREEN, true);
            }
            break;
        }
        case screens.MULTIPLAYER_GAME_SCREEN: {
            // check if input is from numpad
            if (event.key != "Escape") {
            } else {
                socket.send(JSON.stringify({action:"leaveRoom"}));
                setPropertiesAndChangeScreen(screens.MAIN_MENU_SCREEN, true);
            }
            break;
        }
        case screens.SETTINGS_SCREEN: {
            switch (event.key) {
                case "Escape": {
                    setPropertiesAndChangeScreen(
                        screens.MAIN_MENU_SCREEN,
                        true
                    );
                    break;
                }
            }
            break;
        }
    }
}

function startDefaultSingleplayerGame(mode) {
    if (game.lastSingleplayerGameModePlayed == "customSingleplayerMode" && mode == "customSingleplayerMode") {
        startCustomSingleplayerGame(getCustomSingleplayerModeInputs());
    } else {
        socket.send(JSON.stringify({action: "createAndJoinDefaultSingleplayerRoom",arguments:{gameMode: mode}}));
        game.lastSingleplayerGameModePlayed = mode;
        setPropertiesAndChangeScreen(screens.SINGLEPLAYER_GAME_SCREEN, true);
    }
}

function processAction() {
    game.actionsPerformed++;
}

function forceSelectTileWithTermID(termIDToSelect) {
    for (i = 0; i < 49; i++) {
        if (
            game.tilesOnBoard[i].termID == termIDToSelect &&
            game.tilesOnBoard[i].selected == false
        ) {
            processTileClick(game.tilesOnBoard[i]);
            return; // break
        }
    }
    // None found
}

function deleteLastSelectedTerm() {
    if (game.tilesInCurrentProblem.length > 0) {
        processTileClick(
            game.tilesInCurrentProblem[game.tilesInCurrentProblem.length - 1]
        );
    }
}

function sendProblem() {
    // //TODO: socket.emit("action");
    socket.send(JSON.stringify({action:"keypress",arguments:{code:"Space", playerTileKeybinds:settings.input.keybinds.tiles}}));
}

// Random Generators

function addThingsToSingleplayerScreenContainer() {
    for (let item in singleplayerScreenContainerItems) {
        singleplayerScreenContainer.addChild(
            singleplayerScreenContainerItems[item]
        );
    }
}

function addThingsToMultiplayerScreenContainer() {
    for (let item in multiplayerScreenContainerItems) {
        multiplayerScreenContainer.addChild(
            multiplayerScreenContainerItems[item]
        );
    }
}

function generateRandomColor() {
    return parseInt("0x" + Math.floor(Math.random() * 16777215).toString(16));
}

// Rendering Helpers

function resizeContainer() {
    let ratio = Math.min(
        window.innerWidth / initialWindowWidth,
        (window.screen.availHeight -
            (window.outerHeight - window.innerHeight)) /
            initialWindowHeight
    );

    mainMenuScreenContainer.scale.x = ratio;
    mainMenuScreenContainer.scale.y = ratio;
    mainMenuScreenContainer.position.y =
        (window.innerHeight - mainMenuScreenContainer.height) / 2;

    singleplayerScreenContainer.scale.x = ratio;
    singleplayerScreenContainer.scale.y = ratio;

    if (window.innerWidth > 1920 * ratio) {
        singleplayerScreenContainer.position.x =
            (window.innerWidth - singleplayerScreenContainer.width) / 2 - 450;
    } else {
        singleplayerScreenContainer.position.x = 0;
    }

    singleplayerScreenContainer.position.y =
        (window.innerHeight - singleplayerScreenContainer.height) / 2;

    multiplayerScreenContainer.scale.x = ratio;
    multiplayerScreenContainer.scale.y = ratio;

    multiplayerScreenContainer.position.y =
        (window.innerHeight - multiplayerScreenContainer.height) / 2;

    if (window.innerWidth > 1920 * ratio) {
        multiplayerScreenContainer.position.x =
            (window.innerWidth - multiplayerScreenContainer.width) / 2 - 450;
    } else {
        multiplayerScreenContainer.position.x = 0;
    }

    renderer.resize(initialWindowWidth * ratio, initialWindowHeight * ratio);
}

function forceWeakResizeContainer() {
    let ratio = Math.min(
        window.innerWidth / initialWindowWidth,
        (window.screen.availHeight -
            (window.outerHeight - window.innerHeight)) /
            initialWindowHeight
    );

    if (window.innerWidth > 1920 * ratio) {
        singleplayerScreenContainer.position.x =
            (window.innerWidth - singleplayerScreenContainer.width) / 2 - 450;
        multiplayerScreenContainer.position.x =
            (window.innerWidth - multiplayerScreenContainer.width) / 2 - 450;
    } else {
        singleplayerScreenContainer.position.x = 0;
        multiplayerScreenContainer.position.x = 0;
    }
}

function removeAllRenderedEnemies() {
    for (let enemy in game.enemyRenderStatus) {
        if (game.enemyRenderStatus.hasOwnProperty(enemy)) {
            singleplayerScreenContainer.removeChild(
                game.enemyRenderStatus[enemy]["enemySprite"]
            );
            singleplayerScreenContainer.removeChild(
                game.enemyRenderStatus[enemy]["requestedValueTextSprite"]
            );
            multiplayerScreenContainer.removeChild(
                game.enemyRenderStatus[enemy]["enemySprite"]
            );
            multiplayerScreenContainer.removeChild(
                game.enemyRenderStatus[enemy]["requestedValueTextSprite"]
            );
            multiplayerScreenContainer.removeChild(
                game.enemyRenderStatus[enemy]["senderNameTextSprite"]
            );
            delete game.enemyRenderStatus[enemy];
        }
    }
    game.renderedEnemiesOnField = [];
    game.spritesOfRenderedEnemiesOnField = [];
}

// "Predetermined" Generators

// Converters

// io

function restoreSettings() {
    settings = localStorage.getItem("settings");

    if (settings === undefined || settings == null) {
        settings = {
            video: {
                enemyColor: "randomForEach",
                multiplicationSignForm: "cross",
                customEnemyPictureURL: ""
            },
            input: {
                keybinds: {
                    tiles: [
                        "KeyM",
                        "KeyJ",
                        "KeyK",
                        "KeyL",
                        "KeyU",
                        "KeyI",
                        "KeyO",
                        "Digit7",
                        "Digit8",
                        "Digit9",
                        "Slash",
                        "Semicolon",
                        "KeyP",
                        "Digit0",
                        "Quote",
                        "KeyW",
                        "KeyE",
                        "KeyS",
                        "KeyD"
                    ]
                }
            }
        };
        localStorage.setItem("settings", JSON.stringify(settings));
    } else {
        settings = JSON.parse(settings);
    }
}

function updateSettingsSelections() {
    // video
    $("#enemy-color-setting-drop-down-menu").val(settings.video.enemyColor);
    $("#multiplication-sign-form-setting-drop-down-menu").val(
        settings.video.multiplicationSignForm
    );
    $("#enemy-custom-selected-picture").val(settings.video.enemyPicture);
    // input
    for (let i = 0; i < 19; i++) {
        $("#key-to-force-select-tile-" + i).text(
            settings.input.keybinds.tiles[i]
        );
    }
}

function resetKeybinds() {
    settings.input.keybinds.tiles = [
        "KeyM",
        "KeyJ",
        "KeyK",
        "KeyL",
        "KeyU",
        "KeyI",
        "KeyO",
        "Key7",
        "Key8",
        "Key9",
        "Slash",
        "Semicolon",
        "KeyP",
        "Key0",
        "Quote",
        "KeyW",
        "KeyE",
        "KeyS",
        "KeyD"
    ];
    updateSettingsSelections();
    saveSettings();
}

function changeSettings() {
    settings = {
        video: {
            enemyColor: $("#enemy-color-setting-drop-down-menu").val(),
            multiplicationSignForm: $(
                "#multiplication-sign-form-setting-drop-down-menu"
            ).val(),
            customEnemyPictureURL: $("#enemy-custom-selected-picture").val()
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
                    $("#key-to-force-select-tile-19").text()
                ]
            }
        }
    };
}

function saveSettings() {
    changeSettings();
    localStorage.setItem("settings", JSON.stringify(settings));
}

// other useless stuff

function testCustomEnemyPicture(url) {
    $("#picture-tester").html(`<img src=${url} width="150" height="150">`);
    if (document.querySelector("#picture-tester")) {
        if (
            !document.querySelector("#picture-tester").querySelector("img")
                .complete
        ) {
            $("#picture-tester").html("Failed to get image.");
        }
    }
}

function testCustomBackgroundPicture(url) {
    url = DOMPurify.sanitize(url);
    if (url) {
        $("body").css("background", `url(${url})`);
    } else {
        $("body").css("background", `#eeeeee`);
    }
}

function setCustomEnemyPictureMetadata(url) {
    if (url){

        $("#custom-enemy-picture").html(
        `<img src=${DOMPurify.sanitize(url)} width="150" height="150">`
    );
    }if (document.querySelector("#custom-enemy-picture")) {
        if (
            !document
                .querySelector("#custom-enemy-picture")
                .querySelector("img")?.complete
        ) {
            $("#custom-enemy-picture").html("Failed to get image.");
        }
    }
    
}

// TODO: Unused?
function changeCustomBackgroundPicture(url) {
    let imageAsSprite = new PIXI.Sprite(PIXI.Texture().from(`${url}`));
    imageAsSprite.zIndex = -1000;
    singleplayerScreenContainer.addChild(imageAsSprite);
    multiplayerScreenContainer.addChild(imageAsSprite);
}

function toggleStatusBarVisibility() {
    $("#status-bar-container").toggle(0);
}

function showTextModal(text, title, color) {
    // clear old text
    $("#text-modal-title").text("");
    $("#text-modal-text").text("");

    $("#text-modal-title").text(title);
    $("#text-modal-text").text(text);
    $("#text-modal-container").fadeIn(200);
    $("#text-modal-container").show(0).css("display","flex");
}

function showUserInformationModal(name) {
    socket.send(JSON.stringify({action:"getDataForUser",arguments:{
        userToGetDataOf: name
    }}))
    game.userCurrentUserIsViewing = name;
    $("#user-information-modal-title").text("");
    $("#user-information-modal-text").text("");
    $("#user-information-modal-container").fadeIn(200);
    $("#user-information-modal-container").show(0).css("display","flex");

}



function showReportUserModal(){
    $("#report-user-modal-title").text(`Report ${game.userCurrentUserIsViewing}?`);

    $("#report-user-modal-container").fadeIn(200);
    $("#report-user-modal-container").show(0).css("display","flex");
}

function showCustomSingleplayerGameModeSettingsScreen() {
    $(
        "#singleplayer-screen-custom-mode-settings-screen-content-container"
    ).show(0);
}

function getCustomSingleplayerModeInputs() {
    let inputs = [
        "starting-base-health",
        "allowed-combo-time",
        "enemy-spawn-chance-in-percent",
        "enemy-generation-interval-in-milliseconds",
        "enemy-limit",
        "enemy-speed-multiplier",
        "starting-value-of-variable-a",
        "starting-value-of-variable-b",
        "starting-value-of-variable-c",
        "starting-value-of-variable-d"
    ];

    let keys = [
        "baseHealth",
        "allowedComboTimeInMilliseconds",
        "enemyGenerationThreshold",
        "enemyGenerationIntervalInMilliseconds",
        "enemyLimit",
        "enemySpeedMultiplier",
        "valueOfVariableA",
        "valueOfVariableB",
        "valueOfVariableC",
        "valueOfVariableD"
    ];

    let data = {};

    for (let i = 0; i < inputs.length; i++) {
        data[keys[i]] = $(`#${inputs[i]}`).val();
    }

    return data;
}

function startCustomSingleplayerGame(data) {
    game.lastSingleplayerGameModePlayed = "customSingleplayerMode";
    socket.send(JSON.stringify({action:"createAndJoinCustomSingleplayerRoom",arguments:{
        settings: data
    }}))
}

function getAllowedComboTimeAccordingToMode(
    gameMode,
    comboTimeForCustomSingleplayerMode
) {
    switch (gameMode) {
        case "easySingleplayerMode": {
            return 10000;
        }
        case "standardSingleplayerMode": {
            return 5000;
        }
        case "defaultMultiplayerMode": {
            return 5000;
        }
        case "customSingleplayerMode": {
            return parseInt(comboTimeForCustomSingleplayerMode);
        }
    }
}

function authenticate(username,password){
    $.ajax({url:`/authenticate?guestName=${guestNameOfSocketOwner}&username=${username}&password=${btoa(btoa(btoa(btoa(password))))}`,method:"POST",headers: {
        'CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
      }});
}

function sendChatMessage(){
    socket.send(JSON.stringify({action:"chatMessage",arguments:{message:$("#multiplayer-room-message-box").val()}}));
    $("#multiplayer-room-message-box").val("");
}