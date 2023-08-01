import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

function AmbientOcclusionControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The strength of ambient occlusion effects">
        <Typography id="aostrength-slider" gutterBottom>Ambient occlusion</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={0.05}
          min={0.0}
          max={1.0}
          color='secondary'
        />
      </Grid>
    </Grid>
  );
}

export default AmbientOcclusionControl;
