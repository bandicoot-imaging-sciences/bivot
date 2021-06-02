
export function isFullScreenAvailable() {
  return (
    document.fullscreenEnabled ||
    document.mozFullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.msFullscreenEnabled
  );
}

export async function openFullScreen(element, onEnter, onExit) {
  function exitHandler(onExit) {
    if (!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      document.mozFullScreenElement
    )) {
      document.removeEventListener('fullscreenchange', exitWithArgs, false);
      document.removeEventListener('webkitfullscreenchange', exitWithArgs, false);
      document.removeEventListener('MSFullscreenChange', exitWithArgs, false);
      document.removeEventListener('mozfullscreenchange', exitWithArgs, false);
      onExit();
    }
  }

  function exitWithArgs() {
    return exitHandler(onExit);
  }

  if (document.addEventListener) {
    document.addEventListener('fullscreenchange', exitWithArgs, false);
    document.addEventListener('webkitfullscreenchange', exitWithArgs, false);
    document.addEventListener('MSFullscreenChange', exitWithArgs, false);
    document.addEventListener('mozfullscreenchange', exitWithArgs, false);
  }
  var entered = true;
  if (element.requestFullscreen) {
    await element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) { /* Safari */
    await element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) { /* IE11 */
    await element.msRequestFullscreen();
  } else if (element.mozRequestFullscreen) { /* Mozilla */
    await element.mozRequestFullscreen();
  } else {
    entered = false;
  }
  if (entered) {
    onEnter();
  }
}


