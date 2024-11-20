import { ToastNotification } from "./notifications";

function changeBackgroundImage(url: string) {
  try {
    document.body.style.backgroundImage = `url('${url}')`;
  } catch (error) {
    new ToastNotification(`Error while loading image: ${error}`);
  }
}

export { changeBackgroundImage };
