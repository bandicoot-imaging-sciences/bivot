import React from 'react';
import { Grid, Typography, Checkbox, Tooltip, ButtonGroup, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  checkbox: {
    marginLeft: theme.spacing(-1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(-1),
  },
  button: {
    border: 'none',
  },
}));

function DragControl({ value, onChange, advancedMode }) {
  const classes = useStyles();

  function onChangeCombined(checked) {
    onChange('rotate', checked);
    onChange('pan', checked);
    onChange('limits', !checked);
  }

  if (advancedMode) {
    return (
      <Grid container spacing={1}>
        <Grid item>
          <Typography>Drag-rotate</Typography>
        </Grid>
        <Grid item>
          <Tooltip title="Allow users to rotate the Shimmer View using click + drag (mobile: touch + drag)">
            <Checkbox
              className={classes.checkbox}
              checked={Boolean(value.rotate)}
              onChange={(event) => onChange('rotate', event.target.checked)}
            />
          </Tooltip>
        </Grid>
        <Grid item>
          <Typography>Drag-pan</Typography>
        </Grid>
        <Grid item>
          <Tooltip title="Allow users to pan the Shimmer View using right click + drag (mobile: double touch + drag)">
            <Checkbox
              className={classes.checkbox}
              checked={value.pan}
              onChange={(event) => onChange('pan', event.target.checked)}
            />
          </Tooltip>
        </Grid>
        <Grid item>
          <Typography>Cam/light limits</Typography>
        </Grid>
        <Grid item>
          <Tooltip title="Set limits on the drag rotation amount">
            <Checkbox
              className={classes.checkbox}
              checked={value.limits}
              onChange={(event) => onChange('limits', event.target.checked)}
            />
          </Tooltip>
        </Grid>
      </Grid>
    );
  } else {
    return (
      <Grid container spacing={2}>
        <Grid item>
          <Typography>User controls</Typography>
        </Grid>
        <Grid item>
          <ButtonGroup variant='contained' disableElevation={true}>
            <Tooltip title='On devices with a mouse, user may hover to rotate the Shimmer'>
              <Button
                id='HoverButton'
                className={classes.button}
                onClick={() => {onChangeCombined(false)}}
                variant={!value.rotate ? 'contained' : 'outlined'}
              >
                Hover
              </Button>
            </Tooltip>
            <Tooltip title='On devices with a mouse, user may left click + drag to rotate, and right click + drag to pan'>
              <Button
                id='DragButton'
                className={classes.button}
                onClick={() => {onChangeCombined(true)}}
                variant={value.rotate ? 'contained' : 'outlined'}
              >
                Drag
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Grid>
      </Grid>
    );
  }
}

export default DragControl;
