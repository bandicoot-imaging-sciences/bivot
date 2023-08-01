import React from 'react';
import { Grid, Tooltip, Button } from '@material-ui/core';

function ResetButton({ onChange }) {
  return (
    <Tooltip title="Reset to the originally loaded display settings">
      <Button
        id="resetButton"
        variant="outlined"
        onClick={() => {onChange()}}
      >
        Reset
      </Button>
    </Tooltip>
  );
}

export default ResetButton;
