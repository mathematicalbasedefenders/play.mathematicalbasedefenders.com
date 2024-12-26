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
  }

  render() {
    ToastNotification.notifications.push(this);
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
    $("#main-content__toast-notification-container").append(this.createHTML());
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

  createHTML() {
    // create the div...
    const notification = $("div");
    // style the notification...
    notification.css("display", "flex");
    notification.css("justify-content", "center");
    notification.css("align-items", "center");
    if (typeof this.foregroundColor === "string") {
      notification.css("color", this.foregroundColor);
    }
    if (typeof this.backgroundColor === "string") {
      notification.css("color", this.backgroundColor);
    }
    if (typeof this.borderColor === "string") {
      notification.css("color", this.borderColor);
    }
    notification.addClass("text--centered");
    notification.addClass("toast-notification");
    notification.addClass(`toast-notification--position-${this.position}`);
    notification.attr("id", `toast-notification--${this.id}`);
    // add the text
    notification.text(`${this.text}`);
    // return the element
    return notification;
  }
}

export { ToastNotification, ToastNotificationPosition };
