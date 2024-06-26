enum ToastNotificationPosition {
  TOP_RIGHT = 2,
  BOTTOM_RIGHT = 8
}

class ToastNotification {
  static notifications: Array<ToastNotification> = [];
  static nextID: number = 1;

  text: string;
  age: number;
  renderTime!: Date;
  position: ToastNotificationPosition;
  id: number;
  lifespan: number;
  foregroundColor!: string | null;
  backgroundColor!: string | null;
  borderColor!: string | null;

  constructor(
    text: string,
    position?: ToastNotificationPosition,
    lifespan?: number,
    foregroundColor?: string,
    backgroundColor?: string,
    borderColor?: string
  ) {
    this.text = text;
    this.position = position || ToastNotificationPosition.BOTTOM_RIGHT;
    this.id = ToastNotification.nextID;
    ToastNotification.nextID++;
    this.lifespan = lifespan || 5000;
    this.age = 0;
    this.foregroundColor = foregroundColor || null;
    this.backgroundColor = backgroundColor || null;
    this.borderColor = borderColor || null;
    this.render();
    ToastNotification.notifications.push(this);
  }

  render() {
    this.renderTime = new Date();
    const fgColorTag = this.foregroundColor
      ? `color:${this.foregroundColor};`
      : ``;
    const bgColorTag = this.backgroundColor
      ? `background-color:${this.backgroundColor};`
      : ``;
    const bdColorTag = this.borderColor
      ? `border-color:${this.borderColor};`
      : ``;

    let id = this.id;
    // TODO: This is only for bottom right (pos 8)
    for (let toast of ToastNotification.notifications) {
      if (toast.position !== this.position) {
        continue;
      }
      $(`#toast-notification--${toast.id}`).animate({ bottom: "+=76" }, 500);
    }
    $("#main-content__toast-notification-container").append(
      `<div style='display:flex;justify-content:center;align-items:center;${fgColorTag}${bgColorTag}${bdColorTag}'class='text--centered toast-notification toast-notification--position-${this.position}' id='toast-notification--${this.id}'>${this.text}</div>`
    );
    setTimeout(function () {
      $(`#toast-notification--${id}`).remove();
      ToastNotification.notifications.splice(
        ToastNotification.notifications.findIndex(
          (element) => element.id === id
        ),
        1
      );
    }, this.lifespan);
  }
}

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
    this.render();
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
      this.close(this.id);
    });
    if (PopupNotification.activeNotifications > 0) {
      $("#main-content__popup-notification-container").show(0);
      $("#main-content__popup-notification-container").css(
        "pointer-events",
        "all"
      );
    }
  }

  close(id: number) {
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

export {
  ToastNotification,
  ToastNotificationPosition,
  PopupNotification,
  PopupNotificationButtonStyle
};
