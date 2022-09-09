import React from 'react';
import { Grid, Typography, Tooltip, Select, MenuItem } from '@material-ui/core';

function MeshOverrideControl({ overrides, value, onChange }) {
  return (
    <div>
      <Grid container spacing={2}>
        <Grid item><Tooltip title="View the material on a different mesh">
          <Typography id="aspect-buttons" gutterBottom>Object mesh</Typography>
        </Tooltip></Grid>
        <Grid item xs>
          <Select
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {Object.keys(overrides).map((name, i) => (
              <MenuItem value={overrides[name]} key={i}>{name}</MenuItem>
            ))}
            <MenuItem value={null} key={4}>{name}</MenuItem>
          </Select>
        </Grid>
      </Grid>
    </div>
  );
}

export default MeshOverrideControl;
