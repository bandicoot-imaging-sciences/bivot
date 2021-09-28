import React from 'react';
import { Grid, Tooltip, Button } from '@material-ui/core';

function SaveButton({ onChange }) {
  return (
    <Tooltip title="Save the current display settings">
      <Button
        id="saveButton"
        variant="contained"
        color="primary"
        onClick={() => {onChange()}}
      >
        Save
      </Button>
    </Tooltip>
  );
}

export default SaveButton;
