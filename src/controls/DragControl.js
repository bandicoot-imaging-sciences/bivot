import React from 'react';
import { Grid, Typography, Checkbox, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  checkbox: {
    marginLeft: theme.spacing(-1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(-1),
  },
}));

function DragControl({ value, onChange }) {
  const classes = useStyles();

  return (
    <Grid container spacing={2}>
      <Grid item>
        <Typography>Drag-rotate</Typography>
      </Grid>
      <Grid item>
        <Tooltip title="Allow users to rotate the Shimmer View using click + drag (mobile: touch + drag)">
          <Checkbox
            className={classes.checkbox}
            value={value.rotate}
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
            value={value.pan}
            onChange={(event) => onChange('pan', event.target.checked)}
          />
        </Tooltip>
      </Grid>
    </Grid>
  );
}

export default DragControl;
