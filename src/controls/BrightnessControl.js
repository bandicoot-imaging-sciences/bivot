import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

import { Mapper } from '../utils/mappingLib';

function BrightnessControl({ value, onChange }) {
  const mapper = new Mapper(0.3, 0.7, 0, 1);
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The brightness of the material image">
        <Typography id="brightness-slider" gutterBottom>Brightness</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={mapper.map(value)}
          onChange={(event, newValue) => onChange(mapper.unmap(newValue))}
          valueLabelDisplay="auto"
          step={0.01}
          min={0.0}
          max={1.0}
          color='secondary'
        />
      </Grid>
    </Grid>
  );
}

export default BrightnessControl;
