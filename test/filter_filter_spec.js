/* jshint globalstrict: true */
/* global parse: false, register: false*/
/* jshint esversion: 6 */


describe("filter filter", function () {

  it('is available', function () {
    expect(filter('filter')).toBeDefined();
  });

  it('can filter an array with a predicate function', function () {
    var fn = parse('[1,2,3, 4] | filter:isOdd');
    var scope = {
      isOdd: function (n) {
        return n%2 !== 0;
      }
    };

    expect(fn(scope)).toEqual([1,3]);
  });

  it('can filter an array of strings with a string', function () {
    var fn = parse('arr | filter:"a"');
    var scope = { arr:["a", "b", "a"]};

    expect(fn(scope)).toEqual(['a', 'a']);
  });

  it('filter an array of strings with substring matching', function () {
    var fn = parse('arr | filter:"o"');
    var scope = { arr:["quick", "brown", "fox"]};

    expect(fn(scope)).toEqual(['brown', 'fox']);
  });

  it('filter an array of strings ignoring case', function () {
    var fn = parse('arr | filter:"o"');
    var scope = { arr:["quick", "BROWN", "fox"]};

    expect(fn(scope)).toEqual(['BROWN', 'fox']);
  });

  it('filter an array of objects where any value matches', function () {
    var fn = parse('arr | filter:"o"');
    var scope = { arr:[
                        {firstName: 'John', lastName: 'Brown'},
                        {firstName: 'Jane', lastName: 'Fox'},
                        {firstName: 'Mary', lastName: 'Quick'}
                      ]
                };

    expect(fn(scope)).toEqual([{firstName: 'John', lastName: 'Brown'},
                               {firstName: 'Jane', lastName: 'Fox'}]);
  });

  it('filter an array of objects where nested value matches', function () {
    var fn = parse('arr | filter:"o"');
    var scope = { arr:[
                        {name: {first: 'John', last: 'Brown'}},
                        {name: {first: 'Jane', last: 'Fox'}},
                        {name: {first: 'Mary', last: 'Quick'}}
                      ]
                };

    expect(fn(scope)).toEqual([{name: {first: 'John', last: 'Brown'}},
                               {name: {first: 'Jane', last: 'Fox'}}]);
  });

  it('filter an array of arrays where nested value matches', function () {
    var fn = parse('arr | filter:"o"');
    var scope = { arr:[
                        [{name: 'John'}, {name: 'Mary'}],
                        [{name:'Jane'}]
                      ]
                };

    expect(fn(scope)).toEqual([[{name: 'John'}, {name: 'Mary'}]]);
  });

  it('filter with a number', function () {

    var fn = parse('arr | filter:42');
    var scope = { arr:[
                        {name: 'Mary', age:42},
                        {name: 'John', age:43},
                        {name: 'Jane', age:44}
                      ]
                };

    expect(fn(scope)).toEqual([{name: 'Mary', age:42}]);

  });

  it('filter with a boolean value', function () {

    var fn = parse('arr | filter:true');
    var scope = { arr:[
                        {name: 'Mary', admin:true},
                        {name: 'John', admin:true},
                        {name: 'Jane', admin:false}
                      ]
                };

    expect(fn(scope)).toEqual([{name: 'Mary', admin:true},
                               {name: 'John', admin:true}]);

  });

  it('filter with a substring numeric value', function () {

    var fn = parse('arr | filter:42');
    var scope = { arr:['contains 42'] };

    expect(fn(scope)).toEqual(['contains 42']);

  });

  it('filter matching null', function () {
    var fn = parse('arr | filter:null');
    var scope = { arr:[null, 'not null', 'contains 42'] };

    expect(fn(scope)).toEqual([null]);
  });

  it('does not match null value with the string null', function () {
    var fn = parse('arr | filter:"null"');
    var scope = { arr:[null, 'not null'] };

    expect(fn(scope)).toEqual(['not null']);
  });

  it('does not match undefined values', function () {

    var fn = parse('arr | filter:"undefined"');
    var scope = { arr:[undefined, 'undefined'] };

    expect(fn(scope)).toEqual(['undefined']);
  });

  it('allows negating string filter', function () {

    var fn = parse('arr | filter:"!o"');
    var scope = { arr:["quick", "brown", "fox"]};

    expect(fn(scope)).toEqual(['quick']);
  });

  it('filters with an object', function () {

    var fn = parse('arr | filter:{name:"o"}');
    var scope = { arr:[{name: 'Joe', role: 'admin'},
                      {name:'Jane', role: 'moderator'}
                      ]};

    expect(fn(scope)).toEqual([{name:'Joe', role:'admin'}]);
  });

  it('must match all criteria in an object', function () {

    var fn = parse('arr | filter:{name:"o", role: "m"}');
    var scope = { arr:[{name: 'Joe', role: 'admin'},
                      {name:'Jane', role: 'moderator'}
                      ]};

    expect(fn(scope)).toEqual([{name:'Joe', role:'admin'}]);
  });

  it('matches everything when filtered with an empty object', function () {

    var fn = parse('arr | filter:{}');
    var scope = { arr:[{name: 'Joe', role: 'admin'},
                      {name:'Jane', role: 'moderator'}
                      ]};

    expect(fn(scope)).toEqual([{name:'Joe', role:'admin'},
                              {name:'Jane', role: 'moderator'}]);
  });

  it('filters with a nested object', function () {

    var fn = parse('arr | filter:{name: {first: "o"}}');
    var scope = { arr:[
                    {name: {first:'Joe'}, role: 'admin'},
                    {name: {first:'Jane'}, role: 'moderator'},
                    ]
                };

    expect(fn(scope)).toEqual([{name: {first:'Joe'}, role: 'admin'}]);
  });

  it('allows negation when filtering with an object', function () {

    var fn = parse('arr | filter:{name: {first: "!o"}}');
    var scope = { arr:[
                    {name: {first:'Joe'}, role: 'admin'},
                    {name: {first:'Jane'}, role: 'moderator'},
                    ]
                };

    expect(fn(scope)).toEqual([
      {name: {first:'Jane'}, role: 'moderator'}
      ]);
  });


  it('ignores undefined values in expectation object', function () {

    var fn = parse('arr | filter:{name: thisIsUndefined}');
    var scope = { arr:[{name: 'Joe', role: 'admin'},
      {name:'Jane', role: 'moderator'}
    ]};

    expect(fn(scope)).toEqual([
      {name:'Joe', role:'admin'},
      {name:'Jane', role: 'moderator'}
      ]);
  });

  it('filters with a nested object in array', function () {

    var fn = parse('arr | filter:{users: { name: {first: "o" }}}');
    var scope = { arr:[
      {users: [{name: {first: 'Joe'}, role: 'admin'},
               {name: {first: 'Jane'}, role: 'moderator'}
               ]},
      {users: [{name: {first: 'Mary'}, role: 'admin'}]}
    ]};

    expect(fn(scope)).toEqual([
      {users: [{name: {first: 'Joe'}, role: 'admin'},
      {name: {first: 'Jane'}, role: 'moderator'}]}
      ]);
  });

  it('filters with a nested objects on the sme level only', function () {

    var fn = parse('arr | filter:{user: { name: "Bob" }}');
    var scope = { arr:[
      {user: 'Bob'},
      {user: {name: 'Bob'}},
      {user: {name: {first: 'Bob', last: 'Fox'}}}
    ]};

    expect(fn(scope)).toEqual([
      {user: {name: 'Bob'}}
    ]);
  });

  it('filters with a wildcard property', function () {

    var fn = parse('arr | filter:{$: "o"}');
    var scope = { arr:[
      {name: 'Joe', role: 'admin'},
      {name: 'Jane', role: 'moderator'},
      {name: 'Mary', role: 'admin'}
    ]};

    expect(fn(scope)).toEqual([
      {name: 'Joe', role: 'admin'},
      {name: 'Jane', role: 'moderator'}
    ]);
  });

  it('filters nested objects with a wildcard property', function () {

    var fn = parse('arr | filter:{$: "o"}');
    var scope = { arr:[
      {name: {first: 'Joe'}, role: 'admin'},
      {name: {first: 'Jane'}, role: 'moderator'},
      {name: {first: 'Mary'}, role: 'admin'},
    ]};

    expect(fn(scope)).toEqual([
      {name: {first: 'Joe'}, role: 'admin'},
      {name: {first: 'Jane'}, role: 'moderator'}
    ]);
  });

  it('filters wildcard properties scoped to parent', function () {

    var fn = parse('arr | filter:{name: {$: "o"}}');
    var scope = { arr:[
      {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
      {name: {first: 'Jane', last: 'Quick'}, role: 'moderator'},
      {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
    ]};

    expect(fn(scope)).toEqual([
      {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
      {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
    ]);
  });

  it('filters primitives with wildcard property', function () {

    var fn = parse('arr | filter:{$: "o"}}');
    var scope = { arr:['Joe', 'Jane', 'Mary' ]};

    expect(fn(scope)).toEqual(['Joe']);
  });

  it('filters with a nested wildcard property', function () {

    var fn = parse('arr | filter:{$: {$: "o"}}');
    var scope = { arr:[
      {name: {first: 'Joe'}, role: 'admin'},
      {name: {first: 'Jane'}, role: 'moderator'},
      {name: {first: 'Mary'}, role: 'admin'}
    ]};

    expect(fn(scope)).toEqual([
      {name: {first: 'Joe'}, role: 'admin'}]);
  });

  it('allows using a custom comparator', function () {

    var fn = parse('arr | filter: {$: "o"}:myComparator}');
    var scope = { arr:['o', 'oo', 'ao', 'aa'],
      myComparator: function (left, right) {
        return left === right;
      }
    };

    expect(fn(scope)).toEqual(['o']);
  });

  it('allows using a equality comparator', function () {

    var fn = parse('arr | filter: "Jo":true');
    var scope = { arr:['Jo', 'Joe'] };

    expect(fn(scope)).toEqual(['Jo']);
  });



});
