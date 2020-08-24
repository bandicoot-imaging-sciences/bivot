import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function ZoomControl({ value, onChange, onChangeCommitted }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The min and max zoom of the material">
        <Typography id="zoom-slider" gutterBottom>Zoom (min/initial/max)</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          getAriaLabel={(index) => (index === 0 ? 'Minimum zoom' : (index === 1 ? 'Initial zoom' : 'Maximum zoom'))}
          min={0.05}
          max={1}
          valueLabelDisplay="auto"
          step={0.01}
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          onChangeCommitted={(event, newValue) => onChangeCommitted()}
        />
      </Grid>
    </Grid>
  );
}

export default ZoomControl;
