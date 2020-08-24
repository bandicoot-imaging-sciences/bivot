import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function IntensityControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The intensity of the light source">
        <Typography id="intensity-slider" gutterBottom>Light intensity</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.01}
          min={0.0}
          max={4.0}
        />
      </Grid>
    </Grid>
  );
}

export default IntensityControl;
