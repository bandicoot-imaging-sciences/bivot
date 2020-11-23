import React from 'react';
import { Grid, Button } from '@material-ui/core';
import { ZoomIn } from '@material-ui/icons';

function FullscreenButton({ fullscreenElement }) {
  async function openFullscreen() {
    if (fullscreenElement.requestFullscreen) {
      fullscreenElement.requestFullscreen();
    } else if (fullscreenElement.webkitRequestFullscreen) { /* Safari */
      fullscreenElement.webkitRequestFullscreen();
    } else if (fullscreenElement.msRequestFullscreen) { /* IE11 */
      fullscreenElement.msRequestFullscreen();
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
