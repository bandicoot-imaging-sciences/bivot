import { red } from '@material-ui/core/colors';
import { createTheme } from '@material-ui/core/styles';

// A custom theme for this app
const theme = createTheme({
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: '#19857b',
    },
    accent: {
      main: '#a9a5ab',
    },
    error: {
      main: red.A400,
    },
    background: {
      default: '#eef',
    },
  },
});

export default theme;
