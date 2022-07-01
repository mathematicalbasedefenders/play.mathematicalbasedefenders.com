function updateText(selector, text, useHTML) {
    if (useHTML) {$(selector).html(text); return;}
    $(selector).text(text);
}

function addText(selector, text, useHTML){
    if (useHTML) {$(selector).html($(selector).html() + `<br>` + text); return;}
    $(selector).text(
        $(selector).text() +
            `<br>` +
            text
    );
}

function updateCSS(selector, property, value) {
    $(selector).css({ [property]: value });
}

function convertTermIDToBeautifulString(id) {
    return id == 12 && settings.video.multiplicationSignForm == "dot"
        ? "·"
        : TERMS_AS_BEAUTIFUL_STRINGS[id];
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

function combineText(...textToCombine) {
    let text = "";
    for (let i = 0; i < textToCombine.length; i++) {
        text += textToCombine[i];
    }
    return text;
}


