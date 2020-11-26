import React from 'react'
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';

import { Bivot } from '@bandicoot-imaging-sciences/bivot';


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
  }
};

// Example public material set
const materialSet = 'https://publish-dev.bandicootimaging.com.au/1512b6ee/biv_gallery/material-set.json';

function App(props) {
  const { classes, className, /* children, ...other */ } = props;
  return (
    <>
      <Container maxWidth='sm' className={clsx(classes.testStyle, className)}>
        <Box my={4}>
          <Typography variant='h4' component='h1' gutterBottom>
            Bivot React - example
          </Typography>
        </Box>
      </Container>
      <div style={{margin: '0.5em'}}>
        <Bivot
          materialSet={materialSet}
          id={1}
          // width='400'            // Override Shimmer width
          // height='200'           // Override Shimmer height
          // showEditor={true}      // Show the editor
        />
      </div>
    </>
  );
}

export default withStyles(styles)(App);
