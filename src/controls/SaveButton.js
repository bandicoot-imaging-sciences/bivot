import React from 'react';
import { Tooltip, Button } from '@material-ui/core';
import Kbd from './Kbd';

function SaveButton({ onChange }) {
  return (
    <Tooltip title={<>Save the current display settings <Kbd>Alt</Kbd> + <Kbd>S</Kbd></>}>
      <Button
        id="saveButton"
        variant="contained"
        color="primary"
        disableElevation={true}
        onClick={() => {onChange()}}
      >
        Save
      </Button>
    </Tooltip>
  );
}

export default SaveButton;
