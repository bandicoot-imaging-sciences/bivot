import React from 'react';
import { Grid, Typography, Checkbox, Tooltip, ButtonGroup } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles/index.js';

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

function ShowSeamsControl({ value, onChange }) {
  const classes = useStyles();

  return (
    <Grid container spacing={2}>
      <Grid item>
        <Typography>Show tile seams</Typography>
      </Grid>
      <Grid item>
        <ButtonGroup variant="contained">
          <Tooltip title='Overlay markers showing the location of the tiling seams'>
            <Checkbox
              className={classes.checkbox}
              checked={value}
              onChange={(event) => onChange(event.target.checked)}
            />
          </Tooltip>
        </ButtonGroup>
      </Grid>
    </Grid>
  );
}

export default ShowSeamsControl;
