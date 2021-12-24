var toastNotificationsCreated = 0;
var toastNotificationExpiryTimes = 0;

const toastNotificationPositions = {
	TOP_CENTER: "topCenter",
	TOP_RIGHT: "topRight",
	BOTTOM_RIGHT: "bottomRight",
};

function createToastNotification(message, position, color) {
	toastNotificationsCreated++;
	$("#toast-notifications-container").append(
		`<div id="toast-notification-${toastNotificationsCreated}" class="toast-notification ${color}-toast-notification ${position
			.replace(/([A-Z])/, "-$1")
			.toLowerCase()}-toast-notification"><div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;background-color:#333333;">${message}</div></div>`
	);
	toastNotificationExpiryTimes[toastNotificationsCreated] = Date.now() + 5000;
}
