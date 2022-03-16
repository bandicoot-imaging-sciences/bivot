import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function ColorTemperatureControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The input color temperature for the scan">
        <Typography id="ctemp-slider" gutterBottom>Color temperature</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={10}
          min={1000}
          max={20000}
        />
      </Grid>
    </Grid>
  );
}

export default ColorTemperatureControl;
