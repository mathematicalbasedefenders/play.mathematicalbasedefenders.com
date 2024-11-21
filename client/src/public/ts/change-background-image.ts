import { ToastNotification } from "./notifications";

/**
 * Changes the background's body to the image at the specified URL.
 * @param url The URL of the background image.
 */
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
