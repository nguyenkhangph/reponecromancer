(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZombieTime = factory();
  }
}(this, function () {
  'use strict';

  /**
   * Split milliseconds into countdown parts.
   * @example parts(90061000) // => { days: 1, hours: 1, minutes: 1, seconds: 1 }
   * @example parts(-5) // => { days: 0, hours: 0, minutes: 0, seconds: 0 }
   */
  function parts(ms) {
    if (ms < 0) { ms = 0; }
    var s = Math.floor(ms / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60
    };
  }

  /**
   * Next Halloween (Oct 31, local midnight) on or after a date.
   * @example nextHalloween(new Date(2014, 0, 1)).getFullYear() // => 2014
   * @example nextHalloween(new Date(2014, 10, 1)).getFullYear() // => 2015
   */
  function nextHalloween(from) {
    var year = from.getFullYear();
    var target = new Date(year, 9, 31);
    if (from > target) { target = new Date(year + 1, 9, 31); }
    return target;
  }

  /**
   * Zero-pad a countdown unit.
   * @example pad(7) // => '07'
   * @example pad(13) // => '13'
   */
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  return { parts: parts, nextHalloween: nextHalloween, pad: pad };
}));
