#!/usr/bin/env node
var util = require('util');
var argv = require('optimist').argv;
var crypt = require('../lib/crypt');

var cmd = argv._[0];

if (cmd === 'seal') {
  var file = crypt.bury(argv._[1], argv._.slice(2).join(' '), argv.key || 'raven');
  util.puts('sealed into ' + file);
} else if (cmd === 'open') {
  util.puts(crypt.exhume(argv._[1], argv.key || 'raven'));
} else if (cmd === 'purge') {
  crypt.purge();
  util.puts('the crypt is empty');
} else {
  util.print(crypt.tombstone('CRYPT KEEPER', 24), '\n');
  util.print('usage: crypt <seal|open|purge> <name> [text] [--key secret]', '\n');
}
