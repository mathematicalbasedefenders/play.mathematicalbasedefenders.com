function generateRoomID(){
    characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
module.exports = { generateRoomID }