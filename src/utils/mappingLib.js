// Mapping from values in an input range to values in an output range,
// and vice versa.
export class Mapper {
  constructor(inMin, inMax, outMin, outMax, decimals=2) {
    this.inMin = inMin;
    this.outMin = outMin;
    this.factor = (inMax - inMin) / (outMax - outMin);
    this.decimals = decimals;
  }

  map(val) {
    const newVal = this.outMin + (val - this.inMin) / this.factor;
    return parseFloat(newVal.toFixed(this.decimals));
  }

  unmap(val) {
    return this.inMin + (val - this.outMin) * this.factor;
  }
}
