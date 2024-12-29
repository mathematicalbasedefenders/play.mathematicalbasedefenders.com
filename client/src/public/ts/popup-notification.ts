enum PopupNotificationButtonStyle {
  SINGLE = 1,
  DOUBLE_SELECT = 2
}
class PopupNotification {
  static activeNotifications = 0;
  static activeNotificationIDs: Array<number> = []; // stack data structure
  static nextID = 0;
  title = "";
  id = 0;
  text = "";
  buttonStyle!: PopupNotificationButtonStyle;
  constructor(
    title: string,
    text: string,
    buttonStyle?: PopupNotificationButtonStyle
  ) {
    PopupNotification.nextID++;
    this.id = PopupNotification.nextID;
    this.title = title;
    this.text = text;
    this.buttonStyle = buttonStyle || PopupNotificationButtonStyle.SINGLE;
  }

  // TODO: wtf is this
  render() {
    PopupNotification.activeNotifications++;
    PopupNotification.activeNotificationIDs.push(this.id);
    const html = this.createHTML();
    if (!html) {
      console.warn("HTML for popup notification not found...");
    }
    $("#main-content__popup-notification-container").append(html);
    $(`#popup-notification--${this.id}__close-button`).on("click", () => {
      this.close();
    });
    if (PopupNotification.activeNotifications > 0) {
      $("#main-content__popup-notification-container").show(0);
      $("#main-content__popup-notification-container").css(
        "pointer-events",
        "all"
      );
    }
  }

  close() {
    const id = this.id;
    $(`#popup-notification--${id}`).hide(250);
    const index = PopupNotification.activeNotificationIDs.indexOf(id);
    PopupNotification.activeNotificationIDs.splice(index, 1);
    // ...
    PopupNotification.activeNotifications--;
    if (PopupNotification.activeNotifications <= 0) {
      $("#main-content__popup-notification-container").hide(0);
      $("#main-content__popup-notification-container").css(
        "pointer-events",
        "none"
      );
    }
  }

  createHTML() {
    // the notification
    const notification = $("<dialog></dialog>");
    notification.attr("id", `popup-notification--${this.id}`);
    notification.addClass("popup-notification");
    // the title
    const title = $("<div></div>");
    title.addClass("popup-notification__title");
    title.text(this.title);
    // the text
    const text = $("<div></div>");
    text.addClass("popup-notification__context");
    text.html(this.text);
    // the buttons
    const buttons = $("<div></div>");
    const buttonHTML = this.createButtonsHTML();
    if (buttonHTML) {
      buttons.addClass("popup-notification__button-container");
      buttons.html(buttonHTML);
    }
    // add html
    notification.append(title);
    notification.append(text);
    if (buttonHTML) {
      notification.append(buttons);
    }
    return notification;
  }

  createButtonsHTML() {
    const buttons = `<button id="popup-notification--${this.id}__close-button">Close</button>`;
    return buttons;
  }
}

export { PopupNotification, PopupNotificationButtonStyle };
