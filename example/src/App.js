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

// Example public material sets
//const ms1 = 'https://publish.bandicootimaging.com.au/c12fe241/biv_gallery/material-set.json';
const ms1 = 'https://publish.bandicootimaging.com.au/ad4b9775/biv_gallery/material-set.json';
const ms2 = 'https://publish.bandicootimaging.com.au/1e1e55a1/biv_gallery/material-set.json';

const rumpledMeshUrl = 'https://hosted.bandicootimaging.com.au/assets/mesh/rumple_rect_75k.obj';

function App(props) {
  const { classes, className, /* children, ...other */ } = props;
  const [size, setSize] = useState([200, 200]);
  const [mesh, setMesh] = useState(rumpledMeshUrl);
  const [showEditor, setShowEditor] = useState(true);
  const [fullScreen1, setFullScreen1] = useState(false);
  const [fullScreen2, setFullScreen2] = useState(false);

  function onSizeClick() {
    // Toggle size override
    if (size[0] && size[1]) {
      setSize([undefined, undefined]);
    } else {
      setSize([630, 200]);
    }
  }

  function onShowEditorClick() {
    // Toggle responsive mode
    setShowEditor(!showEditor);
  }

  function onMeshClick() {
    // Toggle mesh
    if (!mesh) {
      setMesh(rumpledMeshUrl);
    } else {
      setMesh(false);
    }
  }

  const meshList = {
    'Default': false,
    //'Draped cloth': 'https://hosted.bandicootimaging.com.au/assets/mesh/drape-sphere_inner-square_90k.obj',
    'Rumpled cloth': rumpledMeshUrl
  };

  async function onBivotClick() {
    console.log('Clicked on bivot');
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
      <Grid container style={{margin: '0.5em'}}>
        <Grid item>
          <button onClick={onShowEditorClick}>
            Toggle editor
          </button>
          <Typography>{String(showEditor)}</Typography>
        </Grid>
        <Grid item>
          <button onClick={onSizeClick}>
            Toggle size
          </button>
          <Typography>({size[0]}, {size[1]})</Typography>
        </Grid>
        <Grid item>
          <button onClick={onMeshClick}>
            Toggle mesh
          </button>
          <Typography>({mesh})</Typography>
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={3}><Typography>Responsive = false</Typography></Grid>
        <Grid item xs={9}>
          <button onClick={() => setFullScreen1(true)}>
            Full screen
          </button>
        </Grid>
        <Grid item xs={12} md={10} xl={8} style={{margin: '0.5em'}}>
          <Bivot
            materialSet={ms1}
            id={1}
            width={size[0]}
            height={size[1]}
            featured={true}
            responsive={false}
            objectMesh={mesh}
            showEditor={showEditor}
            showAdvancedControls={true}
            meshChoices={meshList}
            onClick={onBivotClick}
            fullScreen={fullScreen1}
            onExitFullScreen={() => setFullScreen1(false)}
          />
        </Grid>
        <Grid item xs={3}><Typography>Responsive = true</Typography></Grid>
        <Grid item xs={9}>
          <button onClick={() => setFullScreen2(true)}>
            Full screen
          </button>
        </Grid>
        <Grid item xs={12} md={10} xl={8} style={{margin: '0.5em'}}>
          <Bivot
            materialSet={ms2}
            id={2}
            width={size[0]}
            height={size[1]}
            responsive={true}
            objectMesh={mesh}
            showEditor={showEditor}
            showAdvancedControls={true}
            meshChoices={meshList}
            fullScreen={fullScreen2}
            onExitFullScreen={() => setFullScreen2(false)}
          />
        </Grid>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
        x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>x<br/>
      </Grid>
    </>
  );
}

export default withStyles(styles)(App);
