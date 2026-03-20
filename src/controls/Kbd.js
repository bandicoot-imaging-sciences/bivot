import React from 'react';
import { Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  kbd: {
    fontFamily: 'monospace',
    fontSize: 'xs',
    borderColor: theme.palette.secondary.main,
    borderStyle: 'solid',
    borderWidth: '1px',
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.accent.light,
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
    borderRadius: '0.2em',
  },
}));

function Kbd({ ...props }) {
  const classes = useStyles();

  return (
    <Typography
      component='kbd'
      className={classes.kbd}
      {...props}
    >
      {props.children}
    </Typography>
  );
}

export default Kbd;
