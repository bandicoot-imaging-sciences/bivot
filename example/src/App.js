import React, { useState } from 'react'
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';

import { Bivot } from '@bandicoot/bivot';


const styles = {
  testStyle: {
    background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
    borderRadius: 3,
    border: 0,
    color: 'white',
    height: 48,
    padding: '0 30px',
    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
    textAlign: 'center',
  },
  widthStyle: {
    width: '100%',
  }
};

// Example public material set
const materialSet = 'https://publish.bandicootimaging.com.au/c12fe241/biv_gallery/material-set.json';

function App(props) {
  const { classes, className, /* children, ...other */ } = props;
  const [size, setSize] = useState([undefined, undefined]);
  const [responsive, setResponsive] = useState(false);

  function onSizeClick() {
    // Toggle size override
    if (size[0] && size[1]) {
      setSize([undefined, undefined]);
    } else {
      setSize([500, 300]);
    }
  }

  function onResponsiveClick() {
    // Toggle responsive mode
    if (responsive == undefined) {
      setResponsive(false);
    } else {
      setResponsive(undefined);
    }
  }

  return (
    <>
      <Container maxWidth='sm' className={clsx(classes.testStyle, className)}>
        <Box my={4}>
          <Typography variant='h4' component='h1' gutterBottom>
            Bivot React - example
          </Typography>
        </Box>
      </Container>
      <Box>
        <button onClick={onSizeClick}>
          Toggle size
        </button>
        <Typography>({size[0]}, {size[1]})</Typography>
      </Box>
      <Box>
        <button onClick={onResponsiveClick}>
          Toggle responsive
        </button>
        <Typography>{String(responsive)}</Typography>
      </Box>
      <Grid container maxWidth='sm'>
        {/* FIXME: Revert sizing experiments now that I found the fix in BivotReact.js */}
        <Grid item xs={12} style={{width: '100%'}}>
          <div style={{width: '100%'}}>
          <Bivot
            materialSet={materialSet}
            id={1}
            width={size[0]}           // Override Shimmer width
            height={size[1]}          // Override Shimmer height
            responsive={responsive}   // Override Shimmer responsive mode
            // showEditor={true}      // Show the editor
          />
          </div>
        </Grid>
      </Grid>
    </>
  );
}

export default withStyles(styles)(App);
