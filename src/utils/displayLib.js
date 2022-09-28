
export function isFullScreenAvailable() {
  return (
    document.fullscreenEnabled ||
    document.mozFullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.msFullscreenEnabled
  );
}

export function getDocumentFullScreenElement() {
  if (document.fullscreenElement) {
    return document.fullscreenElement;
  } else if (document.webkitFullscreenElement) {
    return document.webkitFullscreenElement;
  } else if (document.msFullscreenElement) {
    return document.msFullscreenElement;
  } else if (document.mozFullScreenElement) {
    return document.mozFullScreenElement;
  } else {
    return null;
  }
}

export async function openFullScreen(element) {
  function exitHandler() {
    if (!getDocumentFullScreenElement()) {
      document.removeEventListener('fullscreenchange', exitHandler, false);
      document.removeEventListener('webkitfullscreenchange', exitHandler, false);
      document.removeEventListener('MSFullscreenChange', exitHandler, false);
      document.removeEventListener('mozfullscreenchange', exitHandler, false);
    }
  }

  if (!document.fullScreenElement) {
    if (document.addEventListener) {
      document.addEventListener('fullscreenchange', exitHandler, false);
      document.addEventListener('webkitfullscreenchange', exitHandler, false);
      document.addEventListener('MSFullscreenChange', exitHandler, false);
      document.addEventListener('mozfullscreenchange', exitHandler, false);
    }
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) { /* Safari */
      await element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE11 */
      await element.msRequestFullscreen();
    } else if (element.mozRequestFullscreen) { /* Mozilla */
      await element.mozRequestFullscreen();
    }

    // Remove focus from any document element.  It's unclear why, but in
    // Firefox, when certain elements like buttons have focus, document
    // keydown events no longer trigger while in fullscreen.  Dropping
    // focus here works around the issue.
    document.activeElement.blur();
  }
}

export async function closeFullScreen() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    await document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    await document.msExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    await document.mozCancelFullScreen();
  }
}


