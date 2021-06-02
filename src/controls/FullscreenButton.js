import React from 'react';
import { Grid, Button } from '@material-ui/core';
import { AspectRatio } from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

import { isFullScreenAvailable, openFullScreen } from '../utils/displayLib';

const useStyles = makeStyles((theme) => ({
  icon: {
    marginRight: theme.spacing(0.5),
  },
}));

function FullscreenButton({ getFullscreenElement, onEnterFullScreen, onExitFullScreen }) {
  const classes = useStyles();

  return (
    <Grid item>
      {isFullScreenAvailable() && (
        <Button
          id='fullscreenButton'
          color='primary'
          onClick={() => openFullScreen(getFullscreenElement(), onEnterFullScreen, onExitFullScreen)}
        >
          <AspectRatio className={classes.icon} />
          Fullscreen
        </Button>
      )}
    </Grid>
  );
}

export default FullscreenButton;
