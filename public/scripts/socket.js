socket.on("currentGameData", (compressedStringifiedJSONGameData) => {
	var currentGameData = JSON.parse(LZString.decompressFromUTF16(compressedStringifiedJSONGameData));
	// delta = frames "skipped" (1 frame = 1/60 seconds)
	switch (currentGameData.currentGame.mode) {
		case "singleplayer":
			{
				if (currentGameData.currentGame.gameIsOver) {
					setPropertiesAndChangeScreen(screens.GAME_OVER_SCREEN);
					$("#final-score").text(currentGameData.currentGame.currentScore);
					$("#final-time").text(turnMillisecondsToTime(currentGameData.currentGame.currentInGameTimeInMilliseconds));
					$("#final-enemies").text(currentGameData.currentGame.enemiesKilled + "/" + currentGameData.currentGame.enemiesCreated);
					$("#final-actions-per-minute").text(((currentGameData.currentGame.actionsPerformed / (currentGameData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString());
				} else {
					// text

					// interface
					singleplayerScreenContainerItems.currentScoreText.text = currentGameData.currentGame.currentScore;
					singleplayerScreenContainerItems.currentProblemText.text = settings.video.multiplicationSignForm == "dot" ? currentGameData.currentGame.currentProblemAsBeautifulText.replaceAll("×", "·") : currentGameData.currentGame.currentProblemAsBeautifulText;
					singleplayerScreenContainerItems.baseHealthText.text = "Base Health: " + currentGameData.currentGame.baseHealth + "/10";
					singleplayerScreenContainerItems.enemiesText.text = "Enemies: " + currentGameData.currentGame.enemiesKilled + "/" + currentGameData.currentGame.enemiesCreated;
					singleplayerScreenContainerItems.actionsPerMinuteText.text = ((currentGameData.currentGame.actionsPerformed / (currentGameData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString();
					singleplayerScreenContainerItems.currentComboText.text = currentGameData.currentGame.currentCombo < 1 ? "" : currentGameData.currentGame.currentCombo + " Combo";
					singleplayerScreenContainerItems.valueOfVariableAText.text = currentGameData.currentGame.valueOfVariableA === undefined ? "a = ?" : "a = " + currentGameData.currentGame.valueOfVariableA;
					singleplayerScreenContainerItems.valueOfVariableBText.text = currentGameData.currentGame.valueOfVariableB === undefined ? "b = ?" : "b = " + currentGameData.currentGame.valueOfVariableB;
					singleplayerScreenContainerItems.valueOfVariableCText.text = currentGameData.currentGame.valueOfVariableC === undefined ? "c = ?" : "c = " + currentGameData.currentGame.valueOfVariableC;
					singleplayerScreenContainerItems.valueOfVariableDText.text = currentGameData.currentGame.valueOfVariableD === undefined ? "d = ?" : "d = " + currentGameData.currentGame.valueOfVariableD;
					singleplayerScreenContainerItems.currentTimeText.text = turnMillisecondsToTime(currentGameData.currentGame.currentInGameTimeInMilliseconds);

					// tiles
					for (let i = 0; i < 49; i++) {
						// why?
						if (currentGameData.currentGame.tilesOnBoard[i]) {
							let t = new Tile(currentGameData.currentGame.tilesOnBoard[i].termID, i, currentGameData.currentGame.tilesOnBoard[i].selected, currentGameData.currentGame.tilesOnBoard[i].tileID);

							if (!game.tilesOnBoard[i] || game.tilesOnBoard[i].tileID != t.tileID) {
								game.tilesOnBoard[i] = t;
								game.tilesOnBoard[i].sprite.on("click", function () {
									processTileClick(i);
								});
							}
							game.tilesOnBoard[i].sprite.texture =
								tileTextures[currentGameData.currentGame.tilesOnBoard[i].selected ? 1 : 0][
									currentGameData.currentGame.tilesOnBoard[i].termID == 12 && settings.video.multiplicationSignForm == "dot" ? 23 : currentGameData.currentGame.tilesOnBoard[i].termID
								];
							singleplayerScreenContainer.addChild(game.tilesOnBoard[i].sprite);
						}
					}

					// enemies
					let renderedEnemiesOnFieldToDelete = [];
					for (let i = 0; i < currentGameData.currentGame.enemiesOnField.length; i++) {
						let enemy = currentGameData.currentGame.enemiesOnField[i];
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
					for (let i = 0; i < currentGameData.currentGame.scoreGainIndicators.length; i++) {
						let indicator = currentGameData.currentGame.scoreGainIndicators[i];
						if (indicator !== undefined && indicator !== null && indicator.ageInMilliseconds < 500) {
							if (game.scoreGainIndicatorRenderStatus[indicator.number.toString()] === undefined) {
								// ???
								// create object
								game.scoreGainIndicatorRenderStatus[indicator.number.toString()] = {};
								// create the indicator
								let scoreGainIndicator = new PIXI.Text(currentGameData.currentGame.scoreGainIndicators[i].content, textStyles.SIZE_24_FONT);
								scoreGainIndicator.x = initialWindowWidth / 2 + 80 * (currentGameData.currentGame.scoreGainIndicators[i].sPosition - 5);
								scoreGainIndicator.y = 60 * (currentGameData.currentGame.scoreGainIndicators[i].age / 600 - 5) * -1 + 300;
								// add to render

								game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"] = scoreGainIndicator;
								game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["rendered"] = true;
								// game.spritesOfRenderedEnemiesOnField.push(enemySprite);
								singleplayerScreenContainer.addChild(game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"]);
							}
							game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"].y = -24 * (currentGameData.currentGame.scoreGainIndicators[i].ageInMilliseconds / 100 - 5) + 50;
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
				break;
			}
		case "defaultMultiplayer":{
			console.log(currentGameData);
			{
				// if (currentGameData.currentGame.gameIsOver) {
					// setPropertiesAndChangeScreen(screens.GAME_OVER_SCREEN);
					// $("#final-score").text(currentGameData.currentGame.currentScore);
					// $("#final-time").text(turnMillisecondsToTime(currentGameData.currentGame.currentInGameTimeInMilliseconds));
					// $("#final-enemies").text(currentGameData.currentGame.enemiesKilled + "/" + currentGameData.currentGame.enemiesCreated);
					// $("#final-actions-per-minute").text(((currentGameData.currentGame.actionsPerformed / (currentGameData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString());
				// } else {
					// text

					// interface
					// multiplayerScreenContainerItems.currentScoreText.text = currentGameData.currentGame.currentScore;
					multiplayerScreenContainerItems.currentProblemText.text = settings.video.multiplicationSignForm == "dot" ? currentGameData.currentGame.currentProblemAsBeautifulText.replaceAll("×", "·") : currentGameData.currentGame.currentProblemAsBeautifulText;
					multiplayerScreenContainerItems.baseHealthText.text = "Base Health: " + currentGameData.currentGame.baseHealth + "/10";
					multiplayerScreenContainerItems.enemiesText.text = "Enemies: " + currentGameData.currentGame.enemiesKilled + "/" + currentGameData.currentGame.enemiesCreated;
					multiplayerScreenContainerItems.actionsPerMinuteText.text = ((currentGameData.currentGame.actionsPerformed / (currentGameData.currentGame.currentInGameTimeInMilliseconds / 1000)) * 60).toFixed(3).toString();
					multiplayerScreenContainerItems.currentComboText.text = currentGameData.currentGame.currentCombo < 1 ? "" : currentGameData.currentGame.currentCombo + " Combo";
					multiplayerScreenContainerItems.valueOfVariableAText.text = currentGameData.currentGame.valueOfVariableA === undefined ? "a = ?" : "a = " + currentGameData.currentGame.valueOfVariableA;
					multiplayerScreenContainerItems.valueOfVariableBText.text = currentGameData.currentGame.valueOfVariableB === undefined ? "b = ?" : "b = " + currentGameData.currentGame.valueOfVariableB;
					multiplayerScreenContainerItems.valueOfVariableCText.text = currentGameData.currentGame.valueOfVariableC === undefined ? "c = ?" : "c = " + currentGameData.currentGame.valueOfVariableC;
					multiplayerScreenContainerItems.valueOfVariableDText.text = currentGameData.currentGame.valueOfVariableD === undefined ? "d = ?" : "d = " + currentGameData.currentGame.valueOfVariableD;
					multiplayerScreenContainerItems.currentTimeText.text = turnMillisecondsToTime(currentGameData.currentGame.currentInGameTimeInMilliseconds);

					// tiles
					for (let i = 0; i < 49; i++) {
						// why?
						if (currentGameData.currentGame.tilesOnBoard[i]) {
							let t = new Tile(currentGameData.currentGame.tilesOnBoard[i].termID, i, currentGameData.currentGame.tilesOnBoard[i].selected, currentGameData.currentGame.tilesOnBoard[i].tileID);

							if (!game.tilesOnBoard[i] || game.tilesOnBoard[i].tileID != t.tileID) {
								game.tilesOnBoard[i] = t;
								game.tilesOnBoard[i].sprite.on("click", function () {
									processTileClick(i);
								});
							}
							game.tilesOnBoard[i].sprite.texture =
								tileTextures[currentGameData.currentGame.tilesOnBoard[i].selected ? 1 : 0][
									currentGameData.currentGame.tilesOnBoard[i].termID == 12 && settings.video.multiplicationSignForm == "dot" ? 23 : currentGameData.currentGame.tilesOnBoard[i].termID
								];
							multiplayerScreenContainer.addChild(game.tilesOnBoard[i].sprite);
						}
					}

					// enemies
					let renderedEnemiesOnFieldToDelete = [];
				
					for (let i = 0; i < currentGameData.currentGame.enemiesOnField.length; i++) {
						
						let enemy = currentGameData.currentGame.enemiesOnField[i];
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
								multiplayerScreenContainer.addChild(game.enemyRenderStatus[enemy.enemyNumber.toString()]["enemySprite"]);
								multiplayerScreenContainer.addChild(game.enemyRenderStatus[enemy.enemyNumber.toString()]["textSprite"]);
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
							multiplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy].enemySprite);
							multiplayerScreenContainer.removeChild(game.enemyRenderStatus[enemy].textSprite);
						}
					}

					for (let enemySprite of game.spritesOfRenderedEnemiesOnField) {
						if (!game.enemyRenderStatus.hasOwnProperty(enemySprite.enemyNumber.toString())) {
							renderedEnemiesOnFieldToDelete.push(enemySprite.enemyNumber.toString());
						}
					}

				// 	// score indicators
				// 	let scoreGainIndicatorsToDelete = [];
				// 	for (let i = 0; i < currentGameData.currentGame.scoreGainIndicators.length; i++) {
				// 		let indicator = currentGameData.currentGame.scoreGainIndicators[i];
				// 		if (indicator !== undefined && indicator !== null && indicator.ageInMilliseconds < 500) {
				// 			if (game.scoreGainIndicatorRenderStatus[indicator.number.toString()] === undefined) {
				// 				// ???
				// 				// create object
				// 				game.scoreGainIndicatorRenderStatus[indicator.number.toString()] = {};
				// 				// create the indicator
				// 				let scoreGainIndicator = new PIXI.Text(currentGameData.currentGame.scoreGainIndicators[i].content, textStyles.SIZE_24_FONT);
				// 				scoreGainIndicator.x = initialWindowWidth / 2 + 80 * (currentGameData.currentGame.scoreGainIndicators[i].sPosition - 5);
				// 				scoreGainIndicator.y = 60 * (currentGameData.currentGame.scoreGainIndicators[i].age / 600 - 5) * -1 + 300;
				// 				// add to render

				// 				game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"] = scoreGainIndicator;
				// 				game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["rendered"] = true;
				// 				// game.spritesOfRenderedEnemiesOnField.push(enemySprite);
				// 				multiplayerScreenContainer.addChild(game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"]);
				// 			}
				// 			game.scoreGainIndicatorRenderStatus[indicator.number.toString()]["textSprite"].y = -24 * (currentGameData.currentGame.scoreGainIndicators[i].ageInMilliseconds / 100 - 5) + 50;
				// 		} else {
				// 			scoreGainIndicatorsToDelete.push(indicator.number.toString());
				// 		}
				// 	}

				// 	// delete
					for (let numberToRemoveAsString of renderedEnemiesOnFieldToDelete) {
						game.enemyRenderStatus[numberToRemoveAsString.toString()] === undefined || multiplayerScreenContainer.removeChild(game.enemyRenderStatus[numberToRemoveAsString.toString()]["enemySprite"]);
						game.enemyRenderStatus[numberToRemoveAsString.toString()] === undefined || multiplayerScreenContainer.removeChild(game.enemyRenderStatus[numberToRemoveAsString.toString()]["textSprite"]);
						delete game.enemyRenderStatus[numberToRemoveAsString.toString()];
						game.renderedEnemiesOnField.splice(game.renderedEnemiesOnField.indexOf(numberToRemoveAsString), 1);
						game.spritesOfRenderedEnemiesOnField.splice(game.spritesOfRenderedEnemiesOnField.indexOf(numberToRemoveAsString), 1);
					}
				// 	for (let numberToRemoveAsString of scoreGainIndicatorsToDelete) {
				// 		game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()] === undefined || multiplayerScreenContainer.removeChild(game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()]["textSprite"]);
				// 		delete game.scoreGainIndicatorRenderStatus[numberToRemoveAsString.toString()];
				// 	}
				// //}
				break;
			}
		}
		
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

socket.on("defaultMultiplayerRoomAction", (action, parameters) => {
    switch (action){
        // used when someone joins or leaves
        case "updatePlayerList": {
            $("#default-multiplayer-room-player-list").text(parameters[0]);
            break;
        }
		case "updateStatusText": {
			$("#default-multiplayer-room-status-text").text(parameters[0]);
            break;
		}
		case "switchToGameContainer": {

			$("#pixi-canvas").show(0);
			$("#default-multiplayer-room-lobby-screen-container").hide(0);
			currentScreen = "multiplayerGameScreen";

			multiplayerScreenContainer.visible = true;
			break;
		}
    }
});