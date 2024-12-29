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
    let buttons = `<button id="popup-notification--${this.id}__close-button">Close</button>`;
    // FIXME: Never used, consider removing?
    // if (this.buttonStyle === PopupNotificationButtonStyle.DOUBLE_SELECT) {
    //   buttons += `&nbsp;&nbsp;<button>OK</button>`;
    // }
    $("#main-content__popup-notification-container").append(
      `<dialog id="popup-notification--${this.id}" class="popup-notification"><div class="popup-notification__title">${this.title}</div><div class="popup-notification__content">${this.text}</div><div class="popup-notification__button-container">${buttons}</div></dialog>`
    );
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
}

export { PopupNotification, PopupNotificationButtonStyle };
