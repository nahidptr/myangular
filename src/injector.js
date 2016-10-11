'use strict';


function createInjector(modulesToLoad, strictDi) {

  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
  var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
  var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;
  var INSTANTIATING = {};

  var instanceCache = {};
  var providerCache = {};
  var loadedModules = {};
  var path = [];
  strictDi = (strictDi === true);

  var $provide = {
    constant: function (key, value) {
      if (key === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid constant name!';
      }
      instanceCache[key] = value;
    },
    provider: function (key, provider) {
      if(_.isFunction(provider)) {
        //! for ctor fn, dependencies must be resolved b4 hand
        //! since instantiate calls invoke, which calls getService and it won't have the current provider dependencies in cache,
        //! since its called for the 1st time without storing data in provider cache
        provider = instantiate(provider);
      }
      providerCache[key + 'Provider'] = provider;
    }
  };

  function getService(name) {
    if(instanceCache.hasOwnProperty(name)) {
      if(instanceCache[name] === INSTANTIATING) {
        throw 'Circular dependency found: ' + name + ' <- ' + path.join(' <- ');
      }
      return instanceCache[name];
    } else if(providerCache.hasOwnProperty(name + 'Provider')) {
      instanceCache[name] = INSTANTIATING;
      path.unshift(name);
      try {
        var provider = providerCache[name + 'Provider'];
        var instance = instanceCache[name] = invoke(provider.$get, provider);
        return instance;
      } finally  {
        path.shift();
        //! finally is always called even if instanceCache is valid for that key
        //! but the if block prevents it from being deleted.
        if(instanceCache[name] === INSTANTIATING) {
          delete instanceCache[name];
        }
      }

    }
  }

  function invoke(fn, self, locals) {
    var args =  _.map(annotate(fn), token => {
      if (_.isString(token)) {
        return locals && locals.hasOwnProperty(token) ? locals[token] : getService(token);
      } else {
        throw 'Incorrect injection token! Expected a string, got ';
      }
    });
    if(_.isArray(fn)) {
      fn = _.last(fn);
    }
    return fn.apply(self, args);
  }

  function annotate(fn) {
    if (_.isArray(fn)) {
      return fn.slice(0, fn.length - 1);
    } else if(fn.$inject){
      return fn.$inject;
    } else if(!fn.length) {
      return [];
    } else {
      if(strictDi) {
        throw 'fn is not using explicit annotation and cannot be invoked in strict mode';
      }
      var source = fn.toString().replace(STRIP_COMMENTS, '');
      var argDeclaration = source.match(FN_ARGS);
      return _.map(argDeclaration[1].split(','), (argName) => argName.match(FN_ARG)[2]);
    }
  }

  function instantiate(Type, locals) {
    var UnWrappedType = _.isArray(Type) ? _.last(Type) : Type;
    var instance = Object.create(UnWrappedType.prototype);
    invoke(Type, instance, locals);
    return instance;
  }

  _.forEach(modulesToLoad, function loadModule(moduleName) {

    if (!loadedModules.hasOwnProperty(moduleName)) {
      loadedModules[moduleName] = true;
      var module = angular.module(moduleName);
      _.forEach(module.requires, loadModule);
      _.forEach(module._invokeQueue, invokeArgs => {
        var method = invokeArgs[0];
        var args = invokeArgs[1];
        $provide[method].apply($provide, args);
      });
    }
  });

  return {
    has: function (key) {
      return instanceCache.hasOwnProperty(key) || providerCache.hasOwnProperty(key + 'Provider');
    },
    get: getService,
    invoke: invoke,
    annotate: annotate,
    instantiate: instantiate
  }
}
