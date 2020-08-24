import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

import { ChromePicker } from 'react-color';

function LightColorControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The colour of the light source">
        <Typography id="light-color-control" gutterBottom>Lighting color</Typography>
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

export default LightColorControl;
