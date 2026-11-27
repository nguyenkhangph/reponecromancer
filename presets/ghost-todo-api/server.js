var util = require('util');
var app = require('./app');

var port = process.env.PORT || 3000;

app.listen(port);
util.puts('Ghost Todo API haunting port ' + port);
