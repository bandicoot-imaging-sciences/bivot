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
      fullscreenElement.requestFullscreen();
    } else if (fullscreenElement.webkitRequestFullscreen) { /* Safari */
      fullscreenElement.webkitRequestFullscreen();
    } else if (fullscreenElement.msRequestFullscreen) { /* IE11 */
      fullscreenElement.msRequestFullscreen();
    } else if (fullscreenElement.mozRequestFullscreen) { /* Mozilla */
      fullscreenElement.mozRequestFullscreen();
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

  return (
    <Grid item>
      <Button
        id='fullscreenButton'
        color='primary'
        onClick={openFullscreen}
      >
        <ZoomIn />
        Fullscreen
      </Button>
    </Grid>
  );
}

export default FullscreenButton;
