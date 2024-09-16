import React from 'react';

import { makeStyles } from '@material-ui/core/styles';
import { Grid, Tooltip, Button, Typography } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  typeButton: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

const deg45 = Math.sqrt(0.5);
const sideLighting = [ { x: deg45, y: 0 }, ];
const workbenchLighting = [ { x: deg45, y: 0 }, { x: -deg45, y: 0 }, ];
const overheadLighting = [ { x: 0, y: 0 }, ];

function LightingControl({ value, onChange }) {
  const classes = useStyles();

  function onPosButton(type) {
    if (type === 'workbench') {
      onChange({ ...value, type, stationary: workbenchLighting });
    } else if (type === 'side') {
      onChange({ ...value, type, stationary: sideLighting });
    } else if (type === 'overhead') {
      onChange({ ...value, type, stationary: overheadLighting });
    }
  }

  return value ? (<Grid container>
    <Grid item>
      <Tooltip title={'Control the position of the light or lights'}>
        <Typography gutterBottom>
          Position
        </Typography>
      </Tooltip>
    </Grid>
    <Grid item xs={12}>
      <Tooltip title='A single overhead light'>
        <Button
          className={classes.typeButton}
          onClick={() => onPosButton('overhead')}
          variant={value.type === 'overhead' ? 'contained' : 'outlined'}
        >
          Overhead
        </Button>
      </Tooltip>
      <Tooltip title='A 45 degree light on each of the left and right sides'>
        <Button
          className={classes.typeButton}
          onClick={() => onPosButton('workbench')}
          variant={value.type === 'workbench' ? 'contained' : 'outlined'}
        >
          Workbench
        </Button>
      </Tooltip>
      <Tooltip title='A single light on the side at 45 degrees'>
        <Button
          className={classes.typeButton}
          onClick={() => onPosButton('side')}
          variant={value.type === 'side' ? 'contained' : 'outlined'}
        >
          Side
        </Button>
      </Tooltip>
    </Grid>
  </Grid>) : <></>;
}

export default LightingControl;
