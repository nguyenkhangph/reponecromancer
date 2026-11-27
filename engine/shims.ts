export const REQUEST_SHIM_PATH = "necro-compat/request.js";

/**
 * Drop-in replacement for the subset of the deprecated `request` API that
 * legacy code typically uses, implemented on Node's native fetch().
 */
export const REQUEST_SHIM = `'use strict';
// RepoNecromancer compat shim — the deprecated \`request\` callback API on top of
// native fetch() (Node 18+). Supports: request(url|opts, cb), request.get/post/
// put/patch/delete/head, { json, qs, form, headers, body, method, timeout }.

function normalize(uri, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  var opts = typeof uri === 'object' && uri !== null ? Object.assign({}, uri) : Object.assign({}, options, { uri: uri });
  if (!opts.uri && opts.url) {
    opts.uri = opts.url;
  }
  return { opts: opts, callback: callback };
}

function send(opts, callback) {
  var method = String(opts.method || 'GET').toUpperCase();
  var headers = Object.assign({}, opts.headers);
  var body = opts.body;
  if (opts.json && body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body);
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
  }
  if (opts.form) {
    body = new URLSearchParams(opts.form).toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  if (opts.json && !headers.accept) {
    headers.accept = 'application/json';
  }
  var url = new URL(String(opts.uri));
  if (opts.qs) {
    Object.keys(opts.qs).forEach(function (k) { url.searchParams.set(k, String(opts.qs[k])); });
  }
  var init = { method: method, headers: headers, body: method === 'GET' || method === 'HEAD' ? undefined : body };
  if (opts.timeout) {
    init.signal = AbortSignal.timeout(opts.timeout);
  }

  var promise = fetch(url, init).then(function (res) {
    return res.text().then(function (text) {
      var parsed = text;
      if (opts.json) {
        try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
      }
      var headersObj = {};
      res.headers.forEach(function (v, k) { headersObj[k] = v; });
      return { statusCode: res.status, statusMessage: res.statusText, headers: headersObj, body: parsed };
    });
  });
  if (typeof callback === 'function') {
    promise.then(function (r) { callback(null, r, r.body); }, function (err) { callback(err); });
  }
  return promise;
}

function request(uri, options, callback) {
  var n = normalize(uri, options, callback);
  return send(n.opts, n.callback);
}

['get', 'post', 'put', 'patch', 'head', 'delete'].forEach(function (m) {
  request[m] = function (uri, options, callback) {
    var n = normalize(uri, options, callback);
    n.opts.method = m;
    return send(n.opts, n.callback);
  };
});
request.del = request.delete;

module.exports = request;
`;
