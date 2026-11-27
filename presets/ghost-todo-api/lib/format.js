var moment = require('moment');

/**
 * Human friendly uptime.
 * @example format.duration(0) // => '0s'
 * @example format.duration(61000) // => '1m 1s'
 * @example format.duration(3723000) // => '1h 2m 3s'
 */
exports.duration = function (ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var parts = [];
  if (h) { parts.push(h + 'h'); }
  if (h || m) { parts.push(m + 'm'); }
  parts.push((s % 60) + 's');
  return parts.join(' ');
};

/**
 * Short spooky tag for a todo id.
 * @example format.tag('a1b2c3d4-0000-4000-8000-000000000000') // => 'GHOST-A1B2'
 */
exports.tag = function (id) {
  return 'GHOST-' + String(id).slice(0, 4).toUpperCase();
};

/**
 * Serialise a todo for the wire.
 * @example format.todo({ id: 'beef', title: 'boo', createdAt: '2014-10-31T00:00:00.000Z', done: false }).tag // => 'GHOST-BEEF'
 * @example format.todo({ id: 'beef', title: 'boo', createdAt: '2014-10-31T00:00:00.000Z', done: true }).title // => 'boo'
 */
exports.todo = function (todo) {
  return {
    id: todo.id,
    tag: exports.tag(todo.id),
    title: todo.title,
    done: todo.done,
    created: moment(todo.createdAt).fromNow()
  };
};
