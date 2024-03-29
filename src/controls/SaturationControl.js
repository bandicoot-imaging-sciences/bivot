import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function SaturationControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="Saturation adjustment for the basecolor">
        <Typography id="saturation-slider" gutterBottom>Saturation</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.01}
          min={-2}
          max={2}
          color='secondary'
        />
      </Grid>
    </Grid>
  );
}

export default SaturationControl;
