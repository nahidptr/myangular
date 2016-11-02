'use strict';

function nodeName(element) {
  return element.nodeName ? element.nodeName: element[0].nodeName;
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


  this.$get = function ($injector) {

    function compile($compileNodes) {
      return compileNodes($compileNodes);
    }

    function compileNodes($compileNodes) {
      _.forEach($compileNodes, function (node) {
        var directives = collectDirectives(node);
        var terminal = applyDirectivesToNode(directives, node);
        if(!terminal &&node.childNodes && node.childNodes.length) {
          compileNodes(node.childNodes);
        }
      });
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

    function collectDirectives(node) {

      var directives = [];

      if(node.nodeType === Node.ELEMENT_NODE) {
        //! directive in element
        var normalizeNodeName = directiveNormalize(nodeName(node).toLowerCase());
        addDirective(directives, normalizeNodeName, 'E');

        //! directive in attributes
        _.forEach(node.attributes, function (attr) {

          var name = attr.name;
          var normalizedAttrName = directiveNormalize(name.toLowerCase());
          if(/^ngAttr[A-Z]/.test(normalizedAttrName)) {
            name = _.kebabCase(
            normalizedAttrName[6].toLowerCase() + //! since it will be uppercase
              normalizedAttrName.substring(7)
            );
          }

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

        });

        //! directive in Class
        _.forEach(node.classList, function (cls) {
          var normalizedClassName = directiveNormalize(cls);
          addDirective(directives, normalizedClassName, 'C');
        });

      } else if(node.nodeType === Node.COMMENT_NODE) {
        //! directive in comments
        var match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
        if(match) {
          addDirective(directives, directiveNormalize(match[1]), 'M');
        }
      }

      directives.sort(byPriority);

      return directives;
    }

    function addDirective(directives, name, mode, attrStartName, attrEndName) {
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

        });

      }
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

    /*--------- End collectDirectives helper ---------------*/



    function applyDirectivesToNode(directives, compiledNode) {
      var $compileNode = $(compiledNode);
      var terminalPriority  = -Number.MAX_VALUE;
      var terminal = false;
      _.forEach(directives, function (directive) {

        if(directive.$$start) {
          $compileNode = groupScan(compiledNode, directive.$$start, directive.$$end);
        }
        if(directive.priority < terminalPriority) {
          return false;
        }
        if(directive.compile) {
          directive.compile($compileNode);
        }
        if(directive.terminal) {
          terminal = true;
          terminalPriority = directive.priority;
        }
      });
      return terminal;
    }

    return compile;
  }
}

$CompileProvider.$inject = ['$provide'];
