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

function ResponsiveControl({ value, onChange }) {
  const classes = useStyles();

  return (
    <Grid container spacing={2}>
      <Grid item>
        <Typography>Responsive</Typography>
      </Grid>
      <Grid item>
        <Tooltip title="Allow size to change with layout (keeping aspect ratio fixed)">
          <Checkbox
            className={classes.checkbox}
            checked={value}
            onChange={(event) => onChange(event.target.checked)}
          />
        </Tooltip>
      </Grid>
    </Grid>
  );
}

export default ResponsiveControl;
