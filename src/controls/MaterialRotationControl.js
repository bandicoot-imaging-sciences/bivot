import React from 'react';
import { Grid, Typography, ButtonGroup, Button, Tooltip } from '@material-ui/core';
import { RotateLeft, RotateRight, ArrowLeft, ArrowRight } from '@material-ui/icons';

const styles = {
  button: {
    width: '46px',
  },
  rotationDegrees: {
    marginTop: 0,
    marginBottom: 0,
  },
  rotationLabel: {
    marginBottom: 0,
  },
};

function MaterialRotationControl({ value, onChange }) {
  return (
    <Grid container spacing={2}>
      <Grid item>
        <Tooltip title="The rotation of the material">
          <Typography style={styles.rotationLabel} id="material-rotation-buttons" gutterBottom>Rotation</Typography>
        </Tooltip>
        <Typography style={styles.rotationDegrees} variant='caption'>{value}°</Typography>
      </Grid>
      <Grid item xs>
        <ButtonGroup variant="contained" aria-label="contained accent button group" disableElevation={true}>
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
          <Tooltip title="Nudge clockwise">
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
