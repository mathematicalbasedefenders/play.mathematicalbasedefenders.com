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
    position: ToastNotificationPosition,
    lifespan?: number
  ) {
    this.text = text;
    this.position = position;
    this.id = ToastNotification.nextID;
    ToastNotification.nextID++;
    this.lifespan = lifespan || 5000;
    this.age = 0;
    this.render();
    ToastNotification.notifications.push(this);
    console.log(ToastNotification.notifications);
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

enum ModalNotificationButtonStyle {
  SINGLE = 1,
  DOUBLE_SELECT = 2
}
class ModalNotification {
  static activeNotifications = 0;
  static nextID = 0;
  title = "";
  id = 0;
  text = "";
  buttonStyle!: ModalNotificationButtonStyle;
  constructor(
    title: string,
    text: string,
    buttonStyle?: ModalNotificationButtonStyle
  ) {
    ModalNotification.nextID++;
    this.id = ModalNotification.nextID;
    this.title = title;
    this.text = text;
    this.buttonStyle = buttonStyle || ModalNotificationButtonStyle.SINGLE;
    this.render();
  }

  render() {
    ModalNotification.activeNotifications++;
    let buttons = `<button id="modal-notification--${this.id}__close-button">Close</button>`;
    if (this.buttonStyle === ModalNotificationButtonStyle.DOUBLE_SELECT) {
      buttons += `&nbsp;&nbsp;<button>OK</button>`;
    }
    $("#main-content__modal-notification-container").append(
      `<div id="modal-notification--${this.id}" class="modal-notification"><div class="modal-notification__title">${this.title}</div><div class="modal-notification__content">${this.text}</div><div class="modal-notification__button-container">${buttons}</div></div>`
    );
    $(`#modal-notification--${this.id}__close-button`).on("click", () => {
      this.close(this.id);
    });
    if (ModalNotification.activeNotifications === 1) {
      $("#main-content__modal-notification-container").show(0);
      $("#main-content__modal-notification-container").css(
        "pointer-events",
        "all"
      );
    }
  }

  close(id: number) {
    $(`#modal-notification--${id}`).hide(250);
    // ...
    ModalNotification.activeNotifications--;
    if (ModalNotification.activeNotifications <= 0) {
      $("#main-content__modal-notification-container").hide(0);
      $("#main-content__modal-notification-container").css(
        "pointer-events",
        "none"
      );
    }
  }
}

export {
  ToastNotification,
  ToastNotificationPosition,
  ModalNotification,
  ModalNotificationButtonStyle
};
