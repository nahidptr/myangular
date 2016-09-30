/* jshint globalstrict: true */
/* global parse: false, register: false*/
/* jshint esversion: 6 */

'use strict';

describe("filter", function () {

  it('can be registered and obtained', function () {
    var myFilter = function() {};
    var myFilterFactory = function () {
      return myFilter;
    };

    register('my', myFilterFactory);
    expect(filter('my')).toBe(myFilter);
  });

  it('allows registering multiple filters with an object', function () {
    var myFilter = function() {};
    var myOtherFilter = function() {};

    register({
      my: function () {
        return myFilter;
      },
      myOther: function () {
        return myOtherFilter;
      }
    });

    expect(filter('my')).toBe(myFilter);
    expect(filter('myOther')).toBe(myOtherFilter);
  });

  it('can parse filter expressions', function () {
    register('upcase', function () {
      return function (str) {
        return str.toUpperCase();
      };
    });

    var fn = parse('aString | upcase');
    var fn2 = parse('aString | upcase');
    expect(fn({aString: 'Hello'})).toEqual('HELLO');
  });



  it('can parse filter chain expressions', function () {
    register('upcase', function () {
      return function (str) {
        return str.toUpperCase();
      };
    });
    register('exclamate', function () {
      return function (str) {
        return str + '!';
      };
    });

    var fn = parse('"hello" | upcase | exclamate');
    expect(fn()).toEqual('HELLO!');
  });

  it('can pass an additional argument to filters', function () {
    register('repeat', function () {
      return function (s, times) {
        return _.repeat(s, times);
      };
    });

    var fn = parse('"hello" | repeat:3');
    expect(fn()).toEqual('hellohellohello');
  });

  it('can pass several additional argument to filters', function () {
    register('surrond', function () {
      return function (s, left, right) {
        return left + s + right;
      };
    });

    var fn = parse('"hello" | surrond:"*":"!"');
    expect(fn()).toEqual('*hello!');
  });


});
