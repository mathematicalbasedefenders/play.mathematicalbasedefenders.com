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

  constructor(
    text: string,
    position?: ToastNotificationPosition,
    lifespan?: number
  ) {
    this.text = text;
    this.position = position || ToastNotificationPosition.BOTTOM_RIGHT;
    this.id = ToastNotification.nextID;
    ToastNotification.nextID++;
    this.lifespan = lifespan || 5000;
    this.age = 0;
    this.render();
    ToastNotification.notifications.push(this);
  }

  render() {
    this.renderTime = new Date();
    let id = this.id;
    // TODO: This is only for bottom right (pos 8)
    for (let toast of ToastNotification.notifications) {
      if (toast.position !== this.position) {
        continue;
      }
      $(`#toast-notification--${toast.id}`).animate({ bottom: "+=76" }, 500);
    }
    $("#main-content__toast-notification-container").append(
      `<div style='display:flex;justify-content:center;align-items:center;'class='text--centered toast-notification toast-notification--position-${this.position}' id='toast-notification--${this.id}'>${this.text}</div>`
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

  render() {
    PopupNotification.activeNotifications++;
    let buttons = `<button id="popup-notification--${this.id}__close-button">Close</button>`;
    if (this.buttonStyle === PopupNotificationButtonStyle.DOUBLE_SELECT) {
      buttons += `&nbsp;&nbsp;<button>OK</button>`;
    }
    $("#main-content__popup-notification-container").append(
      `<div id="popup-notification--${this.id}" class="popup-notification"><div class="popup-notification__title">${this.title}</div><div class="popup-notification__content">${this.text}</div><div class="popup-notification__button-container">${buttons}</div></div>`
    );
    $(`#popup-notification--${this.id}__close-button`).on("click", () => {
      this.close(this.id);
    });
    if (PopupNotification.activeNotifications === 1) {
      $("#main-content__popup-notification-container").show(0);
      $("#main-content__popup-notification-container").css(
        "pointer-events",
        "all"
      );
    }
  }

  close(id: number) {
    $(`#popup-notification--${id}`).hide(250);
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
