var assert = require('assert');
var _ = require('highland');
var diverge = require('../index.js');

describe('diverge', function () {

    it('can produce only one stream (even though that is pointless)', function () {
        return new Promise(function (resolve) {
            _(['a', 'b', 'c']).through(diverge(1)).toArray(function (arr) {
                assert.equal(arr.length, 1, 'got one stream');
                arr[0].toArray(function (arr) {
                    assert.deepEqual(arr, ['a', 'b', 'c']);
                    resolve();
                });
            });
        });
    });

    it('keeps moving when at least one output stream is ready', function () {
        return new Promise(function (resolve) {
            _(['a', 'b', 'c']).through(diverge(2)).toArray(function (arr) {
                assert.equal(arr.length, 2, 'got two streams');

                // Here we will intentionally consume only the first
                // stream, letting the second remain paused. Unlike fork(),
                // back-pressure isn't felt by the input stream unless
                // *all* the output streams are paused.

                var fastStream = arr[0];
                var slowStream = arr[1];

                fastStream.toArray(function (arr) {
                    assert.deepEqual(arr, ['a', 'b', 'c'], 'stream 0 okay');

                    // and now we'll consume the other stream just to make
                    // sure we correctly get an empty, closed stream.
                    slowStream.toArray(function (arr) {
                        assert.deepEqual(arr, [], 'stream 1 okay');
                        resolve();
                    });
                });
            });
        });
    });

    it('spreads input items across output streams', function () {
        return new Promise(function (resolve) {
            _(['a', 'b', 'c'])
                .through(diverge(3))
                .map(function (stream) {
                    return [stream, []];
                })
                .flatMap(
                    function (item) {
                        var ret = _();
                        item[0].pull(function (err, x) {
                            item[1].push(x);
                            ret.write(item);
                            ret.write(_.nil);
                        });
                        return ret;
                    }
                )
                .toArray(function (arr) {
                    assert.deepEqual(arr.length, 3, 'got three streams');
                    assert.deepEqual(arr[0][1], ['a'], 'first stream got a');
                    assert.deepEqual(arr[1][1], ['b'], 'second stream got b');
                    assert.deepEqual(arr[2][1], ['c'], 'third stream got c');
                    resolve();
                })
            ;
        });
    });

    it('passes errors', function () {
        return new Promise(function (resolve) {
            var errs = [];
            _.fromError(new Error('!')).through(diverge(2)).merge().errors(
                function (err) {
                    errs.push(err);
                }
            ).done(function () {
                assert.equal(errs.length, 1, 'got one error');
                assert.equal(errs[0].message, '!', 'correct error message');
                resolve();
            });
        });
    });

});
