import { ToastNotification } from "./notifications";

function changeBackgroundImage(url: string | URL) {
  if (!url) {
    console.warn("No URL found for background image, resetting to #000000...");
    return;
  }
  try {
    document.body.style.backgroundImage = `url('${url}')`;
  } catch (error) {
    new ToastNotification(`Error while loading image: ${error}`);
  }
}

export { changeBackgroundImage };
