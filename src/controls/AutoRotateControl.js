import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';
import { HighlightOff, ThreeDRotation } from '@material-ui/icons';

function AutoRotateControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="Control auto-rotation of the material">
        <Typography id="light-type" gutterBottom>Auto-rotate</Typography>
      </Tooltip></Grid>
      <Grid item><Tooltip title="Auto-rotate off"><HighlightOff /></Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          valueLabelDisplay="auto"
          step={8000}
          min={0}
          max={8000}
        />
      </Grid>
      <Grid item><Tooltip title="Auto-rotate on"><ThreeDRotation /></Tooltip></Grid>
    </Grid>
  );
}

export default AutoRotateControl;
