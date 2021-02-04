import React from 'react';
import { Grid, Typography, ButtonGroup, Button, Tooltip } from '@material-ui/core';
import { CropLandscape, CropSquare, CropPortrait, LocalMall } from '@material-ui/icons';

function AspectControl({ value, onChange }) {
  return (
    <div>
      <Grid container spacing={2}>
        <Grid item><Tooltip title="The aspect ratio of the material display window">
          <Typography id="aspect-buttons" gutterBottom>Aspect</Typography>
        </Tooltip></Grid>
        <Grid item xs>
          <ButtonGroup variant="contained" color="primary">
            <Tooltip title="Landscape"><Button onClick={() => {onChange(-1)}}><CropLandscape /></Button></Tooltip>
            <Tooltip title="Square"><Button onClick={() => {onChange(0)}}><CropSquare /></Button></Tooltip>
            <Tooltip title="Portrait"><Button onClick={() => {onChange(1)}}><CropPortrait /></Button></Tooltip>
            <Tooltip title="Portrait (retail)"><Button onClick={() => {onChange(2)}}><LocalMall /></Button></Tooltip>
          </ButtonGroup>
        </Grid>
      </Grid>
    </div>
  );
}

export default AspectControl;
