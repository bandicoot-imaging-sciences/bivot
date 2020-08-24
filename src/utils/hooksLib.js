import { useState, useEffect, useReducer } from 'react';

export function useWindowSize(callback) {
  const isClient = typeof window === 'object';

  function getSize() {
    return {
      width: isClient ? window.innerWidth : undefined,
      height: isClient ? window.innerHeight : undefined
    };
  }

  const [windowSize, setWindowSize] = useState(getSize);

  useEffect(() => {
    if (!isClient) {
      return false;
    }

    function handleResize() {
      setWindowSize(getSize());
      callback(getSize());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}


export function useScripts(scripts, whenLoaded) {
  const initialState = {count: 0};
  function reducer(state, action) {
    return {count: state.count + 1};
  }

  function loadScript(url, scriptLoaded) {
    const script = document.createElement('script');
    script.type = "text/javascript";
    script.async = false; // TODO - allow user of this hook to specify which scripts depend on which others, so some can be async
    script.src = url;
    script.onload = scriptLoaded;
    document.body.appendChild(script);
  }

  const [scriptsLoaded, incrementScriptsLoaded] = useReducer(reducer, initialState);

  useEffect(() => {
    if (scriptsLoaded.count == 0) {
      for (var i = 0; i < scripts.length; i++) {
        loadScript(scripts[i], incrementScriptsLoaded);
      }
    }
    if (scriptsLoaded.count == scripts.length) {
      whenLoaded();
    }
  }, [scriptsLoaded.count]);

  return () => {
    for (var i = 0; i < scripts.length; i++) {
      document.body.removeChild(scripts[i]);
    }
  }
}
