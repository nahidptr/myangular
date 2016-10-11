'use strict';

function createInjector(modulesToLoad, strictDi) {

  var providerCache = {};
  var providerInjector = createInternalInjector(providerCache, function providerFactoryWhichThrows() {
    throw 'Unknown provider: ' + path.join(' <- ');
  });

  var instanceCache = {};
  var instanceInjector = createInternalInjector(instanceCache, function instanceInjectorFactory(name) {
    var provider = providerInjector.get(name + 'Provider');
    return instanceInjector.invoke(provider.$get, provider);
  });


  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
  var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
  var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;
  var INSTANTIATING = {};

  var loadedModules = {};
  var path = [];
  strictDi = (strictDi === true);

  var $provide = {
    constant: function (key, value) {
      if (key === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid constant name!';
      }
      providerCache[key] = value;
      instanceCache[key] = value;
    },
    provider: function (key, provider) {
      if(_.isFunction(provider)) {
        //! for ctor fn, dependencies must be resolved b4 hand
        //! since instantiate calls invoke, which calls getService and it won't have the current provider dependencies in cache,
        //! since its called for the 1st time without storing data in provider cache
        provider = providerInjector.instantiate(provider);
      }
      providerCache[key + 'Provider'] = provider;
    }
  };

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

  function createInternalInjector(cache, factoryFn) {

    function getService(name) {
      if(cache.hasOwnProperty(name)) {
        if(cache[name] === INSTANTIATING) {
          throw 'Circular dependency found: ' + name + ' <- ' + path.join(' <- ');
        }
        return cache[name];
      } else {
        cache[name] = INSTANTIATING;
        path.unshift(name);
        try {
          return (cache[name] = factoryFn(name));
        } finally  {
          path.shift();
          if(cache[name] === INSTANTIATING) {
            delete cache[name];
          }
        }
      }
    }

    function invoke(fn, self, locals) {
      var args =  annotate(fn).map(token => {
        if (_.isString(token)) {
          return locals && locals.hasOwnProperty(token) ?
            locals[token] : getService(token);
        } else {
          throw 'Incorrect injection token! Expected a string, got ' + token;
        }
      });
      if(_.isArray(fn)) {
        fn = _.last(fn);
      }
      return fn.apply(self, args);
    }

    function instantiate(Type, locals) {
      var UnWrappedType = _.isArray(Type) ? _.last(Type) : Type;
      var instance = Object.create(UnWrappedType.prototype);
      invoke(Type, instance, locals);
      return instance;
    }

    return {
      has: function (name) {
        return cache.hasOwnProperty(name) || providerCache.hasOwnProperty(name + 'Provider');
      },
      get: getService,
      invoke: invoke,
      annotate: annotate,
      instantiate: instantiate
    }
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

  return instanceInjector;
}
