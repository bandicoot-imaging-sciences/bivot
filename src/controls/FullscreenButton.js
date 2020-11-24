import React from 'react';
import { Grid, Button } from '@material-ui/core';
import { ZoomIn } from '@material-ui/icons';

function FullscreenButton({ fullscreenElement, onEnterFullScreen, onExitFullScreen }) {
  async function openFullscreen() {
    if (document.addEventListener) {
      document.addEventListener('fullscreenchange', exitHandler, false);
      document.addEventListener('webkitfullscreenchange', exitHandler, false);
      document.addEventListener('MSFullscreenChange', exitHandler, false);
      document.addEventListener('mozfullscreenchange', exitHandler, false);
    }
    var entered = true;
    if (fullscreenElement.requestFullscreen) {
      await fullscreenElement.requestFullscreen();
    } else if (fullscreenElement.webkitRequestFullscreen) { /* Safari */
      await fullscreenElement.webkitRequestFullscreen();
    } else if (fullscreenElement.msRequestFullscreen) { /* IE11 */
      await fullscreenElement.msRequestFullscreen();
    } else if (fullscreenElement.mozRequestFullscreen) { /* Mozilla */
      await fullscreenElement.mozRequestFullscreen();
    } else {
      entered = false;
    }
    if (entered) {
      onEnterFullScreen();
    }
  }

  function exitHandler()
  {
    if (!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      document.mozFullScreenElement
      ))
    {
      onExitFullScreen();
    }
  }

  const fullScreenAvailable =
    document.fullscreenEnabled ||
    document.mozFullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.msFullscreenEnabled;

  return (
    <Grid item>
      {fullScreenAvailable && (
        <Button
          id='fullscreenButton'
          color='primary'
          onClick={openFullscreen}
        >
          <ZoomIn />
          Fullscreen
        </Button>
      )}
    </Grid>
  );
}

export default FullscreenButton;
