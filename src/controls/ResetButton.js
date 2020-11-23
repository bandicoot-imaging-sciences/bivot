import React from 'react';
import { Grid, Tooltip, Button } from '@material-ui/core';

function ResetButton({ onChange }) {
  return (
    <Grid item>
      <Tooltip title="Reset to the originally loaded display settings">
        <Button
          id="resetButton"
          variant="contained"
          onClick={() => {onChange()}}
        >
          Reset
        </Button>
      </Tooltip>
    </Grid>
  );
}

export default ResetButton;
