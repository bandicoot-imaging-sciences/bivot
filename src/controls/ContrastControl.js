import React from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

import { Mapper } from '../utils/mappingLib';

function ContrastControl({ value, onChange }) {
  const mapper = new Mapper(0.4, 0.6, 0, 1);
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The contrast of the material image">
        <Typography id="contrast-slider" gutterBottom>Contrast</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          value={mapper.map(value)}
          onChange={(event, newValue) => onChange(mapper.unmap(newValue))}
          valueLabelDisplay="auto"
          step={0.01}
          min={0}
          max={1}
        />
      </Grid>
    </Grid>
  );
}

export default ContrastControl;
