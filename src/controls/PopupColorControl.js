import React, { useState } from 'react';
import { Grid, Typography, Tooltip, Button, Popover } from '@material-ui/core';
import { ChromePicker } from 'react-color';

import { colStringToObj } from '../utils/colorLib';

function PopupColorControl({ label, description, value, onChange }) {
  const [showPopup, setShowPopup] = useState(false);
  const [color, setColor] = useState(colStringToObj(value));
  const [anchorEl, setAnchorEl] = useState(null);

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
    setShowPopup(!showPopup);
  }

  function handleClose() {
    setAnchorEl(null);
    setShowPopup(false);
  }

  function handleChange(v) {
    setColor(v.rgb);
    onChange(v);
  }

  const swatch = {
    width: '50px',
    height: '20px',
    borderRadius: '0px',
    backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, 255)`,
  };
  const button = {
    backgroundColor: '#efefef'
  };
  const popover = {
    position: 'absolute',
    zIndex: '2',
  }
  const cover = {
    position: 'fixed',
    top: '0px',
    right: '0px',
    bottom: '0px',
    left: '0px',
  }

  return (
    <Grid container spacing={2}>
      <Grid item><Tooltip title={description}>
        <Typography id="light-color-control" gutterBottom>{label}</Typography>
      </Tooltip></Grid>
      <Grid item xs>
        <div style={{ position: `relative` }}>
          <Button variant='outlined' onClick={handleClick} style={button}>
            <div style={swatch} />
          </Button>
          <Popover
            open={showPopup}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          >
            <ChromePicker
              disableAlpha={true}
              color={value}
              onChange={handleChange}
            />
          </Popover>
        </div>
      </Grid>
    </Grid>
  );
}

export default PopupColorControl;
