var todos = [];

exports.all = function () {
  return todos.slice();
};

exports.get = function (id) {
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      return todos[i];
    }
  }
  return null;
};

exports.add = function (todo) {
  todos.push(todo);
  return todo;
};

exports.remove = function (id) {
  todos = todos.filter(function (t) { return t.id !== id; });
};
