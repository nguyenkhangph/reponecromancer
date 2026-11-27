var express = require('express');
var uuid = require('node-uuid');
var moment = require('moment');
var store = require('./lib/store');
var format = require('./lib/format');
var quotes = require('./lib/quotes');

var app = express();

app.configure(function () {
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

function auth(req, res, next) {
  var header = req.headers.authorization || '';
  var token = header.split(' ')[1] || '';
  var decoded = new Buffer(token, 'base64').toString();
  if (decoded !== 'ghost:boo') {
    return res.send(401, { error: 'the spirits do not know you' });
  }
  next();
}

app.get('/health', function (req, res) {
  res.json({ status: 'undead', uptime: format.duration(process.uptime() * 1000) });
});

app.get('/todos', function (req, res) {
  res.json(store.all().map(format.todo));
});

app.get('/todos/:id', function (req, res) {
  var todo = store.get(req.param('id'));
  if (!todo) {
    return res.send(404, { error: 'no such haunting' });
  }
  res.json(format.todo(todo));
});

app.post('/todos', auth, function (req, res) {
  var title = req.param('title');
  if (!title) {
    return res.send(400, { error: 'title required' });
  }
  var todo = store.add({
    id: uuid.v4(),
    title: title,
    createdAt: moment().toISOString(),
    done: false
  });
  res.json(201, format.todo(todo));
});

app.del('/todos/:id', auth, function (req, res) {
  store.remove(req.param('id'));
  res.send(204);
});

app.get('/quote', function (req, res) {
  quotes.random(function (err, quote) {
    if (err) {
      return res.send(502, { error: 'the oracle is silent' });
    }
    res.json({ quote: quote });
  });
});

module.exports = app;
