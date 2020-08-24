import React from 'react';
import { Grid, Typography, ButtonGroup, Button, Tooltip } from '@material-ui/core';
import { CropLandscape, CropPortrait } from '@material-ui/icons';


// Implemented 2 ways: Buttons vs Switch
function OrientationControl({ value, onChange }) {
  return (
    <div>
      <Grid container spacing={2}>
        <Grid item><Tooltip title="The orientation of the material display window">
          <Typography id="orientation-buttons" gutterBottom>Orientation</Typography>
        </Tooltip></Grid>
        <Grid item xs>
          <ButtonGroup variant="contained" color="primary">
            <Tooltip title="Landscape"><Button onClick={() => {onChange(false)}}><CropLandscape /></Button></Tooltip>
            <Tooltip title="Portrait"><Button onClick={() => {onChange(true)}}><CropPortrait /></Button></Tooltip>
          </ButtonGroup>
        </Grid>
      </Grid>
      {/* <Grid container spacing={2}>
        <Grid item><Tooltip title="The orientation of the material display window">
          <Typography id="orientation-buttons" gutterBottom>Orientation</Typography>
        </Tooltip></Grid>
        <Tooltip title="Landscape"><Grid item><CropLandscape color="primary" /></Grid></Tooltip>
        <Grid item>
          <Switch color="primary" checked={value} onChange={onChange} name="checkedC" />
        </Grid>
        <Tooltip title="Portrait"><Grid item><CropPortrait color="primary" /></Grid></Tooltip>
      </Grid> */}
    </div>
  );
}

export default OrientationControl;
