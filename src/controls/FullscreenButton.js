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

function FullscreenButton({ getFullscreenElement }) {
  const classes = useStyles();

  return (
    isFullScreenAvailable() ? (
      <Button
        id='fullscreenButton'
        color='accent'
        onClick={() => openFullScreen(getFullscreenElement())}
      >
        <AspectRatio className={classes.icon} />
        Fullscreen
      </Button>
    ) : ''
  );
}

export default FullscreenButton;
