import { ToastNotification } from "./toast-notification";

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
    const sanitizedURL = new URL(url).href;
    document.body.style.backgroundImage = `url('${sanitizedURL}')`;
  } catch (error) {
    const options = { backgroundColor: "#ff0000" };
    new ToastNotification(`Error while loading image: ${error}`, options);
  }
}

export { changeBackgroundImage };
