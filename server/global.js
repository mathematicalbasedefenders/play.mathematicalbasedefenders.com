var sockets = [];

function initialize() {
  sockets = [];
}

function manuallyAddSocket(data){
  sockets.push(data);
}

module.exports = { sockets: sockets, initialize, manuallyAddSocket };
