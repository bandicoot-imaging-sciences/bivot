import React from 'react';
import PopupColorControl from './PopupColorControl';

function BackgroundColorControl({ value, onChange }) {
  const label = 'Background color';
  const description = 'The color of the render background';
  return PopupColorControl({ label, description, value, onChange});
}

export default BackgroundColorControl;
