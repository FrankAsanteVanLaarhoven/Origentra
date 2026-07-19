/**
 * Radix-2 iterative Cooley-Tukey FFT (in-place), zero dependencies.
 *
 * Used by the acoustic fingerprint. Input length must be a power of two.
 * Operates on separate real/imag Float64Arrays.
 */

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new RangeError('fft: length must be a power of two and re/im equal length');
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const xr = re[i + k + half]!;
        const xi = im[i + k + half]!;
        const vr = xr * cr - xi * ci;
        const vi = xr * ci + xi * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Magnitude spectrum (bins 0..n/2) of a real signal frame. */
export function magnitudeSpectrum(frame: Float64Array): Float64Array {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  fft(re, im);
  const out = new Float64Array((n >> 1) + 1);
  for (let i = 0; i < out.length; i++) out[i] = Math.hypot(re[i]!, im[i]!);
  return out;
}
