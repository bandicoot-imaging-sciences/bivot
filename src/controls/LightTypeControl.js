import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';
import { Flare, WbIridescent } from '@material-ui/icons';

function LightTypeControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The spread of the light shining on the material">
        <Typography id="light-type" gutterBottom>Light width</Typography>
      </Tooltip></Grid>
      <Grid item><Tooltip title="Point light"><Flare /></Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={value == 'area' ? 1 : 0}
          onChange={(event, newValue) => onChange(newValue ? 'area' : 'point')}
          valueLabelDisplay="auto"
          step={1}
          min={0}
          max={1}
        />
      </Grid>
      <Grid item><Tooltip title="Area light"><WbIridescent /></Tooltip></Grid>
    </Grid>
  );
}

export default LightTypeControl;
