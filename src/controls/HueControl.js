import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function HueControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="Hue adjustment for the basecolor">
        <Typography id="hue-slider" gutterBottom>Hue</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.01}
          min={-3.15}
          max={3.15}
        />
      </Grid>
    </Grid>
  );
}

export default HueControl;
