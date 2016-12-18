'use strict';

const BOOLEAN_ATTRS = {
  multiple: true,
  selected: true,
  checked: true,
  disabled: true,
  readOnly: true,
  required: true,
  open:true
};

const BOOLEAN_ELEMENTS = {
  INPUT: true,
  SELECT: true,
  OPTION: true,
  TEXTAREA: true,
  BUTTON: true,
  FORM: true,
  DETAILS: true
};


function nodeName(element) {
  return element.nodeName ? element.nodeName: element[0].nodeName;
}

function parseIsolateBindings(scope) {

  var bindings = {};
  _.forEach(scope, (definition, scopeName) => {

    var match = definition.match(/\s*([@&]|=(\*?))(\??)\s*(\w*)\s*/);
    bindings[scopeName] = {
      mode: match[1][0],
      collection: match[2] === '*',
      optional: match[3],
      attrName: match[4] || scopeName
    };
  });
  return bindings;
}

function $CompileProvider($provide) {

  var hasDirective = {};

  this.directive = function (name, directiveFactory) {

    if(_.isString(name)) {

      if(name === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid directive name';
      }

      if(!hasDirective.hasOwnProperty(name)) {
        hasDirective[name] = [];

        //! addDirective where injector get is done name + 'Directive'
        $provide.factory(name + 'Directive', ['$injector', function ($injector) {
          var factories = hasDirective[name];
          return _.map(factories, function (factory, i) {
            //! doing this forEach because more than 1 directive can have same name
            var directive = $injector.invoke(factory);
            directive.restrict = directive.restrict || 'EA';
            directive.priority = directive.priority || 0;

            if(directive.link && !directive.compile) {
              directive.compile = _.constant(directive.link);
            }

            if(_.isObject(directive.scope)) {
              directive.$$isolateBindings = parseIsolateBindings(directive.scope);
            }
            directive.name = directive.name || name;
            directive.index = directive.index || i;
            return directive;
          });
        }]);

      }
      hasDirective[name].push(directiveFactory);
    } else {
      var self = this;
      _.forEach(name, function (directiveFactory, name) {
        self.directive(name, directiveFactory);
      });
    }

  };


  this.$get = function ($injector, $rootScope, $parse, $controller) {

    function Attributes(element) {
      this.$$element = element;
      this.$$attr = {};
    }

    Attributes.prototype.$set = function (key, value, writeAttr, attrName) {
      this[key] = value;  //! this is use to share across directives

      if(isBooleanAttribute(this.$$element[0], key)) {
        this.$$element.prop(key, value);
      }

      if(!attrName) {
        if(this.$$attr[key]) {
          attrName = this.$$attr[key];
        } else {
          attrName = this.$$attr[key] = _.kebabCase(key, '-');
        }
      } else {
        this.$$attr[key] = attrName;
      }

      if(writeAttr !== false) {
        this.$$element.attr(attrName, value);
      }

      if(this.$$observers) {
        _.forEach(this.$$observers[key], (observer) => {

          try {
            observer(value);
          } catch (e) {
            console.log(e);
          }
        });
      }

    };

    Attributes.prototype.$observe = function (key, fn) {
      var self = this;
      this.$$observers = this.$$observers || Object.create(null);
      this.$$observers[key] = this.$$observers[key] || [];
      this.$$observers[key].push(fn);
      $rootScope.$evalAsync(() => {
        fn(self[key]);
      });

      return function () {
        var index = self.$$observers[key].indexOf(fn);
        if(index >=0 ) {
          self.$$observers[key].splice(index, 1);
        }
      };
    };

    Attributes.prototype.$addClass = function (classVal) {
      this.$$element.addClass(classVal);
    };

    Attributes.prototype.$removeClass = function (classVal) {
      this.$$element.removeClass(classVal);
    };

    Attributes.prototype.$updateClass = function (newClassVal, oldClassVal) {
      var newClasses = newClassVal.split(/\s+/);
      var oldClasses = oldClassVal.split(/\s+/);
      var addedClaases = _.difference(newClasses, oldClasses);
      var removedClasses = _.difference(oldClasses, newClasses);
      if(addedClaases.length) {
        this.$addClass(addedClaases.join(' '));
      }
      if(removedClasses.length) {
        this.$removeClass(removedClasses.join(' '));
      }
    };

    /*----------- Compile Function --------------------*/

    function compile($compileNodes) {
      var compositeLinkFn = compileNodes($compileNodes);

      return function publicLinkFn(scope) {
        $compileNodes.data('$scope', scope);
        compositeLinkFn(scope, $compileNodes);
      };
    }

    function compileNodes($compileNodes) {

      var linksFns = [];

      //! for each node, can have multiple directive, with same attr shared
      _.forEach($compileNodes, function (node, i) {

        var attrs = new Attributes($(node));
        var directives = collectDirectives(node, attrs);
        var nodeLinkFn;

        if(directives.length) {
          nodeLinkFn = applyDirectivesToNode(directives, node, attrs);
        }

        var childLinkFn;
        if((!nodeLinkFn || !nodeLinkFn.terminal) && node.childNodes && node.childNodes.length) {
          childLinkFn = compileNodes(node.childNodes);
        }

        if(nodeLinkFn && nodeLinkFn.scope) {
          attrs.$addClass('ng-scope');
        }

        if(nodeLinkFn || childLinkFn) {
          linksFns.push({
            nodeLinkFn: nodeLinkFn,
            childLinkFn: childLinkFn,
            idx: i
          });
        }
      });

      //! note linkNodes is $compileNodes and idx
      var compositeLinkFn = function(scope, linkNodes) {

        var stableNodeList = [];
        _.forEach(linksFns, function (linkFn) {
          var nodeIdx = linkFn.idx;
          stableNodeList[nodeIdx] = linkNodes[nodeIdx];
        });

        _.forEach(linksFns, (linkFn) => {

          var node = stableNodeList[linkFn.idx];

          if(linkFn.nodeLinkFn) {   // consider <div><div my-directive></div></div>
            if(linkFn.nodeLinkFn.scope) {
              scope = scope.$new();
              $(node).data('$scope', scope);
            }
            linkFn.nodeLinkFn(linkFn.childLinkFn, scope, node);
          } else {
            linkFn.childLinkFn(scope, node.childNodes);  //its again compositeLinkFn
          }
        });
      };

      return compositeLinkFn;
    }

    /*--------- collectDirectives helper ---------------*/

    function directiveIsMultiElement(name) {
      if(hasDirective.hasOwnProperty(name)) {
        var directives = $injector.get(name + 'Directive');
        return _.some(directives, {multiElement:true});
      }
      return false;
    }

    function directiveNormalize(name) {
      var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;
      return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    function byPriority(a, b) {
      var diff = b.priority - a.priority;
      if(diff !== 0) {
        return diff;
      } else if (a.name !== b.name) {
        return (a.name < b.name ? -1: 1);
      } else {
        return a.index - b.index;
      }
    }

    function isBooleanAttribute(node, attrName) {
      return BOOLEAN_ATTRS[attrName] && BOOLEAN_ELEMENTS[node.nodeName];
    }

    function collectDirectives(node, attrs) {

      var directives = [];
      var match;

      if(node.nodeType === Node.ELEMENT_NODE) {
        //! directive in element
        var normalizeNodeName = directiveNormalize(nodeName(node).toLowerCase());
        addDirective(directives, normalizeNodeName, 'E');

        //! directive in attributes
        _.forEach(node.attributes, function (attr) {

          var name = attr.name;
          var normalizedAttrName = directiveNormalize(name.toLowerCase());
          var isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttrName);
          if(isNgAttr) {
            name = _.kebabCase(
            normalizedAttrName[6].toLowerCase() + //! since it will be uppercase
              normalizedAttrName.substring(7)
            );
            normalizedAttrName = directiveNormalize(name.toLowerCase());
          }
          attrs.$$attr[normalizedAttrName] = name;  // camelCase as key,snake-case as value

          // MultiNode
          var attrStartName, attrEndName;

          var directiveNName = normalizedAttrName.replace(/(Start|End)$/, '');
          if(directiveIsMultiElement(directiveNName)) {
            if(/Start$/.test(normalizedAttrName)) {
              attrStartName = name;
              attrEndName = name.substring(0, name.length - 5) + 'end';
              name = name.substring(0, name.length - 6);  // remove Start word
            }
          }

          normalizedAttrName = directiveNormalize(name.toLowerCase());

          addDirective(directives, normalizedAttrName, 'A', attrStartName, attrEndName);

          //! Setting attributes
          if(isNgAttr || !attrs.hasOwnProperty(normalizedAttrName)) {

            attrs[normalizedAttrName] = attr.value.trim();
            if(isBooleanAttribute(node, normalizedAttrName)) {
             attrs[normalizedAttrName] = true;  //! disabled , checked set to true
            }
          }

        });

        //! directive in Class
        var className = node.className;
        if(_.isString(className) && !_.isEmpty(className)) {
          while((match =/([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className))) {

            var normalizedClassName = directiveNormalize(match[1]);
            if(addDirective(directives, normalizedClassName, 'C')) {
              //! setting attributes
              attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
            }
            className = className.substr(match.index + match[0].length);
          }
        }

      } else if(node.nodeType === Node.COMMENT_NODE) {
        //! directive in comments
        var match = /^\s*directive\:\s*([\d\w\-_]+)\s*(.*)$/.exec(node.nodeValue);
        if(match) {
          var normalizedName = directiveNormalize(match[1]);
          if(addDirective(directives, normalizedName, 'M')) {
            attrs[normalizedName] = match[2] ? match[2].trim() : undefined;
          }
        }
      }

      directives.sort(byPriority);

      return directives;
    }

    function addDirective(directives, name, mode, attrStartName, attrEndName) {
      var match;
      if(hasDirective.hasOwnProperty(name)) {
        var foundDirectives = $injector.get(name + 'Directive');
        var applicableDirectives = _.filter(foundDirectives, function (dir) {
          return dir.restrict.indexOf(mode) !== -1;
        });

        _.forEach(applicableDirectives, function (directive) {
          if(attrStartName) {
            directive = _.create(directive, {$$start: attrStartName, $$end: attrEndName});
          }
          directives.push(directive);
          match = directive;

        });

      }
      return match;
    }


    /*--------- End collectDirectives helper ---------------*/

    function applyDirectivesToNode(directives, compiledNode, attrs) {
      var $compileNode = $(compiledNode);
      var terminalPriority  = -Number.MAX_VALUE;
      var terminal = false;
      var preLinkFns = [], postLinkFns = [];

      var newScopeDirective, newIsolateScopeDirective;

      var controllerDirectives;

      var addLinkFns = function(preLinkFn, postLinkFn, attrStart, attrEnd, isolateScope) {
        if(preLinkFn) {
          if(attrStart) {
            preLinkFn = groupElementLinkFnWrapper(preLinkFn, attrStart, attrEnd);
          }
          preLinkFn.isolateScope = isolateScope;
          preLinkFns.push(preLinkFn);

        }
        if(postLinkFn) {
          if(attrStart) {
            postLinkFn = groupElementLinkFnWrapper(postLinkFn, attrStart, attrEnd);
          }
          postLinkFn.isolateScope = isolateScope;
          postLinkFns.push(postLinkFn);
        }
      };

      _.forEach(directives, function (directive) {

        if(directive.$$start) {
          //! group scan collects all nodes bw start and end
          $compileNode = groupScan(compiledNode, directive.$$start, directive.$$end);
        }
        if(directive.priority < terminalPriority) {
          return false;
        }

        if(directive.controller) {
          controllerDirectives = controllerDirectives || {};
          controllerDirectives[directive.name] = directive;
        }

        if(directive.scope) {
          if(_.isObject(directive.scope)) {
            if(newIsolateScopeDirective || newScopeDirective) {
              throw 'Multiple directives asking for new/inherited scope';
            }
            newIsolateScopeDirective = directive;
          } else {
            if(newIsolateScopeDirective) {
              throw 'Multiple directives asking for new/inherited scope';
            }
            newScopeDirective = newScopeDirective || directive; // (as boolean flag only) since we are just calling scope.$new in compositeLinkFn
          }
        }

        if(directive.compile) {
          var linkFn = directive.compile($compileNode, attrs);
          var isolateScope = (directive === newIsolateScopeDirective);
          var attrStart = directive.$$start;
          var attrEnd = directive.$$end;
          if(_.isFunction(linkFn)) {
            addLinkFns(null, linkFn, attrStart, attrEnd, isolateScope);
          } else if(linkFn) {
            addLinkFns(linkFn.pre, linkFn.post, attrStart, attrEnd, isolateScope);
          }
        }
        if(directive.terminal) {
          terminal = true;
          terminalPriority = directive.priority;
        }
      });

      //! can be multiple directive on a single node, here is only single node
      var nodeLinkFn = function(childLinkFn, scope, linkNode) {
        var $element = $(linkNode);

        if(controllerDirectives) {
          _.forEach(controllerDirectives, function (directive) {
            var controllerName = directive.controller;
            if(controllerName === '@') {
              controllerName = attrs[directive.name];
            }
            $controller(controllerName);
          });
        }
        var isolateScope;
        if(newIsolateScopeDirective) {
          isolateScope = scope.$new(true);
          $element.addClass('ng-isolate-scope');
          $element.data('$isolateScope', isolateScope);
          _.forEach(newIsolateScopeDirective.$$isolateBindings, function (definition, scopeName) {
            var attrName = definition.attrName;
            switch(definition.mode) {
              case '@':
                attrs.$observe(attrName, function (newAttrValue) {
                  isolateScope[scopeName] = newAttrValue;
                });
                if(attrs[attrName]) {
                  isolateScope[scopeName] = attrs[attrName];
                }
                break;
              case '=':
                if(definition.optional && !attrs[attrName]) {
                  break;
                }
                var parentGet = $parse(attrs[attrName]);
                var lastValue = isolateScope[scopeName] = parentGet(scope);

                var parentValueWatch = function () {  //! we are digesting from root scope
                  var parentValue = parentGet(scope);
                  if(isolateScope[scopeName] !== parentValue) {
                    if(parentValue !== lastValue) {
                      isolateScope[scopeName] = parentValue;
                    } else {
                      parentValue = isolateScope[scopeName];
                      parentGet.assign(scope, parentValue);
                    }
                  }

                  lastValue = parentValue;
                  return lastValue;
                };

                var unwatch;
                if(definition.collection) {
                  unwatch = scope.$watchCollection(attrs[attrName], parentValueWatch);
                } else {
                  unwatch = scope.$watch(parentValueWatch);
                }

                isolateScope.$on('$destroy', unwatch);
                break;
              case '&':
                var parentExpr = $parse(attrs[attrName]);
                if(parentExpr === _.noop && definition.optional) {
                  break;
                }
                isolateScope[scopeName] = function (locals) {
                  return parentExpr(scope, locals);
                };
                break;

            }
          });
        }

        _.forEach(preLinkFns, function (linkFn) {
          linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs);
        });

        if(childLinkFn) {  //! childLinkFn is compositeLinkFn
          childLinkFn(scope, linkNode.childNodes);
        }

        _.forEachRight(postLinkFns, function (linkFn) {
          linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs);
        });
      };

      nodeLinkFn.terminal = terminal;
      nodeLinkFn.scope = newScopeDirective && newScopeDirective.scope;
      return nodeLinkFn;
    }

    function groupScan(node, startAttr, endAttr) {
      var nodes = [];
      if(startAttr && node && node.hasAttribute(startAttr)) {
        var depth = 0;
        do {
          if(node.nodeType === Node.ELEMENT_NODE) {
            if(node.hasAttribute(startAttr)) {
              depth++;
            } else if(node.hasAttribute(endAttr)) {
              depth--;
            }
          }
          nodes.push(node);
          node = node.nextSibling;
        } while(depth>0);
      } else {
        nodes.push(node);
      }

      return nodes;
    }

    function groupElementLinkFnWrapper(linkFn, attrStart, attrEnd) {
      return function (scope, element, attrs) {
        var group = groupScan(element[0], attrStart, attrEnd);
        return linkFn(scope, group, attrs);
      }
    }

    return compile;
  };

}

$CompileProvider.$inject = ['$provide'];
