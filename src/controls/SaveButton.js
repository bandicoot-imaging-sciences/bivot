import React from 'react';
import { Grid, Tooltip, Button } from '@material-ui/core';

function SaveButton({ onChange }) {
  return (
    <Grid item>
      <Tooltip title="Save the current display settings">
        <Button
          variant="contained"
          color="primary"
          onClick={() => {onChange()}}
        >
          Save
        </Button>
      </Tooltip>
    </Grid>
  );
}

export default SaveButton;
