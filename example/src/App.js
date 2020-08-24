import React, { useState } from 'react'
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';

import { Bivot, useScripts, bivotScripts } from 'bivot-react'


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


function App(props) {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  useScripts(bivotScripts, () => setScriptsLoaded(true));

  const { classes, className, /* children, ...other */ } = props;
  return (
    <>
      <Container maxWidth="sm" className={clsx(classes.testStyle, className)}>
        <Box my={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            Bivot React - example
          </Typography>
        </Box>
      </Container>

      <Bivot
        width="350"
        height="200"
        scriptsLoaded={scriptsLoaded}
        showEditor={true}
        id={1}
        autoRotate={true}
        // config={config}
        // materials={materials}
        // s3Params={s3Params}
      />
      <Bivot
        width="700"
        height="400"
        scriptsLoaded={scriptsLoaded}
        showEditor={true}
        id={2}
        // config={config}
        // materials={materials}
        // s3Params={s3Params}
      />
    </>
  );
}

export default withStyles(styles)(App);
