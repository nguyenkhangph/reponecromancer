var request = require('request');

var ORACLE = process.env.ORACLE_URL || 'https://api.quotable.io/random';

exports.random = function (cb) {
  request({ uri: ORACLE, json: true, timeout: 3000 }, function (err, res, body) {
    if (err || res.statusCode !== 200) {
      return cb(err || new Error('oracle returned ' + res.statusCode));
    }
    cb(null, body.content);
  });
};
