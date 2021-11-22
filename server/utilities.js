function generateRoomID(){
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    roomID = undefined;
    while (roomID === undefined){
        generatedRoomID = "";
        for (i = 0; i < 8; i++){
            generatedRoomID += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        roomID = generatedRoomID;
    }
    return roomID;


}

function generateGuestName(){
    characters = "0123456789";
    generatedName = "";
    for (i = 0; i < 8; i++){
        generatedName += characters.charAt(Math.floor(Math.random() * characters.length)).toString();
    }
    return "Guest " + generatedName.toString();
}
module.exports = { generateRoomID, generateGuestName }