function makeThunk(fn) {
  var args = [].slice.call(arguments, 1);
  return function (cb) {
    args.push(cb);
    fn.apply(null, args);
  };
}

function addAsync(x, y, cb) {
  setTimeout(function () {
    cb(x + y);
  },10);
}

function fakeAjax(url, cb) {
  var fake_responses = {
    "file1": "the first text",
    "file2": "the second text",
    "file3": "the last text"
  };

  var randomDelay = (Math.round(Math.random() * 1E4) % 8000) + 1000;

  console.log("Requesting: " + url);

  setTimeout(function () {
    cb(fake_responses[url]);
  }, randomDelay);

}


function output(text) {
  console.log(text);
}

function getFile(file) {

  var text, fn;
  fakeAjax(file, function (response) {
    if (fn) {
      fn(response);
    } else {
      text = response;
    }
  });

  return function (cb) {
    if (text) cb(text);
    else fn = cb;
  };
}
