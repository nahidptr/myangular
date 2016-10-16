/* jshint globalstrict: true */
/* global parse: false, register: false*/
/* jshint esversion: 6 */

'use strict';

describe("filter", function () {

  beforeEach(function () {
    publishExternalAPI();
  });

  it('can be registered and obtained', function () {
    var myFilter = function () {};
    var myFilterFactory = function () {
      return myFilter;
    };

    var injector = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('my', myFilterFactory);
    }]);

    var $filter = injector.get('$filter');
    expect($filter('my')).toBe(myFilter);

  });

  it('allows registering multiple filters with an object', function () {
    var myFilter = function () {    };
    var myOtherFilter = function () {    };

    var injector = createInjector(['ng', function ($filterProvider) {

      $filterProvider.register({
        my: function () {
          return myFilter;
        },
        myOther: function () {
          return myOtherFilter;
        }
      });
    }]);

    var $filter = injector.get('$filter');

    expect($filter('my')).toBe(myFilter);
    expect($filter('myOther')).toBe(myOtherFilter);
  });

  // Filter but also linked with parse module
  it('can parse filter expressions', function () {

    var parse = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('upcase', function () {
        return function (str) {
          return str.toUpperCase();
        };
      });
    }]).get('$parse');

    var fn = parse('aString | upcase');
    expect(fn({aString: 'Hello'})).toEqual('HELLO');
  });


  it('can parse filter chain expressions', function () {

    var parse = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('upcase', function () {
        return function (str) {
          return str.toUpperCase();
        };
      });

      $filterProvider.register('exclamate', function () {
        return function (str) {
          return str + '!';
        };
      });
    }]).get('$parse');

    var fn = parse('"hello" | upcase | exclamate');
    expect(fn()).toEqual('HELLO!');
  });

  it('can pass an additional argument to filters', function () {

    var parse = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('repeat', function () {
        return function (s, times) {
          return _.repeat(s, times);
        };
      });
    }]).get('$parse');

    var fn = parse('"hello" | repeat:3');
    expect(fn()).toEqual('hellohellohello');

  });

  it('can pass several additional argument to filters', function () {

    var parse = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('surrond', function () {
        return function (s, left, right) {
          return left + s + right;
        };
      });
    }]).get('$parse');

    var fn = parse('"hello" | surrond:"*":"!"');
    expect(fn()).toEqual('*hello!');

  });

  // added newly after dependency module
  it('is available through injector', function () {

    var myFilter = function () {};
    var injector = createInjector(['ng', function ($filterProvider) {
      $filterProvider.register('my', function () {
        return myFilter;
      });
    }]);

    expect(injector.has('myFilter')).toBe(true);
    expect(injector.get('myFilter')).toBe(myFilter);
  });

  it('may have dependencies in factory', function () {

    var injector = createInjector(['ng', function ($provide, $filterProvider) {
      $provide.constant('suffix', '!');
      $filterProvider.register('my', function (suffix) {
        return function(v) {
          return suffix + v;
        };
      });
    }]);

    expect(injector.has('myFilter')).toBe(true);
  });

  it('can be registered through module API', function () {

    var myFilter = function() {};
    var module = angular.module('myModule', [])
      .filter('my', function() {
      return myFilter;
    });
    var injector = createInjector(['ng', 'myModule']);

    expect(injector.has('myFilter')).toBe(true);
    expect(injector.get('myFilter')).toBe(myFilter);
  });

});
