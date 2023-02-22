enum ToastNotificationPosition {
  TOP_RIGHT = 2,
  BOTTOM_RIGHT = 8
}

class ToastNotification {
  static notifications: ToastNotification[];
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
  }

  render() {
    this.renderTime = new Date();
    let id = this.id;
    $("#main-content__toast-notification-container").append(
      `<div style='display:flex;justify-content:center;align-items:center;'class='text--centered toast-notification toast-notification__position-${this.position}' id='toast-notification--${this.id}'>${this.text}</div>`
    );
    setTimeout(function () {
      $(`#toast-notification--${id}`).remove();
    }, this.lifespan);
  }
}

export { ToastNotification, ToastNotificationPosition };
