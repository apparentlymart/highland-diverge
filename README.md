# highland-diverge

`highland-diverge` is a building block to enable splitting a Highland
stream into two or more other streams that each apply *separate*
back-pressure.

You could think of this as being like Highland's `fork` except that progress
is made at the rate of the *fastest* stream, rather than the slowest.

The primary use-case for this is to deal with a slow stream by splitting
the input items across multiple instances that can each move as fast
as they are able, thereby allowing items to be processed concurrently.

## Usage

The following example shows a typical (though also rather contrived) use of
`diverge`:

```js
var _ = require('highland');
var diverge = require('highland-diverge');
var fs = require('fs');
var request = require('request');
var streamPost = _.wrapCallback(request.post);

var inStream = _(fs.createReadStream('lines.txt'));

inStream
    .split()
    .through(diverge(10)) // spread the input lines over 10 different streams
    .map(function (stream) {
        // In here, do any operations that should be done concurrently
        // across all of our divergent streams. This will generally be
        // something asynchronous that creates back-pressure, and in
        // this example that's an HTTP request via the 'request' library
        // from npm. Since we diverged to 10 streams, we'll do a maximum
        // of 10 concurrent requests to this endpoint.
        return stream.flatMap(function (line) {
            return streamPost(
                 'http://example.com/lines',
                  {form: {line: line}}
            );
        });
    })
    .merge() // combine the 10 separate streams back together again
    .errors(
        function (err) {
            console.error(err);
        }
    )
    .each(
        function (resp) {
            console.log('got response', resp.statusCode);
        }
    );
;
```

The key pattern from the above example is the following:

```js
    .through(diverge(n))
    .map(function (stream) {
        // Create a separate pipeline for each of the n streams,
        // with any highland methods you like.
        return stream.anything();
    }
    .merge()
```

`diverge` returns a stream of streams, with the number of streams given
in its argument. These are the *output streams*.

Each item or error that is written to the source stream will be written to
exactly one of the output streams. The output streams will be used in the
order they become ready for writing, so the allocation of items to streams
is generally orderly but rather unpredictable, depending on how quickly
each of the streams is able to process the items it is given.

Generally one will use `map` to apply the same set of follow-on transforms
to each of the generated streams, thus allowing the operations in that
stream to happen concurrently across *n* instances. This will increase
throughput by *n* times, as long as there are no other slower elements
in the outer pipeline.

## License

Copyright 2016 Martin Atkins.

This library is distributed under the terms of the MIT license; for details,
see [LICENSE](LICENSE).
