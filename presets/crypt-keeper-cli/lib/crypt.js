var fs = require('fs');
var os = require('os');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var leftPad = require('left-pad');

GLOBAL.CRYPT_VERSION = '0.2.0';

function xor(buf, key) {
  var k = new Buffer(key);
  var out = new Buffer(buf.length);
  for (var i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ k[i % k.length];
  }
  return out;
}

/**
 * Seal text with a key (xor + base64).
 * @example seal('boo', 'k') // => 'CQQE'
 * @example seal('', 'raven') // => ''
 */
exports.seal = function (text, key) {
  return xor(new Buffer(text, 'utf8'), key).toString('base64');
};

/**
 * Open a sealed text.
 * @example unseal('CQQE', 'k') // => 'boo'
 * @example unseal(seal('the raven', 'nevermore'), 'nevermore') // => 'the raven'
 */
exports.unseal = function (sealed, key) {
  return xor(new Buffer(sealed, 'base64'), key).toString('utf8');
};

/**
 * Engrave a centred tombstone line.
 * @example tombstone('RIP', 9) // => '   RIP'
 * @example tombstone('BOO', 3) // => 'BOO'
 * @example tombstone(7, 4, 0) // => '0007'
 */
exports.tombstone = function (name, width, ch) {
  if (ch !== undefined) {
    return leftPad(name, width, ch);
  }
  var pad = Math.floor((width - String(name).length) / 2) + String(name).length;
  return leftPad(name, pad);
};

/**
 * Where the crypt lives on disk.
 * @example cryptDir().indexOf('crypt-keeper') > -1 // => true
 */
exports.cryptDir = function () {
  return path.join(os.tmpDir(), 'crypt-keeper');
};

exports.bury = function (name, text, key) {
  var dir = exports.cryptDir();
  mkdirp.sync(dir);
  var file = path.join(dir, name + '.crypt');
  fs.writeFileSync(file, exports.seal(text, key));
  return file;
};

exports.exhume = function (name, key) {
  var file = path.join(exports.cryptDir(), name + '.crypt');
  return exports.unseal(fs.readFileSync(file, 'utf8'), key);
};

exports.purge = function () {
  rimraf.sync(exports.cryptDir());
};

exports.version = function () {
  return GLOBAL.CRYPT_VERSION;
};
