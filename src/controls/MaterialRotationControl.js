import React from 'react';
import { Grid, Typography, ButtonGroup, Button, Tooltip } from '@material-ui/core';
import { RotateLeft, RotateRight, ArrowLeft, ArrowRight } from '@material-ui/icons';

const styles = {
  button: {
    width: '46px',
  },
};

function MaterialRotationControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title="The rotation of the material">
        <Typography id="material-rotation-buttons" gutterBottom>Rotation</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          <Tooltip title="90 anti-clockwise">
            <Button style={styles.button} onClick={() => {onChange(90)}}>
              <RotateLeft />
            </Button>
          </Tooltip>
          <Tooltip title="90 clockwise">
            <Button style={styles.button} onClick={() => {onChange(-90)}}>
              <RotateRight />
            </Button>
          </Tooltip>
          <Tooltip title="Nudge anti-clockwise">
            <Button style={styles.button} onClick={() => {onChange(0.5)}}>
              <ArrowLeft />
            </Button>
          </Tooltip>
          <Tooltip title="Nudge anti-clockwise">
            <Button style={styles.button} onClick={() => {onChange(-0.5)}}>
              <ArrowRight />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Grid>
    </Grid>
  );
}

export default MaterialRotationControl;
