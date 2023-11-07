import React, { useState, useEffect } from 'react';
import { Grid, Typography, ButtonGroup, Button, Tooltip, Select, MenuItem, ThemeProvider } from '@material-ui/core';
import { CropLandscape, CropSquare, CropPortrait } from '@material-ui/icons';

const aspects = {
  landscape: [
    {size: [792, 528], desc: '3:2',     orig: true},
    {size: [792, 548], desc: '1.445:1', orig: true},
  ],
  square: [
    {size: [650, 650], desc: '1:1',     orig: true},
  ],
  portrait: [
    {size: [540, 810], desc: '2:3',     orig: true},
    {size: [634, 811], desc: '1:1.279', orig: true},
  ],
}

const styles = {
  select: {
    width: '165px',
  },
 };

function AspectControl({ value, onChange }) {
  const [size, setSize] = useState(value);
  const [mode, setMode] = useState(modeFromSize(value));
  const [dropdown, setDropdown] = useState(<div></div>);

  useEffect(() => {
    setSize(value);
    setMode(modeFromSize(value));
  }, [value]);

  useEffect(() => {
    if (size && size[0] && size[1]) {
      const mode = modeFromSize(size);
      var exists = false;
      const d = aspects[mode];
      for (var i = 0; i < d.length; i++) {
        if (d[i].size[0] == size[0] && d[i].size[1] == size[1]) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        // Add an encountered non-original size to the aspect ratio drop-down
        var first = '1';
        var second = '1';
        if (size[0] > size[1]) {
          first = parseFloat((size[0] / size[1]).toFixed(3));
        } else {
          second = parseFloat((size[1] / size[0]).toFixed(3));
        }
        const entry = {
          size,
          desc: `${first}:${second}`,
          orig: false
        }
        if (!aspects[mode][0].orig) {
          // Remove any previous non-original sizes from the drop-down
          aspects[mode].shift();
        }
        aspects[mode].unshift(entry);
      }
    }

    // Update the Select menu code.  Stringifying the value avoids timing issues
    setDropdown(
      <Select
        style={styles.select}
        value={String(size)}
        onChange={onSelect}
      >
        {aspects[mode].map((item, i) => (
          <MenuItem value={String(item.size)} key={i}>
            {item.desc + ' [' + item.size[0] + ' x ' + item.size[1] + ']'}
          </MenuItem>
        ))}
      </Select>
    );
  }, [size]);

  function modeFromSize(size) {
    if (size[0] > size[1]) {
      return 'landscape';
    } else if (size[1] > size[0]) {
      return 'portrait';
    } else {
      return 'square';
    }
  }

  async function onClick(newMode) {
    if (mode != newMode) {
      const newSize = aspects[newMode][0].size;
      setMode(newMode);
      setSize(newSize);
      onChange(newSize);
    }
  }

  async function onSelect(event) {
    strVal = event.target.value;
    arrVal = strVal.split(',').map(item => Number(item));
    setSize(arrVal);
    onChange(arrVal);
  }

  return (
    <div>
      <Grid container spacing={2}>
        <Grid item><Tooltip title="The aspect ratio of the material display window">
          <Typography id="aspect-buttons" gutterBottom>Aspect ratio</Typography>
        </Tooltip></Grid>
        <Grid item xs>
          <Grid container>
            <Grid item xs={12}>
              <ButtonGroup variant='contained' disableElevation={true}>
                <Tooltip title='Landscape'>
                  <Button
                    id='LandscapeButton'
                    style={styles.button}
                    onClick={() => {onClick('landscape')}}
                    variant={mode == 'landscape' ? 'contained' : 'outlined'}
                    >
                    <CropLandscape />
                  </Button>
                </Tooltip>
                <Tooltip title='Square'>
                  <Button
                    id='SquareButton'
                    style={styles.button}
                    onClick={() => {onClick('square')}}
                    variant={mode == 'square' ? 'contained' : 'outlined'}
                    >
                    <CropSquare />
                  </Button>
                </Tooltip>
                <Tooltip title='Portrait'>
                  <Button
                    id='PortraitButton'
                    style={styles.button}
                    onClick={() => {onClick('portrait')}}
                    variant={mode == 'portrait' ? 'contained' : 'outlined'}
                  >
                    <CropPortrait />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </Grid>
            <Grid item xs={12}>
              {dropdown}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </div>
  );
}

export default AspectControl;
