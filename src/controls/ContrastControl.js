import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function ContrastControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The contrast of the material image">
        <Typography id="contrast-slider" gutterBottom>Contrast</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.01}
          min={0.25}
          max={1.0}
        />
      </Grid>
    </Grid>
  );
}

export default ContrastControl;
