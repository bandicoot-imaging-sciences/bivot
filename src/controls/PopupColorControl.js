import React, { useState, useEffect } from 'react';
import { Grid, Typography, Tooltip, Button, Popover } from '@material-ui/core';
// react-color's CJS build sets both __esModule and exports.default, which webpack/Babel
// interop unwraps to (making a plain default import resolve to the ChromePicker component
// itself rather than the module namespace) but Node's native ESM/CJS interop does not (a
// default import there is always the whole module.exports object). A plain named import
// avoids the default-unwrapping mismatch in bundlers, but Node's static cjs-module-lexer
// analysis fails to detect ChromePicker there, since react-color defines it via an
// Object.defineProperty getter rather than a plain assignment. Importing the namespace and
// falling back to .default.ChromePicker covers both cases at runtime.
import * as ReactColor from 'react-color';
const ChromePicker = ReactColor.ChromePicker || ReactColor.default.ChromePicker;

import { colStringToObj } from '../utils/colorLib';

function PopupColorControl({ label, description, value, onChange }) {
  const [showPopup, setShowPopup] = useState(false);
  const [color, setColor] = useState(colStringToObj(value));
  const [anchorEl, setAnchorEl] = useState(null);

  // Update swatch colour if value property updates
  useEffect(() => {
    setColor(colStringToObj(value));
  }, [value]);

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
