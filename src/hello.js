
function sayHello(to) {
  return _.template("Hello, <%= name %>!")({name: to});
}


function anonymous(s, l
                   /**/) {
  var v0, v1, v2;
  if (l && ('aKey' in l)) {
    v1 = (l).aKey;
  }
  if (!(l && ('aKey' in l)) && s) {
    v1 = (s).aKey;
  }
  if (l && ('anotherKey' in l)) {
    v2 = (l).anotherKey;
  }
  if (!(l && ('anotherKey' in l)) && s) {
    v2 = (s).anotherKey;
  }
  if (v1) {
    v0 = (v1)[v2];
  }
  return v0;
}

var x = {
  "type": "CallExpression",
  "callee": {"type": "Identifier", "name": "aFunction"},
  "args": {"type": "Identifier", "name": "n"}
}
