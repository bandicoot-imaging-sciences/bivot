import React from 'react';
import PopupColorControl from './PopupColorControl';

function LightColorControl({ value, onChange }) {
  const label = 'Lighting color';
  const description = 'The color of the light source';
  return PopupColorControl({ label, description, value, onChange});
}

export default LightColorControl;
