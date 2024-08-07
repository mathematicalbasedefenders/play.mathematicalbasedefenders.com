function updateStatusTrayText(data: { [key: string]: string }) {
  $("#status-tray-text__online--total").text(data.onlineTotal);
  $("#status-tray-text__online--registered").text(data.onlineRegistered);
  $("#status-tray-text__online--guests").text(data.onlineGuests);
  $("#status-tray-text__rooms--total").text(data.roomsTotal);
  $("#status-tray-text__rooms--single").text(data.roomsSingle);
  $("#status-tray-text__rooms--multi").text(data.roomsMulti);
  $("#status-tray-text__last-update").text(data.lastUpdated);
  // ...
  $("#status-tray-text__account--name").text(data.playerName);
  // $("#status-tray-text__account--rank").text(data.playerRank);
  // $("#status-tray-text__account--level").text(data.playerLevel);
  $("#status-tray-text__playing-on").text(window.location.origin);
}
export { updateStatusTrayText };
