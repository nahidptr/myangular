/* jshint globalstrict: true */
/*jshint esversion: 6 */

'use strict';

function constantWatchDelegate(scope, listenerFn, valueEq, watchFn) {

  var unwatch = scope.$watch(function () {
    return watchFn(scope);
  }, function (newValue, oldValue, scope) {
    if(_.isFunction(listenerFn)) {
      listenerFn.apply(this, arguments);
    }
    unwatch();
  }, valueEq);
  return unwatch;
}

function oneTimeWatchDelegate(scope, listenerFn, valueEq, watchFn) {

  var lastValue;
  var unwatch = scope.$watch(function () {
    return watchFn(scope);
  }, function (newValue, oldValue, scope) {
    lastValue = newValue;
    if(_.isFunction(listenerFn)) {
      listenerFn.apply(this, arguments);
    }
    if(!_.isUndefined(newValue)) {
      scope.$$postDigest(function () {
        if(!_.isUndefined(lastValue)) {
          unwatch();
        }
      });
    }
  }, valueEq);
  return unwatch;
}

function oneTimeLiteralWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  function isAllDefined(val) {
    return !_.some(val, _.isUndefined);
  }

  var unwatch = scope.$watch(function () {
    return watchFn(scope);
  }, function (newValue, oldValue, scope) {
    if(_.isFunction(listenerFn)) {
      listenerFn.apply(this, arguments);
    }
    if(isAllDefined(newValue)) {
      scope.$$postDigest(function () {
        if(isAllDefined(newValue)) {
          unwatch();
        }
      });
    }
  }, valueEq);
  return unwatch;
}

function expressionInputDirtyCheck(newValue, oldValue) {
  return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' &&
    isNaN(newValue) && isNaN(oldValue));
}

function inputsWatchDelegate(scope, listenerFn, valueEq, watchFn) {

  var inputExpressions = watchFn.inputs;

  var oldValues = _.times(inputExpressions.length, _.constant(function(){}));
  var lastResult;

  return scope.$watch(function () {
    var changed = false;
    inputExpressions.forEach((inputExpr, i) => {
      var newValue = inputExpr(scope);
      if (changed || !expressionInputDirtyCheck(newValue, oldValues[i])) {
        changed = true;
        oldValues[i] = newValue;
      }
    });
    if (changed) {
      lastResult = watchFn(scope);
    }
    return lastResult;
  }, listenerFn, valueEq);
}

function parse(expr) {

  switch(typeof expr) {
    case 'string':
      var lexer = new Lexer();
      var parser = new Parser(lexer);
      var oneTime = false;
      if(expr.charAt(0) === ':' && expr.charAt(1) === ':') {
        oneTime = true;
        expr = expr.substring(2);
      }
      var parseFn = parser.parse(expr);

      if(parseFn.constant) {
        parseFn.$$watchDelegate = constantWatchDelegate;
      } else if(oneTime) {
        parseFn.$$watchDelegate = parseFn.literal ? oneTimeLiteralWatchDelegate :
                                                    oneTimeWatchDelegate;
      } else if(parseFn.inputs) {
        parseFn.$$watchDelegate = inputsWatchDelegate;
      }
      return parseFn;

    case 'function':
      return expr;

    default:
      return _.noop;
  }

}

function Lexer() {}

var OPERATORS = {
  '+': true,
  '-': true,
  '!': true,
  '*': true,
  '/': true,
  '%': true,
  '=': true,
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
  '&&': true,
  '||': true,
  '|': true,
};

Lexer.prototype.peek = function (n) {
  n = n || 1;
  return this.index + n< this.text.length ?
    this.text.charAt(this.index + n): false;
};

Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
};

Lexer.prototype.isNumber = function (ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.isIdent = function (ch) {
  return (ch >= 'a' && ch <='z') || (ch >= 'A' && ch <= 'Z') ||
      ch === '_' || ch == '$';
};

Lexer.prototype.isWhitespace = function (ch) {
  return ch === ' ' || ch === '\r' || ch === '\t' ||
      ch === '\n' || ch === '\v' || ch === '\u00A0';
};

Lexer.prototype.is = function (chs) {
  return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.lex = function (text) {
  // Tokenization will be done here
  this.text = text;
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];

  while(this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);
    if(this.isNumber(this.ch) ||
      (this.is('.') && this.isNumber(this.peek()))) {
      this.readNumber();
    } else if(this.is('\'"')) {
      this.readString(this.ch);
    } else if(this.is('[],{}:.()?;')) {
      this.tokens.push({
        text: this.ch
      });
      this.index++;
    } else if(this.isIdent(this.ch)) {
      this.readIdent();
    } else if(this.isWhitespace(this.ch)) {
      this.index++;
    } else {
      var ch = this.ch;
      var ch2 = this.ch + this.peek();
      var ch3 = this.ch + this.peek() + this.peek(2);
      var op = OPERATORS[ch];
      var op2 = OPERATORS[ch2];
      var op3 = OPERATORS[ch3];

      if (op || op2 || op3) {
        var token = op3 ? ch3: (op2 ? ch2: ch);
        this.tokens.push({text: token});
        this.index += token.length;
      } else {
        throw 'Unexpected next character: ' + this.ch;
      }
    }
  }
  return this.tokens;
};

Lexer.prototype.readNumber = function () {
  var number = '';
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index).toLowerCase();
    if(ch === '.' || this.isNumber(ch)) {
      number += ch;
    } else {
      var nextCh = this.peek();
      var prevCh = number.charAt(number.length - 1);
      if(ch === 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      } else if(this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)) {
        number += ch;
      } else if(this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
        throw "Invalid exponent";
      } else {
        break;
      }
    }
    this.index++;
  }
  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

const ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't':'\t', 'v':'\v',
                '\'': '\'', '"':'"'};

Lexer.prototype.readString = function (quote) {
  this.index++;
  var string = '';
  var rawString = quote;
  var escape = false;
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    rawString += ch;
    if (escape) {
      if (ch === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5);
        if(!hex.match(/[\da-f]{4}/i)) {
          throw 'Invalid unicode escape'
        }
        this.index += 4;
        string += String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }
      escape = false;
    } else if (ch === quote) {
      this.index++;
      this.tokens.push({
        text: rawString,
        value: string
      });
      return;
    } else if (ch === '\\') {
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }
  throw 'Unmatched quote';
};

Lexer.prototype.readIdent = function () {
  var text = '';
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if(this.isIdent(ch) || this.isNumber(ch)) {
      text += ch;
    } else {
      break;
    }
    this.index++;
  }
  var token = {text: text, identifier: true};
  this.tokens.push(token);
};
/* --------------------------------------------------------------*/

function AST(lexer) {
  this.lexer = lexer;
}

AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression';
AST.CallExpression = 'CallExpression';
AST.AssignmentExpression = 'AssignmentExpression';
AST.UnaryExpression ='UnaryExpression';
AST.BinaryExpression ='BinaryExpression';
AST.LogicalExpression = 'LogicalExpression';
AST.ConditionalExpression = 'ConditionalExpression';
AST.NGValueParameter = 'NGValueParameter';

AST.prototype.constants =
{
  'null':
  {type: AST.Literal, value:null},
  'true':
  {type: AST.Literal, value:true},
  'false':
  {type: AST.Literal, value:false},
  'this':
  {type: AST.ThisExpression}
};

AST.prototype.peek = function (e1, e2, e3, e4) {
  if(this.tokens.length > 0) {
    var text = this.tokens[0].text;
    if(text === e1 || text === e2 || text === e3 || text === e4 ||
      (!e1 && !e2 && !e3 && !e4) ) {
      return this.tokens[0];
    }
  }
};

AST.prototype.expect = function (e1, e2, e3, e4) {
  var token = this.peek(e1, e2, e3, e4);
  if(token) {
    return this.tokens.shift();
  }
};

AST.prototype.consume = function (e) {
  var token = this.expect(e);
  if(!token) {
    throw 'Unexpected. Expecting: ' + e;
  }
  return token;
};
//--

AST.prototype.constant = function () {
  return {type: AST.Literal, value: this.consume().value};
};

AST.prototype.identifier = function () {
  return {type: AST.Identifier, name: this.consume().text};
};

AST.prototype.arrayDeclaration = function () {
  var elements = [];
  if(!this.peek(']')) {
    do {
      if(this.peek(']')) {
        break;
      }
      elements.push(this.assignment());
    } while(this.expect(','));
  }
  this.consume(']');

  return {type: AST.ArrayExpression, elements: elements};
};

AST.prototype.object = function () {
  var properties = [];

  if (!this.peek('}')) {
    do {
      var property = {type: AST.Property};
      if(this.peek().identifier) {
        property.key = this.identifier();
      } else {
        property.key = this.constant();
      }
      this.consume(':');
      //property.value = this.primary();
      property.value = this.assignment();
      properties.push(property);

    } while (this.expect(','));
  }
  this.consume('}');
  return {type: AST.ObjectExpression, properties: properties};
};

AST.prototype.fn = function () {

  var args = [];

  if(!this.peek(')')) {
    do {
      args.push(this.assignment());
    } while(this.expect(','));
  }
  return args;
};

//--

AST.prototype.primary = function () {  // lookups, fn calls, method calls
  var primary;
  if(this.expect('(')) {
    primary = this.filter();
    this.consume(')');
  } else if(this.expect('[')) {
    primary =  this.arrayDeclaration();
  } else if (this.expect('{')) {
    primary =  this.object();
  } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    primary =  this.constants[this.consume().text];
  } else if (this.peek().identifier) {
    primary =  this.identifier();
  } else {
    primary = this.constant();
  }

  var next;

  while ((next = this.expect('.', '[', '('))) {
    if(next.text === '[') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.primary(),
        computed: true
      };
      this.consume(']');
    } else if(next.text === '.') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.identifier(),
        computed: false
      };
    } else if(next.text === '(') {
      primary = {
        type: AST.CallExpression,
        callee: primary,
        arguments: this.fn()
      };
      this.consume(')');
    }
  }

  return primary;
};

AST.prototype.unary = function () {
  var next;
  if(next = this.expect('+', '!', '-')) {
    return {
      type: AST.UnaryExpression,
      operator: next.text,
      argument: this.unary()
    }
  } else {
    return this.primary();
  }
};

AST.prototype.multiplicative = function () {
  var left = this.unary();
  var token;
  while((token=this.expect('*', '/', '%'))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.unary()
    };
  }
  return left;
};

AST.prototype.additive = function () {
  var left = this.multiplicative();
  var token;
  while((token = this.expect('+')) || (token = this.expect('-'))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.multiplicative()
    };
  }
  return left;
};

AST.prototype.relational = function () {
  var left = this.additive();
  var token ;
  while((token = this.expect('<', '>', '<=', '>='))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.additive()
    };
  }
  return left;
};

AST.prototype.equality = function () {
  var left = this.relational();
  var token ;
  while((token = this.expect('==', '!=', '===', '!=='))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.relational()
    };
  }
  return left;
};

AST.prototype.logicalAND = function () {
  var left = this.equality();
  var token;
  while((token = this.expect('&&'))) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.equality()
    };
  }
  return left;
};

AST.prototype.logicalOR = function () {
  var left = this.logicalAND();
  var token;
  while((token = this.expect('||'))) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.logicalAND()
    };
  }
  return left;
};

AST.prototype.ternary = function () {
  var test = this.logicalOR();
  if(this.expect('?')) {
    var consequent = this.assignment();
    if(this.consume(':')) {
      var alternate = this.assignment();
      return {
        type: AST.ConditionalExpression,
        test: test,
        consequent: consequent,
        alternate: alternate
      };
    }
  }
  return test;
};

AST.prototype.assignment = function () {
  var left = this.ternary();
  if(this.expect('=')) {
    var right = this.ternary();
    return {type: AST.AssignmentExpression, left:left, right:right};
  }
  return left;
};


AST.prototype.filter = function () {
  var left = this.assignment();
  while(this.expect('|')) {
    var args = [left];

    left = {
      type: AST.CallExpression,
      callee: this.identifier(),
      arguments: args,
      filter: true
    };

    while(this.expect(':')) {
      args.push(this.assignment());
    }

  }
  return left;
};

AST.prototype.program = function () {
  var body = [];
  while(true) {
    if(this.tokens.length) {
      body.push(this.filter());
    }
    if(!this.expect(';')) {
      //! if next thing is ;, then don't come here, parse again,
      //! refer my own parses several statements edge case
      return {type: AST.Program, body: body };
    }
  }
};


AST.prototype.ast = function (text) {
  this.tokens = this.lexer.lex(text);
  // AST building will be done here
  return this.program();
};

/*-----------------------------------------------------------------*/


function ensureSafeMemberName(name) {
  if(name === 'constructor' || name === '__proto__' || name  === '__defineGetter__' ||
      name === '__defineSetter__' || name === '__lookupGetter__' || name ==='__lookupSetter__') {
    throw 'Attempting to access a disallowed field in Angular expression!';
  }
}

function ensureSafeObject(obj) {
  if(obj) {
    if(obj.document && obj.location && obj.alert && obj.setInterval) {
      throw 'Referencing window in Angular expressions is disallowed!';
    } else if (obj.children && (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
      throw 'Referencing DOM nodes in Angular expression is disallowed!';
    } else if(obj.constructor === obj) {
      throw 'Referencing Function in Angular expression is disallowed!';
    } else if(obj.getOwnPropertyNames || obj.getOwnPropertyDescriptor) {
      throw 'Referencing Object in Angular expression is disallowed';
    }
  }
  return obj;
}

function ensureSafeFunction(obj) {

  const CALL = Function.prototype.call;
  const APPLY = Function.prototype.apply;
  const BIND = Function.prototype.bind;

  if(obj) {
    if(obj.constructor === obj) {
      throw 'Referencing Function in Angular expressions is disallowed!';
    } else if(obj === CALL || obj === APPLY || obj === BIND) {
      throw 'Referencing call, apply, or bind in Angular expressions ' + 'is disallowed!';
    }
  }
  return obj;
}

function ifDefined(value, defaultValue) {
  return typeof value === 'undefined' ? defaultValue: value;
}


function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

function isLiteral(ast) {
  //! for array and object in which their elements are not constants
  return ast.body.length === 0 ||
    ast.body.length === 1 && (
      ast.body[0].type === AST.Literal ||
      ast.body[0].type === AST.ArrayExpression ||
      ast.body[0].type === AST.ObjectExpression
    );
}

function markConstantAndWatchExpressions(ast) {
  var allConstants;
  var argsToWatch;

  switch (ast.type) {
    case AST.Program:
      allConstants = true;
      ast.body.forEach((expr) => {
        markConstantAndWatchExpressions(expr);
        allConstants = allConstants && expr.constant;
      });
      ast.constant = allConstants;
      break;

    case AST.Literal:
      ast.constant = true;
      ast.toWatch = [];
      break;

    case AST.Identifier:
      ast.constant = false;
      ast.toWatch = [ast];
      break;

    case AST.ArrayExpression:
      allConstants = true;
      argsToWatch = [];
      ast.elements.forEach(el => { markConstantAndWatchExpressions(el);
        allConstants = allConstants && el.constant;
        if(!el.constant) {
          argsToWatch.push.apply(argsToWatch, el.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;

    case AST.ObjectExpression:
      allConstants = true;
      argsToWatch = [];
      ast.properties.forEach(property => { markConstantAndWatchExpressions(property.value);
        allConstants = allConstants && property.value.constant;
        if(!property.value.constant) {
          argsToWatch.push.apply(argsToWatch, property.value.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;

    case AST.ThisExpression:
      ast.constant = false;
      ast.toWatch = [];
      break;

    case AST.MemberExpression:
      markConstantAndWatchExpressions(ast.object);
      if(ast.computed) {
        markConstantAndWatchExpressions(ast.property);
      }
      ast.constant = ast.object.constant && (!ast.computed || ast.property.constant);
      ast.toWatch = [ast];
      break;

    case AST.CallExpression:
      var stateless = ast.filter && !filter(ast.callee.name).$stateful;
      allConstants = stateless ? true: false;
      argsToWatch = [];

      ast.arguments.forEach( arg => {
        markConstantAndWatchExpressions(arg);
        allConstants = allConstants && arg.constant;
        if(!arg.constant) {
          argsToWatch.push.apply(argsToWatch, arg.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = stateless ? argsToWatch: [ast];
      break;

    case AST.AssignmentExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;

    case AST.UnaryExpression:
      markConstantAndWatchExpressions(ast.argument);
      ast.constant = ast.argument.constant;
      ast.toWatch = ast.argument.toWatch;
      break;

    case AST.BinaryExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = ast.left.toWatch.concat(ast.right.toWatch);
      break;

    case AST.LogicalExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;

    case AST.ConditionalExpression:
      markConstantAndWatchExpressions(ast.test);
      markConstantAndWatchExpressions(ast.consequent);
      markConstantAndWatchExpressions(ast.alternate);
      ast.constant = ast.test.constant && ast.consequent.constant && ast.alternate.constant;
      ast.toWatch = [ast];
      break;
  }
}

function getInputs(ast) {
  if(ast.length !== 1) {
    return [];
  }
  var candidate = ast[0].toWatch;
  if(candidate.length !== 1 || candidate[0] !== ast[0]) {
    return candidate;
  }
  return [];
}

function assignableAST(ast) {

  function isAssignable(ast) {
    return ast.type === AST.Identifier || ast.type === AST.MemberExpression;
  }

  if(ast.body.length===1 && isAssignable(ast.body[0])) {
    return {
      type: AST.AssignmentExpression, left: ast.body[0], right: {type:AST.NGValueParameter}
    };
  }
}

ASTCompiler.prototype.compile = function (text) {

  var ast = this.astBuilder.ast(text);
  var extra = '';
  markConstantAndWatchExpressions(ast);

  this.state = {nextId: 0,
                fn: {body: [], vars: []},
                assign: {body:[], vars:[]},
                filters: {}, inputs:[]
                };

  this.stage = 'inputs';  //! used to avoid local check for identifier
  getInputs(ast.body).forEach( (input, idx) =>{
    var inputKey = 'fn' + idx;
    this.state[inputKey] = {body:[], vars:[]};
    this.state.computing = inputKey;
    this.state[inputKey].body.push('return ' + this.recurse(input) + ';');
    this.state.inputs.push(inputKey);
  });

  this.stage = 'assign';
  var assignable = assignableAST(ast);
  if(assignable) {
    this.state.computing = 'assign';
    this.state.assign.body.push(this.recurse(assignable));
    extra = 'fn.assign = function(s,v,l){' + (this.state.assign.vars.length ? 'var ' + this.state.assign.vars.join(',') + ';' : '') +
        this.state.assign.body.join('') + '};';
  }

  this.stage = 'main';
  this.state.computing = 'fn';
  this.recurse(ast);

  var fnString = this.filterPrefix() +
        'var fn=function(s,l){' +
         (this.state.fn.vars.length ? 'var ' + this.state.fn.vars.join(',') + ';' : '') +
         this.state.fn.body.join('') +
         '}; ' +
          this.watchFns() +
          extra +
         'return fn;';

  var fn = new Function('ensureSafeMemberName', 'ensureSafeObject, ensureSafeFunction, ifDefined, filter', fnString)
            (ensureSafeMemberName, ensureSafeObject, ensureSafeFunction,
              ifDefined, filter);

  fn.literal = isLiteral(ast);
  fn.constant = ast.constant;
  return fn;
};

ASTCompiler.prototype.watchFns = function () {
  var result = [];
  this.state.inputs.forEach( (inputName) => {
    result.push('var ', inputName, '=function(s){',
      (this.state[inputName].vars.length ? 'var '+this.state[inputName].vars.join(',') + ';': ''),
      this.state[inputName].body.join(''), '};')
  });

  if(result.length) {
    result.push('fn.inputs = [', this.state.inputs.join(','), '];');
  }

  return result.join('');
};

ASTCompiler.prototype.nextId = function (skip) {
  var id = 'v' + (this.state.nextId++);
  if(!skip) {
    this.state[this.state.computing].vars.push(id);
  }
  return id;
};

ASTCompiler.prototype.addEnsureSafeMemberName = function (expr) {
  this.state[this.state.computing].body.push('ensureSafeMemberName(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeObject = function (expr) {
  this.state[this.state.computing].body.push('ensureSafeObject(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeFunction = function (expr) {
  this.state[this.state.computing].body.push('ensureSafeFunction(' + expr + ');');
};

ASTCompiler.prototype.ifDefined = function (value, defaultValue) {
  return 'ifDefined(' + value + ',' + this.escape(defaultValue) + ')';
};

ASTCompiler.prototype.nonComputedMember = function (left, right) {
  return '(' + left + ').' + right;
};

ASTCompiler.prototype.computedMember = function (left, right) {
  return '(' + left + ')[' + right + ']';
};

ASTCompiler.prototype.callFunction = function (obj, fn) {
  return obj + '.' + fn + '()';
};

ASTCompiler.prototype.if_ = function (test, consequent) {
  this.state[this.state.computing].body.push('if(', test, '){', consequent, '}');
};

ASTCompiler.prototype.not = function (e) {
  return '!(' + e + ')';
};

ASTCompiler.prototype.getHasOwnProperty = function(obj, prop) {
  return obj + ' && (' + this.escape(prop) + ' in ' + obj + ')';
};

ASTCompiler.prototype.assign = function (id, value) {
  return id + '=' + value + ';';
};

ASTCompiler.prototype.filterPrefix = function () {
  if(_.isEmpty(this.state.filters)) {
    return '';
  } else {
    var parts = _.map(this.state.filters,  (varName, filterName) => {
      return varName + '=' + 'filter(' + this.escape(filterName) + ')';
    });
    return 'var ' + parts.join(',') + ';'
  }
};

ASTCompiler.prototype.filter = function (name) {
  if(!this.state.filters.hasOwnProperty('name')) {
    this.state.filters[name] = this.nextId(true);
  }
  return this.state.filters[name];
};

ASTCompiler.prototype.recurse = function (ast, context, create) {

  var intoId;
  switch (ast.type) {

    case AST.Program:
      _.forEach(_.initial(ast.body), (stmt) => {
        this.state[this.state.computing].body.push(this.recurse(stmt), ';');
      });
      this.state[this.state.computing].body.push('return ', this.recurse(_.last(ast.body)), ';');
      break;

    case AST.Literal:
      return this.escape(ast.value);

    case AST.ArrayExpression:
      var elements = ast.elements.map(el => this.recurse(el));
      return '[' + elements.join(',') + ']';

    case AST.ObjectExpression:
      var properties = ast.properties.map(prop => {
        var key = prop.key.type === AST.Identifier ?
                                prop.key.name : this.escape(prop.key.value);
        var value = this.recurse(prop.value);
        return key + ':' + value;
      });
      return '{' + properties.join(',') + '}';

    case AST.Identifier:
      ensureSafeMemberName(ast.name);
      intoId = this.nextId();
      var localsCheck;
      if(this.stage === 'inputs') {
        localsCheck = 'false';
      } else {
        localsCheck = this.getHasOwnProperty('l', ast.name);
      }

      this.if_(localsCheck,
        this.assign(intoId, this.nonComputedMember('l', ast.name))
      );
      if(create) {
        this.if_(this.not(localsCheck) +
                 ' && s && ' + this.not(this.getHasOwnProperty('s', ast.name)),
                 this.assign(this.nonComputedMember('s', ast.name), '{}'));
      }

      this.if_(this.not(localsCheck) + ' && s',
        this.assign(intoId, this.nonComputedMember('s', ast.name))
      );

      if(context) {
        context.context  = localsCheck + '?l:s';
        context.name = ast.name;
        context.computed = false;
      }

      this.addEnsureSafeObject(intoId);
      return intoId;

    case AST.ThisExpression:
      return 's';

    case AST.MemberExpression:
      intoId = this.nextId();
      var left = this.recurse(ast.object, undefined, create);

      if(context) {
        context.context = left;
      }

      if(ast.computed) {
        var right = this.recurse(ast.property);
        this.addEnsureSafeMemberName(right);
        if(create) {
          this.if_(this.not(this.computedMember(left, right)), this.assign(this.computedMember(left, right), '{}'));
        }

        this.if_(left,
              this.assign(intoId, 'ensureSafeObject(' + this.computedMember(left, right) + ')'));
        if(context) {
          context.name = right;
          context.computed = true;
        }
      } else {
        // non computed
        ensureSafeMemberName(ast.property.name);
        if(create) {
          this.if_(this.not(this.nonComputedMember(left, ast.property.name)), this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
        }
        this.if_(left, this.assign(intoId,
              'ensureSafeObject(' + this.nonComputedMember(left, ast.property.name) + ')'));

        if(context) {
          context.name = ast.property.name;
          context.computed = false;
        }
      }
      return intoId;

    case AST.CallExpression:
      var callContext, callee, args;
      if(ast.filter) {
        callee = this.filter(ast.callee.name);
        args = ast.arguments.map(arg => this.recurse(arg));
        return callee + '(' + args + ')';
      } else {
        callContext = {};
        callee = this.recurse(ast.callee, callContext);
        args = ast.arguments.map(arg => 'ensureSafeObject(' + this.recurse(arg) + ')');

        if (callContext.name) {
          this.addEnsureSafeObject(callContext.context);
          if (callContext.computed) {
            callee = this.computedMember(callContext.context, callContext.name);
          } else {
            callee = this.nonComputedMember(callContext.context, callContext.name);
          }
        }

        this.addEnsureSafeFunction(callee);
        return callee + '&& ensureSafeObject(' + callee + '(' + args.join(',') + '))';
      }
      break;

    case AST.NGValueParameter:
      return 'v';

    case AST.AssignmentExpression:
      var leftContext = {};
      this.recurse(ast.left, leftContext, true);
      var leftExpr;
      if (leftContext.computed) {
        leftExpr = this.computedMember(leftContext.context, leftContext.name);

      } else {
        leftExpr = this.nonComputedMember(leftContext.context, leftContext.name);
      }
      return this.assign(leftExpr , 'ensureSafeObject(' + this.recurse(ast.right) + ')');

    case AST.UnaryExpression:
      return ast.operator + '(' + this.ifDefined( this.recurse(ast.argument), 0) + ')';

    case AST.BinaryExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) + ')' + ast.operator +
          '(' + this.ifDefined(this.recurse(ast.right), 0) + ')';

    case AST.LogicalExpression:
      intoId = this.nextId();
      this.state[this.state.computing].body.push(this.assign(intoId, this.recurse(ast.left)));
      this.if_(ast.operator==='&&' ? intoId : this.not(intoId), this.assign(intoId, this.recurse(ast.right)));
      return intoId;

    case AST.ConditionalExpression:
      intoId = this.nextId();
      var testId = this.nextId();
      this.state[this.state.computing].body.push(this.assign(testId, this.recurse(ast.test)));
      this.if_(testId, this.assign(intoId, this.recurse(ast.consequent)));
      this.if_(this.not(testId), this.assign(intoId, this.recurse(ast.alternate)));
      return intoId;
  }
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
ASTCompiler.prototype.stringEscapeFn = function (c) {
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};

ASTCompiler.prototype.escape = function (value) {
  if(_.isString(value)) {
    return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
  } else if (_.isNull(value)) {
    return 'null';
  } else {
    return value;
  }
};

function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function (text) {
  return this.astCompiler.compile(text);
};
