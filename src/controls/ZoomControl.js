import React, { useState, useEffect } from 'react';
import { Grid, Typography, Slider, Tooltip } from '@material-ui/core';

import { Mapper } from '../utils/mappingLib';

function ZoomControl({ value, onChange, onChangeCommitted, max }) {
  // value should be an array of 3 members:
  // - min zoom
  // - [unused]
  // - max zoom
  const [mapper, setMapper] = useState(null);

  useEffect(() => {
    if (max && !Number.isNaN(max) && max != 1) {
      setMapper(new Mapper(0, max, 0, 1));
    }
  }, [max]);

  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The min and max zoom of the material">
        <Typography id="zoom-slider" gutterBottom>Zoom (min/max)</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <Slider
          getAriaLabel={(index) => (index === 0 ? 'Minimum zoom' : 'Maximum zoom')}
          min={0.03}
          max={1}
          valueLabelDisplay="auto"
          step={0.01}
          value={mapper ? value.map(v => mapper.map(v)) : value}
          onChange={(event, newValue) => onChange(mapper ? newValue.map(v => mapper.unmap(v)) : newValue)}
          onChangeCommitted={(event, newValue) => onChangeCommitted()}
          color='secondary'
        />
      </Grid>
    </Grid>
  );
}

export default ZoomControl;
