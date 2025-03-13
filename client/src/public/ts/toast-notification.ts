interface ToastNotificationOptions {
  position?: ToastNotificationPosition;
  lifespan?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

enum ToastNotificationPosition {
  TOP_RIGHT = 2,
  BOTTOM_RIGHT = 8
}

class ToastNotification {
  static notifications: Array<ToastNotification> = [];
  static nextID = 1;

  text: string;
  age: number;
  position: ToastNotificationPosition;
  id: number;
  lifespan: number;
  foregroundColor!: string | null;
  backgroundColor!: string | null;
  borderColor!: string | null;

  /**
   * Creates a new toast notification. (copied from coderabbitai suggestion)
   * @param text The text content of the notification
   * @param options Configuration options for the notification
   * @param options.position Position of the notification (defaults to BOTTOM_RIGHT)
   * @param options.lifespan Duration in milliseconds before the notification disappears (defaults to 5000)
   * @param options.foregroundColor Text color (optional)
   * @param options.backgroundColor Background color (optional)
   * @param options.borderColor Border color (optional)
   */
  constructor(text: string, options?: ToastNotificationOptions) {
    this.text = text;
    this.position = options?.position || ToastNotificationPosition.BOTTOM_RIGHT;
    this.id = ToastNotification.nextID;
    this.lifespan = options?.lifespan || 5000;
    this.age = 0;
    this.foregroundColor = options?.foregroundColor || null;
    this.backgroundColor = options?.backgroundColor || null;
    this.borderColor = options?.borderColor || null;
    // add id
    ToastNotification.nextID++;
  }

  render() {
    ToastNotification.notifications.push(this);
    this.moveOtherNotifications();

    // It seems like jQuery doesn't have appendChild...
    const container = document.getElementById(
      "main-content__toast-notification-container"
    );
    if (!container) {
      console.warn("Container for toast notification not found...");
      return;
    }
    const html = this.createHTML();
    if (!html) {
      console.warn("HTML for toast notification not found...");
      return;
    }
    container.appendChild(html);
    $(`#toast-notification--${this.id}`).css("right", "-132px");
    $(`#toast-notification--${this.id}`).animate({ right: "+=132px" }, 500);
    this.startLifespan();
  }

  createHTML() {
    // create the div...
    const notification = $("<div></div>");
    // style the notification...
    notification.css("display", "flex");
    notification.css("justify-content", "center");
    notification.css("align-items", "center");
    if (typeof this.foregroundColor === "string") {
      notification.css("color", this.foregroundColor);
    }
    if (typeof this.backgroundColor === "string") {
      notification.css("background-color", this.backgroundColor);
    }
    if (typeof this.borderColor === "string") {
      notification.css("border-color", this.borderColor);
    }
    notification.addClass("text--centered");
    notification.addClass("toast-notification");
    notification.addClass(`toast-notification--position-${this.position}`);
    notification.attr("id", `toast-notification--${this.id}`);
    // add the text
    notification.text(`${this.text}`);
    // return the element
    return notification[0];
  }

  startLifespan() {
    const id = this.id;
    setTimeout(function () {
      $(`#toast-notification--${id}`).remove();
      const index = ToastNotification.notifications.findIndex(
        (element) => element.id === id
      );
      ToastNotification.notifications.splice(index, 1);
    }, this.lifespan);
  }

  moveOtherNotifications() {
    let direction = {};

    switch (this.position) {
      case ToastNotificationPosition.BOTTOM_RIGHT: {
        direction = { bottom: "+=76" };
        break;
      }
      case ToastNotificationPosition.TOP_RIGHT: {
        direction = { top: "+=76" };
        break;
      }
    }

    if (Object.keys(direction).length === 0) {
      return;
    }

    for (const toast of ToastNotification.notifications) {
      if (toast.position !== this.position) {
        continue;
      }
      if (toast.id === this.id) {
        continue;
      }
      $(`#toast-notification--${toast.id}`).animate(direction, 150);
    }
  }
}

export { ToastNotification, ToastNotificationPosition };
