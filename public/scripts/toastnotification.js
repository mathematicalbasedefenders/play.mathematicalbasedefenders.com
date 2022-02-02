const toastNotificationPositions = {
	TOP_CENTER: "topCenter",
	TOP_RIGHT: "topRight",
	BOTTOM_RIGHT: "bottomRight",
};

function createToastNotification(options) {
	for (let toastNotification in game.toastNotifications) {
		if (game.toastNotifications[toastNotification].zonePosition == "bottomRight") {
			$(`#toast-notification-${game.toastNotifications[toastNotification].number}`)
				.animate(
					{
						top: "-=90px",
					},
					{ duration: 250 }
				)
				.css({
					top: "-=90px",
				});
		}
	}

	game.toastNotificationsCreated++;
	$("#toast-notifications-container").append(
		`<div id="toast-notification-${game.toastNotificationsCreated}" class="toast-notification ${(options.position || "bottomRight").replace(/([A-Z])/, "-$1").toLowerCase()}-toast-notification" style="border: 2px solid ${
			options.borderColor || "#111111"
		};"><div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;background-color:#333333;">${options.message || ""}</div></div>`
	);
	game.toastNotifications[game.toastNotificationsCreated] = {};
	game.toastNotifications[game.toastNotificationsCreated].zonePosition = options.position || "bottomRight";
	game.toastNotifications[game.toastNotificationsCreated].number = game.toastNotificationsCreated;
	game.toastNotifications[game.toastNotificationsCreated].expiryTime = Date.now() + (options.timeUntilExpiration || 5000);
}
