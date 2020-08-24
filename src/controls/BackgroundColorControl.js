import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

import { ChromePicker } from 'react-color';

function BackgroundColorControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The colour of the render background">
        <Typography id="background-color-control" gutterBottom>Background color</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <ChromePicker
          disableAlpha={true}
          color={value}
          onChange={onChange}
        />
      </Grid>
    </Grid>
  );
}

export default BackgroundColorControl;
