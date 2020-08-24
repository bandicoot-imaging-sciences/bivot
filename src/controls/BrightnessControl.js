import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function BrightnessControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The brightness of the material image">
        <Typography id="brightness-slider" gutterBottom>Brightness</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.01}
          min={0.0}
          max={1.0}
        />
      </Grid>
    </Grid>
  );
}

export default BrightnessControl;
